import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { ref, get, set, remove, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";
import { getOneSignalOverview, getOneSignalNotifications } from "./onesignal-api.js";

// Banner UI Elements
const bannersListContainer = document.getElementById("bannersListContainer");
const bannerEmptyNotice = document.getElementById("bannerEmptyNotice");
const addNewBannerSlotBtn = document.getElementById("addNewBannerSlotBtn");

const editBannerModal = document.getElementById("editBannerModal");
const closeBannerModalBtn = document.getElementById("closeBannerModalBtn");
const bannerForm = document.getElementById("bannerForm");
const inputBannerSlotId = document.getElementById("inputBannerSlotId");
const inputBannerType = document.getElementById("inputBannerType");
const versionFieldsContainer = document.getElementById("versionFieldsContainer");
const inputTargetVersionCode = document.getElementById("inputTargetVersionCode");
const inputTargetVersionName = document.getElementById("inputTargetVersionName");
const inputBannerTitle = document.getElementById("inputBannerTitle");
const inputBannerMsg = document.getElementById("inputBannerMsg");
const inputBannerUrl = document.getElementById("inputBannerUrl");
const bannerModalTitle = document.getElementById("bannerModalTitle");

let currentBannersMap = {};

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  const colors = {
    success: "background-color:#DDD6C7; border:1px solid #047857; color:#047857;",
    error: "background-color:#DDD6C7; border:1px solid #BE123C; color:#BE123C;",
    info: "background-color:#DDD6C7; border:1px solid #BAAF98; color:#0E7490;"
  };
  toast.className = "flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-md";
  toast.style.cssText = colors[type] || colors.info;
  toast.innerHTML = `<span class="material-symbols-outlined text-18">info</span><span class="text-xs font-semibold">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// 1. CONDITIONAL VERSION INPUT VISIBILITY
function updateVersionFieldsVisibility() {
  const selectedType = inputBannerType.value;
  if (selectedType === "UPDATE") {
    versionFieldsContainer.classList.remove("hidden");
    inputTargetVersionCode.required = true;
  } else {
    versionFieldsContainer.classList.add("hidden");
    inputTargetVersionCode.required = false;
    inputTargetVersionCode.value = "";
    inputTargetVersionName.value = "";
  }
}

if (inputBannerType) {
  inputBannerType.addEventListener("change", updateVersionFieldsVisibility);
}

// 2. REAL-TIME MULTI-BANNER LISTENER (Ghost Loop Removed)
function listenToAppBanners() {
  const multiRef = ref(database, "app_announcements");
  onValue(multiRef, (snapshot) => {
    if (snapshot.exists()) {
      currentBannersMap = snapshot.val();
      renderAllBanners(currentBannersMap);
    } else {
      currentBannersMap = {};
      renderAllBanners({});
    }
  });
}

function renderAllBanners(bannersMap) {
  if (!bannersListContainer) return;
  bannersListContainer.innerHTML = "";

  const keys = Object.keys(bannersMap || {});
  if (keys.length === 0) {
    if (bannerEmptyNotice) bannerEmptyNotice.classList.remove("hidden");
    return;
  }
  if (bannerEmptyNotice) bannerEmptyNotice.classList.add("hidden");

  keys.forEach((slotKey) => {
    const item = bannersMap[slotKey];
    if (!item) return;

    const isActive = Boolean(item.active);
    const type = (item.type || "NOTICE").toUpperCase();

    let tagColor = "background: rgba(180,83,9,0.15); color: var(--accent-amber);";
    let iconName = "info";
    if (type === "UPDATE") {
      tagColor = "background: rgba(4,120,87,0.15); color: var(--accent-mint);";
      iconName = "system_update";
    } else if (type === "BUG") {
      tagColor = "background: rgba(190,18,60,0.15); color: var(--accent-rose);";
      iconName = "warning";
    }

    const card = document.createElement("div");
    card.className = "p-3 rounded-xl border space-y-2 surface-card transition-all";
    card.style.borderColor = isActive ? "var(--border-subtle)" : "rgba(190,18,60,0.25)";

    const versionBadge = (type === "UPDATE" && item.targetVersionCode) 
      ? `<span class="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-700">Code &lt; ${item.targetVersionCode}</span>` 
      : "";

    card.innerHTML = `
      <div class="flex items-center justify-between border-b pb-1.5" style="border-color: var(--border-subtle);">
        <div class="flex items-center gap-1.5">
          <span class="material-symbols-outlined text-16" style="${tagColor.split(';')[1]}">${iconName}</span>
          <span class="font-mono font-bold text-[9px] px-1.5 py-0.5 rounded uppercase" style="${tagColor}">${type}</span>
          ${versionBadge}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[9px] font-mono font-bold ${isActive ? 'text-emerald-700' : 'text-rose-600'}">${isActive ? 'ACTIVE' : 'OFF'}</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" data-slot="${slotKey}" class="sr-only banner-slot-toggle" ${isActive ? 'checked' : ''}>
            <div class="toggle-track"><div class="toggle-knob"></div></div>
          </label>
        </div>
      </div>
      <div>
        <h4 class="text-xs font-bold" style="color: var(--text-primary);">${item.title || 'Untitled Banner'}</h4>
        <p class="text-[11px] line-clamp-2 mt-0.5" style="color: var(--text-muted);">${item.message || ''}</p>
        ${item.url ? `<p class="text-[9px] font-mono text-cyan-700 truncate mt-1">Link: ${item.url}</p>` : ''}
      </div>
      <div class="flex items-center justify-end gap-2 pt-1 border-t border-black/5">
        <button type="button" data-edit="${slotKey}" class="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border surface-card text-emerald-700">
          <span class="material-symbols-outlined text-14">edit</span>
          <span>Edit</span>
        </button>
        <button type="button" data-del="${slotKey}" class="px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 text-rose-600 bg-rose-500/10">
          <span class="material-symbols-outlined text-14">delete</span>
          <span>Delete</span>
        </button>
      </div>
    `;

    bannersListContainer.appendChild(card);
  });

  // Toggle active/inactive
  document.querySelectorAll(".banner-slot-toggle").forEach((chk) => {
    chk.onchange = async (e) => {
      const slot = e.target.dataset.slot;
      const state = e.target.checked;
      try {
        await set(ref(database, `app_announcements/${slot}/active`), state);
        showToast(`Banner "${slot.toUpperCase()}" ${state ? 'Active' : 'Deactivated'}!`, "success");
      } catch (err) {
        showToast("Toggle Error: " + err.message, "error");
      }
    };
  });

  // Edit button
  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.onclick = () => openBannerModal(btn.dataset.edit);
  });

  // Delete button (Cleans both multi and legacy nodes)
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      const slot = btn.dataset.del;
      if (confirm(`"${slot.toUpperCase()}" banner ko permanently delete karein?`)) {
        try {
          // Remove from multi-announcements
          await remove(ref(database, `app_announcements/${slot}`));
          // Also clear legacy mirror so it never ghost-revives
          await remove(ref(database, "app_announcement"));
          showToast("Banner deleted successfully!", "info");
        } catch (err) {
          showToast("Delete Error: " + err.message, "error");
        }
      }
    };
  });
}

// 3. MODAL OPEN/CLOSE & PRE-FILL
function openBannerModal(slotKey = null) {
  if (!editBannerModal) return;
  editBannerModal.classList.remove("hidden");

  if (slotKey && currentBannersMap[slotKey]) {
    const d = currentBannersMap[slotKey];
    if (bannerModalTitle) bannerModalTitle.textContent = `Edit ${slotKey.toUpperCase()} Banner`;
    inputBannerSlotId.value = slotKey;
    inputBannerType.value = d.type || "NOTICE";
    inputTargetVersionCode.value = d.targetVersionCode || "";
    inputTargetVersionName.value = d.targetVersionName || "";
    inputBannerTitle.value = d.title || "";
    inputBannerMsg.value = d.message || "";
    inputBannerUrl.value = d.url || "";
  } else {
    if (bannerModalTitle) bannerModalTitle.textContent = "Create New App Banner";
    bannerForm.reset();
    inputBannerSlotId.value = "";
    inputBannerType.value = "NOTICE";
  }
  updateVersionFieldsVisibility();
}

if (addNewBannerSlotBtn) addNewBannerSlotBtn.onclick = () => openBannerModal(null);
document.querySelectorAll(".btn-create-slot").forEach((btn) => {
  btn.onclick = () => openBannerModal(null);
});
if (closeBannerModalBtn) closeBannerModalBtn.onclick = () => editBannerModal.classList.add("hidden");

// 4. BANNER FORM SUBMIT
if (bannerForm) {
  bannerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = inputBannerType.value;
    const isUpdate = type === "UPDATE";
    const versionCode = isUpdate && inputTargetVersionCode.value.trim() ? parseInt(inputTargetVersionCode.value.trim()) : 0;
    const versionName = isUpdate ? inputTargetVersionName.value.trim() : "";
    const title = inputBannerTitle.value.trim();
    const message = inputBannerMsg.value.trim();
    const url = inputBannerUrl.value.trim();

    let slotId = inputBannerSlotId.value.trim();
    if (!slotId) {
      if (type === "UPDATE") slotId = "update";
      else if (type === "BUG") slotId = "alert";
      else slotId = "notice";
    }

    const payload = {
      active: true,
      type: type,
      targetVersionCode: versionCode,
      targetVersionName: versionName,
      title: title,
      message: message,
      url: url,
      updatedAt: Date.now()
    };

    try {
      await set(ref(database, `app_announcements/${slotId}`), payload);
      showToast(`Banner "${slotId.toUpperCase()}" updated & live in App!`, "success");
      editBannerModal.classList.add("hidden");
    } catch (err) {
      showToast("Save Error: " + err.message, "error");
    }
  });
}

// 5. AUTH & LIVE METRICS
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const emailEl = document.getElementById("adminEmailDisplay");
  if (emailEl) {
    emailEl.textContent = user.email || user.displayName || "Admin Authenticated";
  }

  let role = "viewer";
  try {
    const roleSnap = await get(ref(database, `admin_users/${user.uid}/role`));
    role = roleSnap.exists() ? roleSnap.val() : "owner";
  } catch (e) {
    role = "owner";
  }

  const roleBadge = document.getElementById("adminRoleBadge");
  if (roleBadge) {
    roleBadge.textContent = role.toUpperCase();
  }

  if (role !== "owner") {
    const permCard = document.getElementById("cardPermissions");
    if (permCard) permCard.classList.add("hidden");
  }

  listenToAppBanners();
  loadLiveMetrics();
  setInterval(loadLiveMetrics, 25000);
});

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => { window.location.href = "index.html"; });
  });
}

async function loadLiveMetrics() {
  const t0 = performance.now();
  let dbOk = false;
  let dbMs = 0;

  try {
    const snap = await get(ref(database, "results"));
    dbMs = Math.round(performance.now() - t0);
    dbOk = true;

    let resCount = 0;
    if (snap.exists()) {
      snap.forEach(() => { resCount++; });
    }
    const statRes = document.getElementById("statResults");
    if (statRes) statRes.textContent = resCount;
  } catch (e) {
    dbOk = false;
  }

  let osOk = false;
  let osMs = 0;
  try {
    const t1 = performance.now();
    const [osData, notifsData] = await Promise.all([
      getOneSignalOverview(),
      getOneSignalNotifications(0)
    ]);
    osMs = Math.round(performance.now() - t1);
    osOk = true;

    const statSub = document.getElementById("statSubscribers");
    if (statSub) statSub.textContent = osData.totalSubscriptions ?? 0;

    const statNotif = document.getElementById("statNotifications");
    if (statNotif) {
      statNotif.textContent = notifsData.totalCount ?? (notifsData.notifications ? notifsData.notifications.length : 0);
    }
  } catch (e) {
    osOk = false;
  }

  const statSystem = document.getElementById("statSystem");
  const statLatency = document.getElementById("statLatency");

  if (dbOk && osOk) {
    if (statSystem) {
      statSystem.textContent = "Online";
      statSystem.style.color = "var(--accent-mint)";
    }
    if (statLatency) {
      statLatency.textContent = `RTDB: ${dbMs}ms | OneSignal: ${osMs}ms`;
    }
  } else {
    if (statSystem) {
      statSystem.textContent = "Degraded";
      statSystem.style.color = "var(--accent-amber)";
    }
    if (statLatency) {
      statLatency.textContent = `RTDB: ${dbOk ? dbMs + 'ms' : 'ERR'} | OneSignal: ${osOk ? osMs + 'ms' : 'ERR'}`;
    }
  }
}

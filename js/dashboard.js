import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { ref, get, set, remove, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";
import { getOneSignalOverview, getOneSignalNotifications } from "./onesignal-api.js";

// Banner UI Elements
const bannerStatusBadge = document.getElementById("bannerStatusBadge");
const toggleLiveBanner = document.getElementById("toggleLiveBanner");
const bannerActiveCard = document.getElementById("bannerActiveCard");
const bannerEmptyNotice = document.getElementById("bannerEmptyNotice");
const bannerTypeTag = document.getElementById("bannerTypeTag");
const bannerUpdatedTime = document.getElementById("bannerUpdatedTime");
const bannerTitleDisplay = document.getElementById("bannerTitleDisplay");
const bannerMsgDisplay = document.getElementById("bannerMsgDisplay");
const bannerUrlDisplay = document.getElementById("bannerUrlDisplay");

const openEditBannerBtn = document.getElementById("openEditBannerBtn");
const deleteBannerBtn = document.getElementById("deleteBannerBtn");
const createBannerBtn = document.getElementById("createBannerBtn");

const editBannerModal = document.getElementById("editBannerModal");
const closeBannerModalBtn = document.getElementById("closeBannerModalBtn");
const bannerForm = document.getElementById("bannerForm");
const inputBannerType = document.getElementById("inputBannerType");
const inputBannerTitle = document.getElementById("inputBannerTitle");
const inputBannerMsg = document.getElementById("inputBannerMsg");
const inputBannerUrl = document.getElementById("inputBannerUrl");
const bannerModalTitle = document.getElementById("bannerModalTitle");

let currentBannerData = null;

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

// 1. REAL-TIME LISTENER FOR APP HEADER ANNOUNCEMENT BANNER
function listenToAppBanner() {
  const bannerRef = ref(database, "app_announcement");
  onValue(bannerRef, (snapshot) => {
    if (snapshot.exists()) {
      currentBannerData = snapshot.val();
      renderBannerUI(currentBannerData);
    } else {
      currentBannerData = null;
      renderBannerUI(null);
    }
  });
}

function renderBannerUI(data) {
  if (!data) {
    if (bannerStatusBadge) {
      bannerStatusBadge.textContent = "NO BANNER";
      bannerStatusBadge.style.cssText = "background: rgba(74,93,110,0.15); color: var(--text-muted);";
    }
    if (toggleLiveBanner) toggleLiveBanner.checked = false;
    if (bannerActiveCard) bannerActiveCard.classList.add("hidden");
    if (bannerEmptyNotice) bannerEmptyNotice.classList.remove("hidden");
    return;
  }

  const isActive = Boolean(data.active);
  if (toggleLiveBanner) toggleLiveBanner.checked = isActive;

  if (bannerStatusBadge) {
    if (isActive) {
      bannerStatusBadge.textContent = "ACTIVE ON APP";
      bannerStatusBadge.style.cssText = "background: rgba(4,120,87,0.15); color: var(--accent-mint);";
    } else {
      bannerStatusBadge.textContent = "DISABLED";
      bannerStatusBadge.style.cssText = "background: rgba(190,18,60,0.15); color: var(--accent-rose);";
    }
  }

  if (bannerTypeTag) {
    const type = (data.type || "NOTICE").toUpperCase();
    bannerTypeTag.textContent = type;
    if (type === "UPDATE") {
      bannerTypeTag.style.cssText = "background: rgba(4,120,87,0.15); color: var(--accent-mint);";
    } else if (type === "BUG") {
      bannerTypeTag.style.cssText = "background: rgba(190,18,60,0.15); color: var(--accent-rose);";
    } else {
      bannerTypeTag.style.cssText = "background: rgba(180,83,9,0.15); color: var(--accent-amber);";
    }
  }

  if (bannerTitleDisplay) bannerTitleDisplay.textContent = data.title || "Announcement";
  if (bannerMsgDisplay) bannerMsgDisplay.textContent = data.message || "";
  if (bannerUrlDisplay) {
    if (data.url) {
      bannerUrlDisplay.textContent = `Link: ${data.url}`;
      bannerUrlDisplay.classList.remove("hidden");
    } else {
      bannerUrlDisplay.classList.add("hidden");
    }
  }

  if (bannerUpdatedTime && data.updatedAt) {
    const d = new Date(data.updatedAt);
    bannerUpdatedTime.textContent = d.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (bannerActiveCard) bannerActiveCard.classList.remove("hidden");
  if (bannerEmptyNotice) bannerEmptyNotice.classList.add("hidden");
}

// 2. TOGGLE ON/OFF HANDLER (Direct RTDB Write)
if (toggleLiveBanner) {
  toggleLiveBanner.addEventListener("change", async () => {
    if (!currentBannerData) {
      toggleLiveBanner.checked = false;
      openBannerModal(false);
      return;
    }

    try {
      const newStatus = toggleLiveBanner.checked;
      await set(ref(database, "app_announcement/active"), newStatus);
      showToast(newStatus ? "Banner App me ON kar diya gaya!" : "Banner App me OFF kar diya gaya!", "success");
    } catch (e) {
      showToast("Error updating status: " + e.message, "error");
    }
  });
}

// 3. EDIT & CREATE MODAL HANDLERS
function openBannerModal(isEdit = true) {
  if (!editBannerModal) return;
  editBannerModal.classList.remove("hidden");

  if (isEdit && currentBannerData) {
    if (bannerModalTitle) bannerModalTitle.textContent = "Edit Announcement Banner";
    if (inputBannerType) inputBannerType.value = currentBannerData.type || "UPDATE";
    if (inputBannerTitle) inputBannerTitle.value = currentBannerData.title || "";
    if (inputBannerMsg) inputBannerMsg.value = currentBannerData.message || "";
    if (inputBannerUrl) inputBannerUrl.value = currentBannerData.url || "";
  } else {
    if (bannerModalTitle) bannerModalTitle.textContent = "Create New App Banner";
    if (bannerForm) bannerForm.reset();
  }
}

if (openEditBannerBtn) openEditBannerBtn.addEventListener("click", () => openBannerModal(true));
if (createBannerBtn) createBannerBtn.addEventListener("click", () => openBannerModal(false));
if (closeBannerModalBtn) closeBannerModalBtn.addEventListener("click", () => editBannerModal.classList.add("hidden"));

// 4. BANNER FORM SUBMIT
if (bannerForm) {
  bannerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = inputBannerType.value;
    const title = inputBannerTitle.value.trim();
    const message = inputBannerMsg.value.trim();
    const url = inputBannerUrl.value.trim();

    try {
      await set(ref(database, "app_announcement"), {
        active: true,
        type: type,
        title: title,
        message: message,
        url: url,
        updatedAt: Date.now()
      });
      showToast("Banner saved & activated in App!", "success");
      editBannerModal.classList.add("hidden");
    } catch (err) {
      showToast("Save Error: " + err.message, "error");
    }
  });
}

// 5. DELETE BANNER
if (deleteBannerBtn) {
  deleteBannerBtn.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to permanently delete this banner from App?")) return;
    try {
      await remove(ref(database, "app_announcement"));
      showToast("Banner deleted from App & Firebase!", "success");
    } catch (err) {
      showToast("Delete Error: " + err.message, "error");
    }
  });
}

// Auth State & Real-Time Sync
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

  // Load Banner Live State
  listenToAppBanner();

  loadLiveMetrics();
  setInterval(loadLiveMetrics, 25000);
});

// Logout handler
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => { window.location.href = "index.html"; });
  });
}

// Live Metrics Engine
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
      snap.forEach(() => {
        resCount++;
      });
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
    if (statSub) {
      statSub.textContent = osData.totalSubscriptions ?? 0;
    }

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

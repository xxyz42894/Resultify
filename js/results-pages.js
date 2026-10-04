import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { ref, get, set, update, onValue, remove, push } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";
import { sendPushNotification } from "./onesignal-api.js";

let currentRole = "viewer";
let results = [];
let editingKey = null;
let activeCat = "all";
let activeStatus = "all";
let searchQuery = "";
const selectedResultKeys = new Set();

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
  toast.innerHTML = `<span class="material-symbols-outlined text-18">info</span><span class="text-xs font-semibold">${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// AUTOMATIC DUAL TIMER ENGINE (Checks timestamps & updates DB)
function evaluateTimedResults() {
  const now = Date.now();
  results.forEach(async (r) => {
    if (r.status === "Coming Soon + Timer") {
      const liveTime = r.timeLive ? new Date(r.timeLive).getTime() : 0;
      const availTime = r.timeAvailable ? new Date(r.timeAvailable).getTime() : 0;

      // Stage 2: Agar Available time cross ho gaya -> Result Available 🟢
      if (availTime > 0 && now >= availTime) {
        await update(ref(database, `results/${r.key}`), {
          status: "Result Available",
          published: "Declared Officially"
        });
      }
      // Stage 1: Agar Live time cross ho gaya par available time bacha hai -> Live 🔴
      else if (liveTime > 0 && now >= liveTime) {
        await update(ref(database, `results/${r.key}`), {
          status: "Live",
          published: "Live Now 🔴"
        });
      }
    }
  });
}

// Live Shade Mockup Sync
function syncPushPreview() {
  const customTitle = document.getElementById("pushCustomTitle");
  const customBody = document.getElementById("pushCustomBody");
  const customBigPic = document.getElementById("pushCustomBigPicture");
  const customBtn1Text = document.getElementById("pushCustomBtn1Text");
  const customBtn2Text = document.getElementById("pushCustomBtn2Text");

  const formTitle = document.getElementById("formTitle");
  const formDesc = document.getElementById("formDescription");

  const prevTitle = document.getElementById("previewPushTitle");
  const prevBody = document.getElementById("previewPushBody");
  const prevImgContainer = document.getElementById("previewPushImgContainer");
  const prevImg = document.getElementById("previewPushImg");
  const prevBtnsContainer = document.getElementById("previewPushBtnsContainer");
  const prevBtn1 = document.getElementById("previewPushBtn1");
  const prevBtn2 = document.getElementById("previewPushBtn2");

  const t = (customTitle && customTitle.value.trim()) || (formTitle && formTitle.value.trim()) || "New Result Declared! 🎯";
  const b = (customBody && customBody.value.trim()) || (formDesc && formDesc.value.trim()) || "Tap to check your scorecard and marksheet online.";

  if (prevTitle) prevTitle.textContent = t;
  if (prevBody) prevBody.textContent = b;

  const imgUrl = customBigPic ? customBigPic.value.trim() : "";
  if (imgUrl && prevImgContainer && prevImg) {
    prevImg.src = imgUrl;
    prevImgContainer.classList.remove("hidden");
  } else if (prevImgContainer) {
    prevImgContainer.classList.add("hidden");
  }

  const b1 = customBtn1Text ? customBtn1Text.value.trim() : "Check Result";
  const b2 = customBtn2Text ? customBtn2Text.value.trim() : "";

  if (prevBtnsContainer) {
    prevBtnsContainer.classList.remove("hidden");
    if (prevBtn1) {
      prevBtn1.textContent = b1 || "Check Result";
      prevBtn1.style.display = b1 ? "inline-block" : "none";
    }
    if (prevBtn2) {
      prevBtn2.textContent = b2 || "Button 2";
      prevBtn2.style.display = b2 ? "inline-block" : "none";
    }
  }
}

// Setup Status Change -> Dynamic Timer Containers
function setupStatusLogic() {
  const statusSelect = document.getElementById("formStatus");
  const timerComingSoon = document.getElementById("timerSectionComingSoon");
  const timerAnnounced = document.getElementById("timerSectionAnnounced");

  if (!statusSelect) return;

  statusSelect.onchange = () => {
    const val = statusSelect.value;
    if (val === "Coming Soon + Timer") {
      if (timerComingSoon) timerComingSoon.classList.remove("hidden");
      if (timerAnnounced) timerAnnounced.classList.add("hidden");
    } else if (val === "Date Announced") {
      if (timerComingSoon) timerComingSoon.classList.add("hidden");
      if (timerAnnounced) timerAnnounced.classList.remove("hidden");
    } else {
      if (timerComingSoon) timerComingSoon.classList.add("hidden");
      if (timerAnnounced) timerAnnounced.classList.add("hidden");
    }
  };
}

// Push Customizer Setup
function setupPushCustomizerEvents() {
  const toggleRow = document.getElementById("pushToggleRow");
  const toggle = document.getElementById("formSendPushToggle");
  const container = document.getElementById("pushPreviewContainer");

  const formTitle = document.getElementById("formTitle");
  const formDesc = document.getElementById("formDescription");
  const customTitle = document.getElementById("pushCustomTitle");
  const customBody = document.getElementById("pushCustomBody");
  const customBtn1Text = document.getElementById("pushCustomBtn1Text");
  const scrollBody = document.getElementById("modalScrollBody");

  if (!toggleRow || !toggle || !container) return;

  toggleRow.onclick = (e) => {
    e.preventDefault();
    toggle.checked = !toggle.checked;

    if (toggle.checked) {
      container.classList.remove("hidden");
      if (customTitle && !customTitle.value.trim()) {
        customTitle.value = formTitle && formTitle.value.trim() ? `${formTitle.value.trim()} Out! 🎯` : "";
      }
      if (customBody && !customBody.value.trim()) {
        customBody.value = formDesc && formDesc.value.trim() ? formDesc.value.replace(/<[^>]*>?/gm, '').substring(0, 150) : "Check your scorecard and marksheet online.";
      }
      if (customBtn1Text && !customBtn1Text.value.trim()) {
        customBtn1Text.value = "Check Result";
      }

      syncPushPreview();
      setTimeout(() => {
        if (scrollBody) scrollBody.scrollTo({ top: scrollBody.scrollHeight, behavior: "smooth" });
      }, 50);
    } else {
      container.classList.add("hidden");
    }
  };

  [
    "pushCustomTitle", "pushCustomBody", "pushCustomBigPicture", 
    "pushCustomLargeIcon", "pushCustomBtn1Text", "pushCustomBtn1Url", 
    "pushCustomBtn2Text", "pushCustomBtn2Url"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.oninput = () => {
        el.dataset.touched = "true";
        syncPushPreview();
      };
    }
  });

  if (formTitle) {
    formTitle.oninput = () => {
      if (toggle.checked && customTitle && (!customTitle.dataset.touched || customTitle.value.trim() === "")) {
        customTitle.value = formTitle.value.trim() ? `${formTitle.value.trim()} Out! 🎯` : "";
      }
      syncPushPreview();
    };
  }

  if (formDesc) {
    formDesc.oninput = () => {
      if (toggle.checked && customBody && (!customBody.dataset.touched || customBody.value.trim() === "")) {
        customBody.value = formDesc.value.replace(/<[^>]*>?/gm, '').substring(0, 150);
      }
      syncPushPreview();
    };
  }
}

// Formatting Helper Modal Setup
function setupFormattingGuideModal() {
  const openBtn = document.getElementById("descHelperBtn");
  const closeBtn = document.getElementById("closeGuideModalBtn");
  const modal = document.getElementById("formatGuideModal");

  if (openBtn && modal) {
    openBtn.onclick = () => modal.classList.remove("hidden");
  }
  if (closeBtn && modal) {
    closeBtn.onclick = () => modal.classList.add("hidden");
  }
}

// Auth Role Setup
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const roleSnap = await get(ref(database, `admin_users/${user.uid}/role`));
    currentRole = roleSnap.exists() ? roleSnap.val() : "owner";
  } catch (e) {
    currentRole = "owner";
  }
  setupListener();
});

function setupListener() {
  onValue(ref(database, "results"), (snap) => {
    results = [];
    if (snap.exists()) {
      snap.forEach(child => results.push({ key: child.key, ...child.val() }));
    }
    results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    evaluateTimedResults();
    updateStatusCounters();
    render();
  });
  setInterval(evaluateTimedResults, 30000); // Check every 30 seconds for live conversion
}

function updateStatusCounters() {
  let countAvailable = 0;
  let countTimed = 0;
  let countComingSoon = 0;
  let countAnnounced = 0;

  results.forEach(r => {
    const st = r.status || "";
    if (st === "Result Available" || st === "Live") countAvailable++;
    else if (st === "Coming Soon + Timer") countTimed++;
    else if (st === "Coming Soon") countComingSoon++;
    else if (st === "Date Announced") countAnnounced++;
  });

  const elAll = document.getElementById("countStatusAll");
  const elAvail = document.getElementById("countStatusAvailable");
  const elTimed = document.getElementById("countStatusTimed");
  const elSoon = document.getElementById("countStatusComingSoon");
  const elAnn = document.getElementById("countStatusAnnounced");

  if (elAll) elAll.textContent = results.length;
  if (elAvail) elAvail.textContent = countAvailable;
  if (elTimed) elTimed.textContent = countTimed;
  if (elSoon) elSoon.textContent = countComingSoon;
  if (elAnn) elAnn.textContent = countAnnounced;
}

function updateBulkActionBar() {
  const bar = document.getElementById("bulkActionBar");
  const countEl = document.getElementById("selectedItemsCount");
  const selectAll = document.getElementById("selectAllCheckbox");

  if (!bar) return;
  if (selectedResultKeys.size > 0) {
    bar.classList.remove("hidden");
    if (countEl) countEl.textContent = selectedResultKeys.size;
  } else {
    bar.classList.add("hidden");
  }

  const allVisibleKeys = getFilteredResults().map(r => r.key);
  if (selectAll && allVisibleKeys.length > 0) {
    selectAll.checked = allVisibleKeys.every(k => selectedResultKeys.has(k));
  }
}

function getFilteredResults() {
  return results.filter(r => {
    if (activeCat !== "all" && r.category?.toLowerCase() !== activeCat) return false;
    const st = r.status || "";

    if (activeStatus === "available" && st !== "Result Available" && st !== "Live") return false;
    if (activeStatus === "timed" && st !== "Coming Soon + Timer") return false;
    if (activeStatus === "coming_soon" && st !== "Coming Soon") return false;
    if (activeStatus === "announced" && st !== "Date Announced") return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (r.title || "").toLowerCase().includes(q);
      const matchBoard = (r.boardOrUniversity || "").toLowerCase().includes(q);
      const matchYear = (r.year || "").toLowerCase().includes(q);
      if (!matchTitle && !matchBoard && !matchYear) return false;
    }
    return true;
  });
}

function render() {
  const feed = document.getElementById("resultsFeed");
  if (!feed) return;
  feed.innerHTML = "";

  const filtered = getFilteredResults();

  if (filtered.length === 0) {
    feed.innerHTML = '<p class="text-center text-xs py-12 font-medium" style="color:var(--text-muted);">No results found under this filter.</p>';
    updateBulkActionBar();
    return;
  }

  filtered.forEach(r => {
    const card = document.createElement("div");
    card.className = "p-3.5 rounded-2xl surface-card space-y-2 border transition-all";
    card.style.borderColor = selectedResultKeys.has(r.key) ? "var(--accent-cyan)" : "var(--border-subtle)";

    let statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(4,120,87,0.15); color:var(--accent-mint); border:1px solid rgba(4,120,87,0.3);">Available</span>`;
    if (r.status === "Live") {
      statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(190,18,60,0.15); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.3);">🔴 Live Now</span>`;
    } else if (r.status === "Coming Soon + Timer") {
      statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(180,83,9,0.15); color:var(--accent-amber); border:1px solid rgba(180,83,9,0.3);">⏳ Timed</span>`;
    } else if (r.status === "Coming Soon") {
      statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(180,83,9,0.15); color:var(--accent-amber); border:1px solid rgba(180,83,9,0.3);">Coming Soon</span>`;
    } else if (r.status === "Date Announced") {
      statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(14,116,144,0.15); color:var(--accent-cyan); border:1px solid rgba(14,116,144,0.3);">Announced</span>`;
    }

    // App Link preview logic: agar coming soon hai toh portal link, live/available hai toh server links
    const isLiveOrAvail = r.status === "Result Available" || r.status === "Live";

    card.innerHTML = `
      <div class="flex items-start gap-2.5">
        <input type="checkbox" data-check="${r.key}" ${selectedResultKeys.has(r.key) ? 'checked' : ''} class="w-4 h-4 mt-0.5 rounded accent-cyan-600 cursor-pointer shrink-0">
        
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-1 mb-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold" style="background-color:var(--bg-elevated); color:var(--text-muted); border:1px solid var(--border-subtle);">${escapeHtml(r.category)}</span>
              ${statusPill}
              <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold" style="background-color:var(--bg-elevated); color:${r.notificationSent ? 'var(--accent-mint)' : 'var(--text-subtle)'};">${r.notificationSent ? 'Push Sent' : 'No Push'}</span>
            </div>
            <span class="text-xs font-mono font-bold" style="color:var(--text-muted);">#${escapeHtml(r.id)}</span>
          </div>
          <h3 class="text-xs font-bold line-clamp-1" style="color:var(--text-primary);">${escapeHtml(r.title)}</h3>
        </div>
      </div>

      <div class="text-[11px] flex items-center justify-between pl-6" style="color:var(--text-muted);">
        <span class="truncate">${escapeHtml(r.boardOrUniversity || '')}</span>
        <span class="font-mono font-bold" style="color:var(--text-primary);">${escapeHtml(r.year || '')}</span>
      </div>

      <div class="flex items-center justify-between pt-2 border-t" style="border-color:var(--border-subtle);">
        <div class="flex items-center gap-2">
          ${!isLiveOrAvail && r.portalUrl ? `
            <a href="${escapeHtml(r.portalUrl)}" target="_blank" class="text-[10px] font-bold flex items-center gap-0.5 hover:underline" style="color:var(--accent-amber);">
              <span class="material-symbols-outlined text-12">language</span> Board Portal
            </a>
          ` : `
            <a href="${escapeHtml(r.url)}" target="_blank" class="text-[10px] font-bold flex items-center gap-0.5 hover:underline" style="color:var(--accent-cyan);">
              <span class="material-symbols-outlined text-12">link</span> S1
            </a>
            ${r.url2 ? `<a href="${escapeHtml(r.url2)}" target="_blank" class="text-[10px] font-bold flex items-center gap-0.5 hover:underline" style="color:var(--accent-mint);"><span class="material-symbols-outlined text-12">link</span> S2</a>` : ''}
            ${r.url3 ? `<a href="${escapeHtml(r.url3)}" target="_blank" class="text-[10px] font-bold flex items-center gap-0.5 hover:underline" style="color:var(--accent-amber);"><span class="material-symbols-outlined text-12">link</span> S3</a>` : ''}
          `}
        </div>

        <div class="flex items-center gap-3">
          <button data-key="${r.key}" class="editBtn font-bold text-[11px]" style="color:var(--accent-mint);">Edit</button>
          ${currentRole === 'owner' ? `<button data-key="${r.key}" class="deleteBtn font-bold text-[11px]" style="color:var(--accent-rose);">Delete</button>` : ''}
          <button data-key="${r.key}" class="pushBtn font-bold text-[11px]" style="color:var(--accent-amber);">Send Push</button>
        </div>
      </div>
    `;
    feed.appendChild(card);
  });

  document.querySelectorAll("[data-check]").forEach(chk => {
    chk.addEventListener("change", (e) => {
      const k = e.target.dataset.check;
      if (e.target.checked) selectedResultKeys.add(k);
      else selectedResultKeys.delete(k);
      updateBulkActionBar();
      render();
    });
  });

  document.querySelectorAll(".editBtn").forEach(btn => btn.addEventListener("click", () => openModal(btn.dataset.key)));
  document.querySelectorAll(".deleteBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm("Delete this result permanently?")) {
        await remove(ref(database, `results/${btn.dataset.key}`));
        showToast("Result deleted", "info");
      }
    });
  });

  document.querySelectorAll(".pushBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const item = results.find(x => x.key === btn.dataset.key);
      if (item && confirm(`Broadcast push for "${item.title}"?`)) {
        const payload = {
          target_channel: "push",
          headings: { en: `${item.title} Out! 🎯` },
          contents: { en: item.description ? item.description.replace(/<[^>]*>?/gm, '').substring(0, 150) : "Check your result online." },
          priority_mode: "urgent",
          priority: 10,
          existing_android_channel_id: "Result Alerts",
          android_sound: "default",
          android_visibility: 1,
          android_accent_color: "FF047857",
          data: {
            resultId: String(item.id || ""),
            category: item.category || "",
            openActivity: "ResultDetailActivity",
            url: ""
          },
          buttons: [
            { id: "btn_action_1", text: "Check Result" }
          ]
        };

        const res = await sendPushNotification(payload);
        if (res.success) {
          await update(ref(database, `results/${item.key}`), { notificationSent: true });
          showToast("Push notification dispatched to all devices", "success");
        } else {
          showToast("Push failed: " + (res.errors?.[0] || "Unknown error"), "error");
        }
      }
    });
  });

  updateBulkActionBar();
}

// Bulk Actions
const bulkMakeLiveBtn = document.getElementById("bulkMakeLiveBtn");
if (bulkMakeLiveBtn) {
  bulkMakeLiveBtn.addEventListener("click", async () => {
    if (selectedResultKeys.size === 0) return;
    if (confirm(`Change status of ${selectedResultKeys.size} results to "Result Available"?`)) {
      try {
        const updates = {};
        selectedResultKeys.forEach(k => {
          updates[`results/${k}/status`] = "Result Available";
          updates[`results/${k}/published`] = "Declared Officially";
        });
        await update(ref(database), updates);
        showToast(`${selectedResultKeys.size} results are now Available!`, "success");
        selectedResultKeys.clear();
        updateBulkActionBar();
      } catch (err) {
        showToast("Error updating results: " + err.message, "error");
      }
    }
  });
}

const bulkComingSoonBtn = document.getElementById("bulkComingSoonBtn");
if (bulkComingSoonBtn) {
  bulkComingSoonBtn.addEventListener("click", async () => {
    if (selectedResultKeys.size === 0) return;
    if (confirm(`Change status of ${selectedResultKeys.size} results to "Coming Soon"?`)) {
      try {
        const updates = {};
        selectedResultKeys.forEach(k => {
          updates[`results/${k}/status`] = "Coming Soon";
        });
        await update(ref(database), updates);
        showToast(`${selectedResultKeys.size} results moved to Coming Soon`, "info");
        selectedResultKeys.clear();
        updateBulkActionBar();
      } catch (err) {
        showToast("Error updating results: " + err.message, "error");
      }
    }
  });
}

const selectAllCheckbox = document.getElementById("selectAllCheckbox");
if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener("change", (e) => {
    const visibleResults = getFilteredResults();
    if (e.target.checked) {
      visibleResults.forEach(r => selectedResultKeys.add(r.key));
    } else {
      visibleResults.forEach(r => selectedResultKeys.delete(r.key));
    }
    updateBulkActionBar();
    render();
  });
}

// Bottom Sheet Modal Open/Close
const modalSheet = document.getElementById("resultModalSheet");
function openModal(key = null) {
  editingKey = key;
  document.getElementById("resultModalTitle").textContent = key ? "Edit Exam Result" : "Add Exam Result";
  document.getElementById("resultForm").reset();

  const toggle = document.getElementById("formSendPushToggle");
  const container = document.getElementById("pushPreviewContainer");
  const timerComingSoon = document.getElementById("timerSectionComingSoon");
  const timerAnnounced = document.getElementById("timerSectionAnnounced");

  if (toggle) toggle.checked = false;
  if (container) container.classList.add("hidden");
  if (timerComingSoon) timerComingSoon.classList.add("hidden");
  if (timerAnnounced) timerAnnounced.classList.add("hidden");

  // Reset push inputs & buttons
  [
    "pushCustomTitle", "pushCustomBody", "pushCustomUrl", 
    "pushCustomBigPicture", "pushCustomLargeIcon", 
    "pushCustomBtn1Url", "pushCustomBtn2Text", "pushCustomBtn2Url"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      delete el.dataset.touched;
    }
  });

  const b1Text = document.getElementById("pushCustomBtn1Text");
  if (b1Text) b1Text.value = "Check Result";

  if (key) {
    const r = results.find(x => x.key === key);
    if (!r) return;
    document.getElementById("formResId").value = r.id;
    document.getElementById("formCategory").value = r.category;
    document.getElementById("formTitle").value = r.title;
    document.getElementById("formLabel").value = r.label;
    document.getElementById("formBoard").value = r.boardOrUniversity;
    document.getElementById("formYear").value = r.year;
    document.getElementById("formStatus").value = r.status || "Result Available";
    document.getElementById("formPublished").value = r.published;
    document.getElementById("formPortalUrl").value = r.portalUrl || "";
    document.getElementById("formUrl").value = r.url || "";
    document.getElementById("formUrl2").value = r.url2 || "";
    document.getElementById("formUrl3").value = r.url3 || "";
    document.getElementById("formDescription").value = r.description;

    if (r.timeLive) document.getElementById("formTimeLive").value = r.timeLive;
    if (r.timeAvailable) document.getElementById("formTimeAvailable").value = r.timeAvailable;
    if (r.timeAnnounced) document.getElementById("formTimeAnnounced").value = r.timeAnnounced;

    if (r.status === "Coming Soon + Timer" && timerComingSoon) timerComingSoon.classList.remove("hidden");
    if (r.status === "Date Announced" && timerAnnounced) timerAnnounced.classList.remove("hidden");
  }

  if (modalSheet) modalSheet.classList.remove("hidden");
  setupPushCustomizerEvents();
  setupStatusLogic();
  setupFormattingGuideModal();
}

function closeModal() {
  if (modalSheet) modalSheet.classList.add("hidden");
  editingKey = null;
}

const addBtn = document.getElementById("addResultBtn");
if (addBtn) addBtn.addEventListener("click", () => openModal(null));

const sheetClose = document.getElementById("resultSheetCloseBtn");
if (sheetClose) sheetClose.addEventListener("click", closeModal);

const sheetBack = document.getElementById("resultSheetBackBtn");
if (sheetBack) sheetBack.addEventListener("click", closeModal);

// Form Submit Handler
const resultForm = document.getElementById("resultForm");
if (resultForm) {
  resultForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      id: parseInt(document.getElementById("formResId").value),
      title: document.getElementById("formTitle").value.trim(),
      label: document.getElementById("formLabel").value.trim(),
      category: document.getElementById("formCategory").value,
      boardOrUniversity: document.getElementById("formBoard").value.trim(),
      year: document.getElementById("formYear").value.trim(),
      status: document.getElementById("formStatus").value,
      published: document.getElementById("formPublished").value.trim(),
      portalUrl: document.getElementById("formPortalUrl").value.trim(),
      url: document.getElementById("formUrl").value.trim(),
      url2: document.getElementById("formUrl2").value.trim(),
      url3: document.getElementById("formUrl3").value.trim(),
      timeLive: document.getElementById("formTimeLive")?.value || "",
      timeAvailable: document.getElementById("formTimeAvailable")?.value || "",
      timeAnnounced: document.getElementById("formTimeAnnounced")?.value || "",
      description: document.getElementById("formDescription").value.trim(),
      openActivity: "ResultDetailActivity",
      createdAt: editingKey ? (results.find(x => x.key === editingKey)?.createdAt || Date.now()) : Date.now(),
      notificationSent: editingKey ? (results.find(x => x.key === editingKey)?.notificationSent || false) : false
    };

    const toggle = document.getElementById("formSendPushToggle");
    const customTitle = document.getElementById("pushCustomTitle")?.value.trim();
    const customBody = document.getElementById("pushCustomBody")?.value.trim();
    const customUrl = document.getElementById("pushCustomUrl")?.value.trim();
    const customBigPic = document.getElementById("pushCustomBigPicture")?.value.trim();
    const customLargeIcon = document.getElementById("pushCustomLargeIcon")?.value.trim();
    const b1Text = document.getElementById("pushCustomBtn1Text")?.value.trim() || "Check Result";
    const b1Url = document.getElementById("pushCustomBtn1Url")?.value.trim();
    const b2Text = document.getElementById("pushCustomBtn2Text")?.value.trim();
    const b2Url = document.getElementById("pushCustomBtn2Url")?.value.trim();

    try {
      let targetRefKey = editingKey;

      if (editingKey) {
        await update(ref(database, `results/${editingKey}`), data);
        showToast("Result updated successfully", "success");
      } else {
        const newRef = push(ref(database, "results"));
        await set(newRef, data);
        targetRefKey = newRef.key;
        showToast("Result published to database", "success");
      }

      // DISPATCH RICH PUSH BROADCAST
      if (toggle && toggle.checked) {
        const actionButtons = [];
        // Btn 1: Check Result (If URL is empty, app opens result detail directly)
        if (b1Text) {
          actionButtons.push({ id: "btn_action_1", text: b1Text, url: b1Url || undefined });
        }
        if (b2Text) {
          actionButtons.push({ id: "btn_action_2", text: b2Text, url: b2Url || undefined });
        }

        const oneSignalPayload = {
          target_channel: "push",
          headings: { en: customTitle || `${data.title} Out! 🎯` },
          contents: { en: customBody || (data.description ? data.description.replace(/<[^>]*>?/gm, '').substring(0, 150) : "Tap to check your result now!") },
          priority_mode: "urgent",
          priority: 10,
          existing_android_channel_id: "Result Alerts",
          android_sound: "default",
          android_visibility: 1,
          android_accent_color: "FF047857",
          data: {
            resultId: String(data.id || ""),
            category: data.category || "",
            openActivity: "ResultDetailActivity",
            url: customUrl || ""
          }
        };

        if (customUrl) oneSignalPayload.url = customUrl;
        if (customBigPic) oneSignalPayload.big_picture = customBigPic;
        if (customLargeIcon) oneSignalPayload.large_icon = customLargeIcon;
        if (actionButtons.length > 0) {
          oneSignalPayload.buttons = actionButtons;
          oneSignalPayload.web_buttons = actionButtons;
        }

        const pRes = await sendPushNotification(oneSignalPayload);
        if (pRes.success) {
          if (targetRefKey) {
            await update(ref(database, `results/${targetRefKey}`), { notificationSent: true });
          }
          showToast("Push notification dispatched with media!", "success");
        } else {
          showToast("Push failed: " + (pRes.errors?.[0] || "Unknown rejection"), "error");
        }
      }

      closeModal();
    } catch (err) {
      showToast("Error saving result: " + err.message, "error");
    }
  });
}

// Category Pills Handlers
document.querySelectorAll(".cat-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".cat-pill").forEach(p => {
      p.classList.remove("active");
      p.style.cssText = "border:1px solid var(--border-subtle); background-color:var(--bg-surface); color:var(--text-muted);";
    });
    pill.classList.add("active");
    pill.style.cssText = "border:1px solid var(--accent-mint); background-color:rgba(4,120,87,0.15); color:var(--accent-mint);";
    activeCat = pill.dataset.cat;
    render();
  });
});

// Status Pills Handlers
document.querySelectorAll(".status-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".status-pill").forEach(p => {
      p.classList.remove("active");
      p.style.cssText = "border:1px solid var(--border-subtle); background-color:var(--bg-surface); color:var(--text-muted);";
    });
    pill.classList.add("active");
    pill.style.cssText = "border:1px solid var(--accent-mint); background-color:rgba(4,120,87,0.15); color:var(--accent-mint);";
    activeStatus = pill.dataset.status;
    render();
  });
});

const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    render();
  });
}

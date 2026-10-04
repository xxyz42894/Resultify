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
let parsedResultsToUpload = [];

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
  setTimeout(() => toast.remove(), 4000);
}

// 1. SAFE TIMER ENGINE (Sirf tab trigger hoga jab explicit Coming Soon + Timer status ho)
function evaluateTimedResults() {
  const now = Date.now();
  results.forEach(async (r) => {
    if (r.status === "Coming Soon + Timer" && r.timeLive && r.timeAvailable) {
      const liveTime = new Date(r.timeLive).getTime();
      const availTime = new Date(r.timeAvailable).getTime();

      if (availTime > 0 && now >= availTime) {
        await update(ref(database, `results/${r.key}`), {
          status: "Result Available",
          published: "Declared Officially"
        });
      } else if (liveTime > 0 && now >= liveTime) {
        await update(ref(database, `results/${r.key}`), {
          status: "Live",
          published: "Live Now 🔴"
        });
      }
    }
  });
}

// 2. LIVE SHADE MOCKUP SYNC
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

// 3. AUTH & DATABASE REAL-TIME LISTENER
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
      snap.forEach(child => {
        results.push({ key: child.key, ...child.val() });
      });
    }
    // Sort newest first
    results.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    evaluateTimedResults();
    updateStatusCounters();
    render();
  });
  setInterval(evaluateTimedResults, 30000);
}

function updateStatusCounters() {
  let countAvailable = 0;
  let countTimed = 0;
  let countComingSoon = 0;
  let countAnnounced = 0;

  results.forEach(r => {
    const st = (r.status || "").toLowerCase().trim();
    if (st === "result available" || st === "live" || st === "available") {
      countAvailable++;
    } else if (st.includes("timer")) {
      countTimed++;
    } else if (st.includes("coming soon")) {
      countComingSoon++;
    } else if (st.includes("announced")) {
      countAnnounced++;
    }
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
    // 1. Category Filter
    if (activeCat !== "all") {
      const c = (r.category || "").toLowerCase().trim();
      if (c !== activeCat.toLowerCase()) return false;
    }

    // 2. Status Filter
    if (activeStatus !== "all") {
      const st = (r.status || "").toLowerCase().trim();
      if (activeStatus === "available" && !st.includes("available") && st !== "live") return false;
      if (activeStatus === "timed" && !st.includes("timer")) return false;
      if (activeStatus === "coming_soon" && (!st.includes("coming soon") || st.includes("timer"))) return false;
      if (activeStatus === "announced" && !st.includes("announced")) return false;
    }

    // 3. Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (r.title || "").toLowerCase().includes(q);
      const matchBoard = (r.boardOrUniversity || "").toLowerCase().includes(q);
      const matchYear = String(r.year || "").toLowerCase().includes(q);
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
    const stLower = (r.status || "").toLowerCase();
    
    if (stLower === "live") {
      statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(190,18,60,0.15); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.3);">🔴 Live Now</span>`;
    } else if (stLower.includes("timer")) {
      statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(180,83,9,0.15); color:var(--accent-amber); border:1px solid rgba(180,83,9,0.3);">⏳ Timed</span>`;
    } else if (stLower.includes("coming soon")) {
      statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(180,83,9,0.15); color:var(--accent-amber); border:1px solid rgba(180,83,9,0.3);">Coming Soon</span>`;
    } else if (stLower.includes("announced")) {
      statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(14,116,144,0.15); color:var(--accent-cyan); border:1px solid rgba(14,116,144,0.3);">Announced</span>`;
    }

    const isLiveOrAvail = stLower.includes("available") || stLower === "live";

    card.innerHTML = `
      <div class="flex items-start gap-2.5">
        <input type="checkbox" data-check="${r.key}" ${selectedResultKeys.has(r.key) ? 'checked' : ''} class="w-4 h-4 mt-0.5 rounded accent-cyan-600 cursor-pointer shrink-0">
        
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-1 mb-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold" style="background-color:var(--bg-elevated); color:var(--text-muted); border:1px solid var(--border-subtle);">${escapeHtml(r.category || '10th')}</span>
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
            <a href="${escapeHtml(r.url || '#')}" target="_blank" class="text-[10px] font-bold flex items-center gap-0.5 hover:underline" style="color:var(--accent-cyan);">
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
          buttons: [{ id: "btn_action_1", text: "Check Result" }]
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

// 4. BULK ACTIONS
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

// 5. ADD/EDIT BOTTOM SHEET MODAL
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
    document.getElementById("formCategory").value = r.category || "10th";
    document.getElementById("formTitle").value = r.title || "";
    document.getElementById("formLabel").value = r.label || "";
    document.getElementById("formBoard").value = r.boardOrUniversity || "";
    document.getElementById("formYear").value = r.year || "";
    document.getElementById("formStatus").value = r.status || "Result Available";
    document.getElementById("formPublished").value = r.published || "Declared Officially";
    document.getElementById("formPortalUrl").value = r.portalUrl || "";
    document.getElementById("formUrl").value = r.url || "";
    document.getElementById("formUrl2").value = r.url2 || "";
    document.getElementById("formUrl3").value = r.url3 || "";
    document.getElementById("formDescription").value = r.description || "";

    if (r.timeLive) document.getElementById("formTimeLive").value = r.timeLive;
    if (r.timeAvailable) document.getElementById("formTimeAvailable").value = r.timeAvailable;
    if (r.timeAnnounced) document.getElementById("formTimeAnnounced").value = r.timeAnnounced;

    if (r.status === "Coming Soon + Timer" && timerComingSoon) timerComingSoon.classList.remove("hidden");
    if (r.status === "Date Announced" && timerAnnounced) timerAnnounced.classList.remove("hidden");
  }

  if (modalSheet) modalSheet.classList.remove("hidden");
  setupPushCustomizerEvents();
  setupStatusLogic();
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

// FORM SUBMIT HANDLER
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

      if (toggle && toggle.checked) {
        const actionButtons = [];
        if (b1Text) actionButtons.push({ id: "btn_action_1", text: b1Text, url: b1Url || undefined });
        if (b2Text) actionButtons.push({ id: "btn_action_2", text: b2Text, url: b2Url || undefined });

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
        }
      }

      closeModal();
    } catch (err) {
      showToast("Error saving result: " + err.message, "error");
    }
  });
}

// ====================================================================
// 6. JSON MANAGER ENGINE (POPUP, PARSE & SYNC INDIVIDUALLY + BACKUP)
// ====================================================================
const syncModal = document.getElementById("syncJsonModal");
const openSyncBtn = document.getElementById("openSyncModalBtn");
const closeSyncBtn = document.getElementById("closeSyncModalBtn");
const downloadBackupBtn = document.getElementById("downloadBackupBtn");

const dropZoneArea = document.getElementById("dropZoneArea");
const jsonFileInput = document.getElementById("jsonFileInput");
const selectedFileNameText = document.getElementById("selectedFileNameText");
const startUploadSyncBtn = document.getElementById("startUploadSyncBtn");
const uploadProgressInfo = document.getElementById("uploadProgressInfo");
const uploadStatusText = document.getElementById("uploadStatusText");
const uploadPercentText = document.getElementById("uploadPercentText");

if (openSyncBtn && syncModal) {
  openSyncBtn.onclick = () => {
    syncModal.classList.remove("hidden");
    resetUploadState();
  };
}

if (closeSyncBtn && syncModal) {
  closeSyncBtn.onclick = () => syncModal.classList.add("hidden");
}

function resetUploadState() {
  parsedResultsToUpload = [];
  if (jsonFileInput) jsonFileInput.value = "";
  if (selectedFileNameText) selectedFileNameText.textContent = "Tap to Choose .JSON File";
  if (startUploadSyncBtn) {
    startUploadSyncBtn.disabled = true;
    startUploadSyncBtn.classList.add("opacity-50", "cursor-not-allowed");
    startUploadSyncBtn.innerHTML = `<span class="material-symbols-outlined text-18">sync</span><span>Parse & Sync to Realtime DB</span>`;
  }
  if (uploadProgressInfo) uploadProgressInfo.classList.add("hidden");
}

// A. Timestamped JSON Backup
if (downloadBackupBtn) {
  downloadBackupBtn.addEventListener("click", async () => {
    try {
      downloadBackupBtn.disabled = true;
      downloadBackupBtn.innerHTML = `<span class="material-symbols-outlined text-18 animate-spin">refresh</span> Preparing Backup...`;

      const snap = await get(ref(database, "results"));
      const rawData = snap.exists() ? snap.val() : {};

      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const humanReadableTime = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "medium" });

      const backupPayload = {
        app: "Resultify",
        backup_created_at_human: humanReadableTime,
        backup_timestamp_ms: now.getTime(),
        total_results: Object.keys(rawData).length,
        results: rawData
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const downloadAnchor = document.createElement("a");
      downloadAnchor.href = url;
      downloadAnchor.download = `resultify_backup_${datePart}_${timePart}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);

      showToast(`Backup downloaded! (${backupPayload.total_results} results)`, "success");
    } catch (err) {
      showToast("Backup failed: " + err.message, "error");
    } finally {
      downloadBackupBtn.disabled = false;
      downloadBackupBtn.innerHTML = `<span class="material-symbols-outlined text-18">save_alt</span><span>Download Backup (.json)</span>`;
    }
  });
}

// B. File Select & Validation
if (dropZoneArea && jsonFileInput) {
  dropZoneArea.onclick = () => jsonFileInput.click();

  jsonFileInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      showToast("Kripya sirf valid .json file select karein!", "error");
      return;
    }

    selectedFileNameText.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = JSON.parse(event.target.result);
        let itemsList = [];

        if (Array.isArray(rawJson)) {
          itemsList = rawJson;
        } else if (rawJson.results && (Array.isArray(rawJson.results) || typeof rawJson.results === "object")) {
          itemsList = Array.isArray(rawJson.results) ? rawJson.results : Object.values(rawJson.results);
        } else if (typeof rawJson === "object") {
          itemsList = Object.values(rawJson);
        }

        parsedResultsToUpload = itemsList.filter(item => {
          return item && typeof item === "object" && (item.title || item.name) && (item.id !== undefined || item.resultId !== undefined);
        });

        if (parsedResultsToUpload.length === 0) {
          showToast("JSON file me koi valid result entry nahi mili!", "error");
          startUploadSyncBtn.disabled = true;
          startUploadSyncBtn.classList.add("opacity-50", "cursor-not-allowed");
          return;
        }

        showToast(`${parsedResultsToUpload.length} valid results read from file. Ready to sync!`, "info");
        startUploadSyncBtn.disabled = false;
        startUploadSyncBtn.classList.remove("opacity-50", "cursor-not-allowed");
        startUploadSyncBtn.innerHTML = `<span class="material-symbols-outlined text-18">cloud_upload</span><span>Sync ${parsedResultsToUpload.length} Results to DB</span>`;

      } catch (parseErr) {
        showToast("Invalid JSON syntax in file: " + parseErr.message, "error");
      }
    };
    reader.readAsText(file);
  };
}

// C. Individual Result-by-Result Synchronization
if (startUploadSyncBtn) {
  startUploadSyncBtn.onclick = async () => {
    if (!parsedResultsToUpload || parsedResultsToUpload.length === 0) return;

    const confirmMsg = `${parsedResultsToUpload.length} results ko database me alag-alag sync karna chahte hain?`;
    if (!confirm(confirmMsg)) return;

    startUploadSyncBtn.disabled = true;
    startUploadSyncBtn.classList.add("opacity-50", "cursor-not-allowed");
    if (uploadProgressInfo) uploadProgressInfo.classList.remove("hidden");

    let syncedCount = 0;
    let failedCount = 0;
    const totalToSync = parsedResultsToUpload.length;

    for (let i = 0; i < totalToSync; i++) {
      const item = parsedResultsToUpload[i];

      const cleanData = {
        id: parseInt(item.id || item.resultId) || (Date.now() + i),
        title: String(item.title || item.name || "Untitled Result").trim(),
        label: String(item.label || item.subtitle || "Result Notification").trim(),
        category: String(item.category || "other").toLowerCase().trim(),
        boardOrUniversity: String(item.boardOrUniversity || item.board || "OTHER").toUpperCase().trim(),
        year: String(item.year || new Date().getFullYear()).trim(),
        status: String(item.status || "Result Available").trim(),
        published: String(item.published || "Declared Officially").trim(),
        portalUrl: String(item.portalUrl || item.boardUrl || "").trim(),
        url: String(item.url || item.link || item.server1 || "").trim(),
        url2: String(item.url2 || item.server2 || "").trim(),
        url3: String(item.url3 || item.server3 || "").trim(),
        timeLive: item.timeLive || "",
        timeAvailable: item.timeAvailable || "",
        timeAnnounced: item.timeAnnounced || "",
        description: String(item.description || item.body || item.details || "Official examination marksheet and result.").trim(),
        openActivity: "ResultDetailActivity",
        createdAt: item.createdAt || Date.now(),
        notificationSent: Boolean(item.notificationSent)
      };

      try {
        const newEntryRef = push(ref(database, "results"));
        await set(newEntryRef, cleanData);
        syncedCount++;
      } catch (e) {
        console.warn("Item sync failed:", item, e);
        failedCount++;
      }

      const pct = Math.round(((i + 1) / totalToSync) * 100);
      if (uploadPercentText) uploadPercentText.textContent = `${pct}%`;
      if (uploadStatusText) uploadStatusText.textContent = `Syncing: ${syncedCount}/${totalToSync}...`;
    }

    if (uploadStatusText) {
      uploadStatusText.textContent = `Complete: ${syncedCount} synced successfully!`;
    }

    alert(`Sync Report:\n\n✅ ${syncedCount} Results database me alag-alag kamiyabi se sync ho gaye!\n❌ Failed: ${failedCount}`);
    showToast(`${syncedCount} Results synced to database!`, "success");

    setTimeout(() => {
      syncModal.classList.add("hidden");
      resetUploadState();
    }, 1500);
  };
}

// 7. FILTER PILLS SETUP
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

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { ref, get, set, update, onValue, remove, push } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";
import { sendResultPushNotification } from "./onesignal-api.js";

let currentRole = "viewer";
let results = [];
let editingKey = null;
let activeCat = "all";
let searchQuery = "";

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
    render();
  });
}

function render() {
  const feed = document.getElementById("resultsFeed");
  if (!feed) return;
  feed.innerHTML = "";

  const filtered = results.filter(r => {
    if (activeCat !== "all" && r.category?.toLowerCase() !== activeCat) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (r.title || "").toLowerCase().includes(q);
      const matchBoard = (r.boardOrUniversity || "").toLowerCase().includes(q);
      const matchYear = (r.year || "").toLowerCase().includes(q);
      if (!matchTitle && !matchBoard && !matchYear) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    feed.innerHTML = '<p class="text-center text-xs py-12 font-medium" style="color:var(--text-muted);">No results found under this filter.</p>';
    return;
  }

  filtered.forEach(r => {
    const card = document.createElement("div");
    card.className = "p-3.5 rounded-2xl surface-card space-y-2";

    let statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(4,120,87,0.15); color:var(--accent-mint); border:1px solid rgba(4,120,87,0.3);">Available</span>`;
    if (r.status === "Coming Soon") {
      statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(180,83,9,0.15); color:var(--accent-amber); border:1px solid rgba(180,83,9,0.3);">Coming Soon</span>`;
    } else if (r.status === "Date Announced") {
      statusPill = `<span class="text-[9px] px-2 py-0.5 rounded font-bold" style="background-color:rgba(14,116,144,0.15); color:var(--accent-cyan); border:1px solid rgba(14,116,144,0.3);">Announced</span>`;
    }

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 mb-1 flex-wrap">
            <span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold" style="background-color:var(--bg-elevated); color:var(--text-muted); border:1px solid var(--border-subtle);">${escapeHtml(r.category)}</span>
            ${statusPill}
            <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold" style="background-color:var(--bg-elevated); color:${r.notificationSent ? 'var(--accent-mint)' : 'var(--text-subtle)'};">${r.notificationSent ? 'Push Sent' : 'No Push'}</span>
          </div>
          <h3 class="text-xs font-bold line-clamp-1" style="color:var(--text-primary);">${escapeHtml(r.title)}</h3>
        </div>
        <span class="text-xs font-mono font-bold" style="color:var(--text-muted);">#${escapeHtml(r.id)}</span>
      </div>
      <div class="text-[11px] flex items-center justify-between" style="color:var(--text-muted);">
        <span class="truncate">${escapeHtml(r.boardOrUniversity || '')}</span>
        <span class="font-mono font-bold" style="color:var(--text-primary);">${escapeHtml(r.year || '')}</span>
      </div>
      <div class="flex items-center justify-between pt-2 border-t" style="border-color:var(--border-subtle);">
        <a href="${escapeHtml(r.url)}" target="_blank" class="text-[10px] font-bold flex items-center gap-1 hover:underline" style="color:var(--accent-cyan);">
          <span class="material-symbols-outlined text-12">link</span> Marksheet Link
        </a>
        <div class="flex items-center gap-3">
          <button data-key="${r.key}" class="editBtn font-bold text-[11px]" style="color:var(--accent-mint);">Edit</button>
          ${currentRole === 'owner' ? `<button data-key="${r.key}" class="deleteBtn font-bold text-[11px]" style="color:var(--accent-rose);">Delete</button>` : ''}
          <button data-key="${r.key}" class="pushBtn font-bold text-[11px]" style="color:var(--accent-amber);">Send Push</button>
        </div>
      </div>
    `;
    feed.appendChild(card);
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
        const res = await sendResultPushNotification(item);
        if (res.success) {
          await update(ref(database, `results/${item.key}`), { notificationSent: true });
          showToast("Push notification sent to all devices", "success");
        } else {
          showToast("Push failed: " + (res.errors?.[0] || "Unknown error"), "error");
        }
      }
    });
  });
}

// Bottom Sheet Open/Close
const modalSheet = document.getElementById("resultModalSheet");
function openModal(key = null) {
  editingKey = key;
  document.getElementById("resultModalTitle").textContent = key ? "Edit Exam Result" : "Add Exam Result";
  document.getElementById("resultForm").reset();

  if (key) {
    const r = results.find(x => x.key === key);
    if (!r) return;
    document.getElementById("formResId").value = r.id;
    document.getElementById("formCategory").value = r.category;
    document.getElementById("formTitle").value = r.title;
    document.getElementById("formLabel").value = r.label;
    document.getElementById("formBoard").value = r.boardOrUniversity;
    document.getElementById("formYear").value = r.year;
    document.getElementById("formStatus").value = r.status;
    document.getElementById("formPublished").value = r.published;
    document.getElementById("formUrl").value = r.url;
    document.getElementById("formDescription").value = r.description;
  }
  if (modalSheet) modalSheet.classList.remove("hidden");
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
      url: document.getElementById("formUrl").value.trim(),
      description: document.getElementById("formDescription").value.trim(),
      openActivity: "ResultDetailActivity",
      createdAt: editingKey ? (results.find(x => x.key === editingKey)?.createdAt || Date.now()) : Date.now(),
      notificationSent: editingKey ? (results.find(x => x.key === editingKey)?.notificationSent || false) : false
    };

    try {
      if (editingKey) {
        await update(ref(database, `results/${editingKey}`), data);
        showToast("Result updated successfully", "success");
      } else {
        const newRef = push(ref(database, "results"));
        await set(newRef, data);
        showToast("Result published to database", "success");

        if (document.getElementById("formSendPushToggle")?.checked) {
          const pRes = await sendResultPushNotification(data);
          if (pRes.success) {
            await update(newRef, { notificationSent: true });
            showToast("Push notification dispatched", "success");
          }
        }
      }
      closeModal();
    } catch (err) {
      showToast("Error saving result: " + err.message, "error");
    }
  });
}

// Category Pills
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

const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    render();
  });
}

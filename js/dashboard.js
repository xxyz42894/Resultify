import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { ref, get, set, update, onValue, remove, push } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";
import { getOneSignalOverview, getOneSignalSubscribers, sendPushNotification, sendResultPushNotification } from "./onesignal-api.js";

let currentUser = null;
let currentRole = "viewer";
let results = [];

// Route Guard
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  const emailEl = document.getElementById("userEmailShort");
  if (emailEl) emailEl.textContent = user.email;

  try {
    const roleSnap = await get(ref(database, `admin_users/${user.uid}/role`));
    currentRole = roleSnap.exists() ? roleSnap.val() : "owner";
  } catch (e) {
    currentRole = "owner";
  }

  const badgeEl = document.getElementById("userRoleBadge");
  if (badgeEl) badgeEl.textContent = currentRole.toUpperCase();

  if (currentRole !== "owner") {
    const accessTab = document.getElementById("navItemAccess");
    if (accessTab) accessTab.classList.add("hidden");
  }

  loadInitialData();
});

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => { window.location.href = "index.html"; });
  });
}

// Native Bottom Navigation Switching
const navItems = document.querySelectorAll(".nav-item");
const viewPanels = document.querySelectorAll(".view-panel");

navItems.forEach(btn => {
  btn.addEventListener("click", () => {
    navItems.forEach(b => {
      b.classList.remove("active", "text-teal-400");
      b.classList.add("text-slate-400");
    });
    btn.classList.add("active", "text-teal-400");
    btn.classList.remove("text-slate-400");

    const targetId = btn.dataset.nav;
    viewPanels.forEach(panel => {
      panel.classList.toggle("hidden", panel.id !== targetId);
    });

    if (targetId === "viewDevices") loadDevices();
    if (targetId === "viewAccess") loadAccessControls();
  });
});

// Bottom Sheet Controls
const sheet = document.getElementById("subscriberBottomSheet");
function closeSheet() {
  if (sheet) sheet.classList.add("hidden");
}
const sheetCloseBtn = document.getElementById("sheetCloseBtn");
const sheetBackBtn = document.getElementById("sheetBackBtn");
const sheetBottomCloseBtn = document.getElementById("sheetBottomCloseBtn");

if (sheetCloseBtn) sheetCloseBtn.addEventListener("click", closeSheet);
if (sheetBackBtn) sheetBackBtn.addEventListener("click", closeSheet);
if (sheetBottomCloseBtn) sheetBottomCloseBtn.addEventListener("click", closeSheet);
if (sheet) {
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) closeSheet();
  });
}

// Load Devices
async function loadDevices() {
  const container = document.getElementById("devicesFeed");
  const loading = document.getElementById("devicesLoading");
  if (loading) loading.classList.remove("hidden");
  if (container) container.innerHTML = "";

  const res = await getOneSignalSubscribers({ limit: 50 });
  if (loading) loading.classList.add("hidden");

  if (!res.success || !res.players || !res.players.length) {
    if (container) container.innerHTML = '<p class="text-center text-xs text-slate-500 py-8">No devices registered yet.</p>';
    return;
  }

  res.players.forEach(p => {
    const card = document.createElement("div");
    card.className = "p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between cursor-pointer active:scale-98 transition-all";
    card.innerHTML = `
      <div class="min-w-0 pr-2">
        <h4 class="text-xs font-bold text-slate-100 truncate">${escapeHtml(p.device_model || 'Android Device')}</h4>
        <p class="text-[11px] text-slate-400 font-mono truncate mt-0.5">ID: ${escapeHtml(p.id)}</p>
      </div>
      <span class="material-symbols-outlined text-slate-500 text-18 shrink-0">chevron_right</span>
    `;
    card.addEventListener("click", () => openDeviceSheet(p));
    container.appendChild(card);
  });
}

function openDeviceSheet(p) {
  document.getElementById("sheetModel").textContent = p.device_model || "Android Device";
  document.getElementById("sheetOs").textContent = `Android ${p.device_os || "N/A"}`;
  document.getElementById("sheetAppVer").textContent = p.game_version || "1.0";
  document.getElementById("sheetCountry").textContent = p.country || "IN";
  document.getElementById("sheetCreated").textContent = p.created_at ? new Date(p.created_at * 1000).toLocaleString() : "N/A";
  document.getElementById("sheetLastActive").textContent = p.last_active ? new Date(p.last_active * 1000).toLocaleString() : "N/A";
  document.getElementById("sheetSessions").textContent = p.session_count || 1;
  document.getElementById("sheetDuration").textContent = `${Math.floor((p.playtime || 0) / 60)} min`;
  document.getElementById("sheetOneSignalId").textContent = p.id;
  document.getElementById("sheetPushToken").textContent = p.identifier || "No Push Token Recorded";

  if (sheet) sheet.classList.remove("hidden");
}

// Access Controls
async function loadAccessControls() {
  if (currentRole !== "owner") return;

  const toggle = document.getElementById("toggleGoogleAuth");
  if (toggle) {
    const snap = await get(ref(database, "admin_settings/allowGoogleAuth"));
    toggle.checked = snap.exists() ? snap.val() : true;
    toggle.onchange = async () => {
      await set(ref(database, "admin_settings/allowGoogleAuth"), toggle.checked);
      showToast("Google Auth setting updated", "info");
    };
  }
  await loadPartnersList();
}

async function loadPartnersList() {
  const container = document.getElementById("partnersList");
  if (!container) return;
  const snap = await get(ref(database, "admin_users"));
  if (!snap.exists()) {
    container.innerHTML = '<p class="text-xs text-slate-500 py-2">No partners invited yet.</p>';
    return;
  }
  
  container.innerHTML = "";
  let count = 0;
  snap.forEach(child => {
    const data = child.val();
    if (currentUser && child.key === currentUser.uid) return;
    count++;
    const card = document.createElement("div");
    card.className = "p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between";
    const roleColor = data.role === "editor" ? "text-amber-400 bg-amber-500/10" : "text-blue-400 bg-blue-500/10";
    card.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-teal-400">person</span>
        <div>
          <p class="text-xs font-bold text-slate-100 truncate">${escapeHtml(data.email || data.name)}</p>
          <span class="text-[10px] px-1.5 py-0.2 rounded ${roleColor}">${data.role}</span>
        </div>
      </div>
      <button data-uid="${child.key}" class="revokeBtn px-2 py-1 text-[10px] text-red-400 hover:text-red-300 font-semibold">Revoke</button>
    `;
    container.appendChild(card);
  });

  if (count === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500 py-2">No partners invited yet.</p>';
  }

  document.querySelectorAll(".revokeBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm("Revoke this partner's access?")) {
        await remove(ref(database, `admin_users/${btn.dataset.uid}`));
        loadPartnersList();
      }
    });
  });
}

// Results Management
const resultsFeed = document.getElementById("resultsFeed");
const resultsEmpty = document.getElementById("resultsEmpty");
const searchInput = document.getElementById("searchInput");
const filterPills = document.querySelectorAll(".filter-pill");
let currentFilter = "all";
let searchQuery = "";
let isEditMode = false;
let editingResultKey = null;

function setupResultsListener() {
  const resultsRef = ref(database, "results");
  onValue(resultsRef, (snapshot) => {
    results = [];
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        results.push({ key: child.key, ...child.val() });
      });
    }
    results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    applyFilters();
  });
}

function applyFilters() {
  const filtered = results.filter(r => {
    if (currentFilter !== "all" && r.category !== currentFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (r.title || "").toLowerCase().includes(q);
      const catMatch = (r.category || "").toLowerCase().includes(q);
      const boardMatch = (r.boardOrUniversity || "").toLowerCase().includes(q);
      if (!titleMatch && !catMatch && !boardMatch) return false;
    }
    return true;
  });
  renderResults(filtered);
}

// Clean & Safe HTML Escaper
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderResults(list) {
  if (!resultsFeed) return;
  if (!list || list.length === 0) {
    resultsFeed.innerHTML = "";
    if (resultsEmpty) resultsEmpty.classList.remove("hidden");
    return;
  }
  if (resultsEmpty) resultsEmpty.classList.add("hidden");

  resultsFeed.innerHTML = "";
  list.forEach(r => {
    const card = document.createElement("div");
    card.className = "p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-2";
    const canEdit = currentRole === "owner" || currentRole === "editor";
    const canDelete = currentRole === "owner";
    const pushSent = r.notificationSent;

    let catBadgeColor = "text-slate-400 bg-slate-800";
    if (r.category === "10th") catBadgeColor = "text-purple-400 bg-purple-500/10";
    if (r.category === "12th") catBadgeColor = "text-sky-400 bg-sky-500/10";
    if (r.category === "university") catBadgeColor = "text-pink-400 bg-pink-500/10";

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 mb-1 flex-wrap">
            <span class="text-[10px] px-1.5 py-0.5 rounded font-medium ${catBadgeColor}">${escapeHtml(r.category)}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded ${pushSent ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-400"}">${pushSent ? "Sent" : "Pending"}</span>
          </div>
          <h3 class="text-sm font-bold text-slate-100 line-clamp-1">${escapeHtml(r.title)}</h3>
        </div>
        <div class="flex flex-col items-end gap-0.5 shrink-0">
          <span class="text-[10px] text-slate-500">ID</span>
          <span class="text-xs font-bold text-slate-200 font-mono">${escapeHtml(r.id)}</span>
        </div>
      </div>
      <div class="text-xs text-slate-400 flex items-center justify-between">
        <span class="truncate">${escapeHtml(r.boardOrUniversity || '')}</span>
        <span class="font-medium text-slate-200 shrink-0">${escapeHtml(r.year || '')}</span>
      </div>
      <div class="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
        ${canEdit ? `<button data-key="${r.key}" class="edit-btn text-teal-400 font-semibold text-xs flex items-center gap-1"><span class="material-symbols-outlined text-14">edit</span>Edit</button>` : ''}
        ${canDelete ? `<button data-key="${r.key}" class="delete-btn text-red-400 font-semibold text-xs flex items-center gap-1"><span class="material-symbols-outlined text-14">delete</span>Delete</button>` : ''}
        ${canEdit && !pushSent ? `<button data-key="${r.key}" class="quick-push-btn text-amber-400 font-semibold text-xs flex items-center gap-1"><span class="material-symbols-outlined text-14">send</span>Push</button>` : ''}
      </div>
    `;
    resultsFeed.appendChild(card);
  });

  document.querySelectorAll(".edit-btn").forEach(btn => btn.addEventListener("click", () => openEditModal(btn.dataset.key)));
  document.querySelectorAll(".delete-btn").forEach(btn => btn.addEventListener("click", () => openDeleteModal(btn.dataset.key)));
  document.querySelectorAll(".quick-push-btn").forEach(btn => btn.addEventListener("click", () => sendQuickPush(btn.dataset.key)));
}

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    applyFilters();
  });
}

filterPills.forEach(btn => {
  btn.addEventListener("click", () => {
    filterPills.forEach(b => {
      b.classList.remove("active", "bg-teal-500/10", "border-teal-500/30", "text-teal-300");
      b.classList.add("bg-slate-900", "border-slate-800", "text-slate-400");
    });
    btn.classList.add("active", "bg-teal-500/10", "border-teal-500/30", "text-teal-300");
    btn.classList.remove("bg-slate-900", "border-slate-800", "text-slate-400");
    currentFilter = btn.dataset.filter;
    applyFilters();
  });
});

// Dynamic Bottom Sheet Modals
const resultModal = document.createElement("div");
resultModal.id = "resultModal";
resultModal.className = "fixed inset-0 z-50 hidden bg-black/70 backdrop-blur-sm flex flex-col justify-end";
resultModal.innerHTML = `
  <div class="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl animate-slide-up">
    <div class="w-10 h-1 bg-slate-700 rounded-full mx-auto my-2.5 shrink-0"></div>
    <div class="px-4 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
      <button id="resultBackBtn" class="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center"><span class="material-symbols-outlined text-18">arrow_back</span></button>
      <h3 id="resultModalTitle" class="text-sm font-bold text-white">Add New Result</h3>
      <button id="resultCloseBtn" class="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-18">close</span></button>
    </div>
    <div class="overflow-y-auto p-4 space-y-3 text-xs custom-scrollbar flex-1">
      <form id="resultForm" class="space-y-3">
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Result ID</label><input type="number" id="resultId" required min="1" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"></div>
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Title</label><input type="text" id="resultTitle" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"></div>
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Label</label><input type="text" id="resultLabel" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"></div>
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Category</label><select id="resultCategory" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"><option value="">Select</option><option value="10th">10th</option><option value="12th">12th</option><option value="university">University</option><option value="other">Other</option></select></div>
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Board/University</label><input type="text" id="resultBoard" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"></div>
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Year</label><input type="text" id="resultYear" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"></div>
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Status</label><select id="resultStatus" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"><option value="Result Available">Result Available</option><option value="Coming Soon">Coming Soon</option><option value="Date Announced">Date Announced</option></select></div>
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Published Info</label><input type="text" id="resultPublished" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"></div>
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Official URL</label><input type="url" id="resultUrl" required class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"></div>
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Description</label><textarea id="resultDescription" required rows="2" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"></textarea></div>
        <div><label class="block text-xs font-semibold text-slate-300 mb-1">Open Activity</label><select id="resultOpenActivity" class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100"><option value="ResultDetailActivity">ResultDetailActivity</option><option value="WebViewActivity">WebViewActivity</option></select></div>
        <div class="flex items-center gap-2 pt-2">
          <input type="checkbox" id="resultSendPush" class="w-5 h-5 accent-teal-400">
          <span class="text-xs text-slate-300">Broadcast Push Notification Immediately</span>
        </div>
      </form>
    </div>
    <div class="p-3 border-t border-slate-800 bg-slate-950/80 shrink-0">
      <button type="submit" form="resultForm" id="resultSubmitBtn" class="w-full py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-xs rounded-xl">Publish Result</button>
    </div>
  </div>
`;
document.body.appendChild(resultModal);

const addBtn = document.getElementById("addResultBtn");
if (addBtn) {
  addBtn.addEventListener("click", () => {
    isEditMode = false;
    editingResultKey = null;
    document.getElementById("resultModalTitle").textContent = "Add New Result";
    document.getElementById("resultForm").reset();
    resultModal.classList.remove("hidden");
  });
}

function closeResultModal() {
  resultModal.classList.add("hidden");
}
document.getElementById("resultBackBtn").addEventListener("click", closeResultModal);
document.getElementById("resultCloseBtn").addEventListener("click", closeResultModal);
resultModal.addEventListener("click", (e) => { if (e.target === resultModal) closeResultModal(); });

document.getElementById("resultForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const existingResult = isEditMode ? results.find(r => r.key === editingResultKey) : null;
  const data = {
    id: parseInt(document.getElementById("resultId").value),
    title: document.getElementById("resultTitle").value.trim(),
    label: document.getElementById("resultLabel").value.trim(),
    category: document.getElementById("resultCategory").value,
    boardOrUniversity: document.getElementById("resultBoard").value.trim(),
    year: document.getElementById("resultYear").value.trim(),
    status: document.getElementById("resultStatus").value,
    published: document.getElementById("resultPublished").value.trim(),
    url: document.getElementById("resultUrl").value.trim(),
    description: document.getElementById("resultDescription").value.trim(),
    openActivity: document.getElementById("resultOpenActivity").value || "ResultDetailActivity",
    createdAt: isEditMode ? (existingResult?.createdAt || Date.now()) : Date.now(),
    notificationSent: isEditMode ? (existingResult?.notificationSent || false) : false
  };

  try {
    if (isEditMode) {
      await update(ref(database, `results/${editingResultKey}`), data);
      showToast("Result updated", "success");
    } else {
      const newRef = push(ref(database, "results"));
      await set(newRef, data);
      showToast("Result published", "success");
      if (document.getElementById("resultSendPush").checked) {
        const pushRes = await sendResultPushNotification(data);
        if (pushRes.success) {
          await update(newRef, { notificationSent: true });
          showToast("Push delivered to devices", "success");
        } else {
          showToast("Push failed: " + (pushRes.errors?.[0] || "Unknown error"), "warning");
        }
      }
    }
    closeResultModal();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
});

function openEditModal(key) {
  const r = results.find(x => x.key === key);
  if (!r) return;
  isEditMode = true;
  editingResultKey = key;
  document.getElementById("resultModalTitle").textContent = "Edit Result";
  document.getElementById("resultId").value = r.id;
  document.getElementById("resultTitle").value = r.title;
  document.getElementById("resultLabel").value = r.label;
  document.getElementById("resultCategory").value = r.category;
  document.getElementById("resultBoard").value = r.boardOrUniversity;
  document.getElementById("resultYear").value = r.year;
  document.getElementById("resultStatus").value = r.status;
  document.getElementById("resultPublished").value = r.published;
  document.getElementById("resultUrl").value = r.url;
  document.getElementById("resultDescription").value = r.description;
  document.getElementById("resultOpenActivity").value = r.openActivity || "ResultDetailActivity";
  resultModal.classList.remove("hidden");
}

// Delete Confirmation Modal
const deleteModal = document.createElement("div");
deleteModal.id = "deleteModal";
deleteModal.className = "fixed inset-0 z-50 hidden bg-black/70 backdrop-blur-sm flex flex-col justify-end";
deleteModal.innerHTML = `
  <div class="bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-2xl animate-slide-up p-4 max-w-sm mx-auto w-full">
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400"><span class="material-symbols-outlined">delete</span></div>
      <h3 class="text-sm font-semibold">Delete Result</h3>
    </div>
    <p class="text-xs text-slate-400 mb-4">Are you sure you want to delete <span id="deleteItemName" class="font-medium text-white"></span>?</p>
    <div class="flex gap-2">
      <button id="deleteCancelBtn" class="flex-1 py-2.5 bg-slate-800 text-slate-200 rounded-xl text-xs font-bold">Cancel</button>
      <button id="deleteConfirmBtn" class="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-xs font-bold">Delete</button>
    </div>
  </div>
`;
document.body.appendChild(deleteModal);

let deleteTargetKey = null;
function openDeleteModal(key) {
  const r = results.find(x => x.key === key);
  if (!r) return;
  deleteTargetKey = key;
  document.getElementById("deleteItemName").textContent = r.title;
  deleteModal.classList.remove("hidden");
}
document.getElementById("deleteCancelBtn").addEventListener("click", () => deleteModal.classList.add("hidden"));
document.getElementById("deleteConfirmBtn").addEventListener("click", async () => {
  if (!deleteTargetKey) return;
  await remove(ref(database, `results/${deleteTargetKey}`));
  showToast("Result deleted", "success");
  deleteModal.classList.add("hidden");
  deleteTargetKey = null;
});
deleteModal.addEventListener("click", (e) => { if (e.target === deleteModal) deleteModal.classList.add("hidden"); });

// Quick Push
async function sendQuickPush(key) {
  const r = results.find(x => x.key === key);
  if (!r || !confirm(`Send push for "${r.title}"?`)) return;
  const pushRes = await sendResultPushNotification(r);
  if (pushRes.success) {
    await update(ref(database, `results/${key}`), { notificationSent: true });
    showToast("Push sent successfully", "success");
  } else {
    showToast("Push failed: " + (pushRes.errors?.[0] || "Unknown error"), "error");
  }
}

// Broadcast Form
const bcForm = document.getElementById("broadcastForm");
if (bcForm) {
  bcForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("bcTitle").value.trim();
    const body = document.getElementById("bcBody").value.trim();
    if (!title || !body) return showToast("Title & body required", "warning");

    const res = await sendPushNotification({ title, body });
    if (res.success) {
      showToast(`Broadcast sent (${res.recipients || 0} recipients)`, "success");
      bcForm.reset();
    } else {
      showToast("Broadcast failed: " + (res.errors?.[0] || "Unknown error"), "error");
    }
  });
}

// Partner Invite Form
const adminForm = document.getElementById("addAdminForm");
if (adminForm) {
  adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (currentRole !== "owner") return;
    const email = document.getElementById("partnerEmail").value.trim();
    const role = document.getElementById("partnerRole").value;
    if (!email) return;

    try {
      const userSnap = await get(ref(database, "admin_users"));
      let targetUid = `partner_${Date.now()}`;
      if (userSnap.exists()) {
        userSnap.forEach(child => {
          if (child.val().email === email) targetUid = child.key;
        });
      }
      await set(ref(database, `admin_users/${targetUid}`), {
        email,
        role,
        name: email.split("@")[0],
        addedAt: Date.now(),
        invitedBy: currentUser.uid
      });
      showToast(`Partner invited as ${role}`, "success");
      adminForm.reset();
      await loadPartnersList();
    } catch (err) {
      showToast("Invite failed: " + err.message, "error");
    }
  });
}

// Toast Alert
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  const colors = {
    success: "bg-emerald-500/90 border-emerald-400/50",
    error: "bg-red-500/90 border-red-400/50",
    warning: "bg-amber-500/90 border-amber-400/50",
    info: "bg-blue-500/90 border-blue-400/50"
  };
  const icons = { success: "check_circle", error: "error", warning: "warning", info: "info" };
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[type] || colors.info} text-white shadow-lg backdrop-blur-sm`;
  toast.innerHTML = `<span class="material-symbols-outlined text-20">${icons[type] || "info"}</span><p class="text-sm font-medium flex-1">${escapeHtml(message)}</p>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("translate-x-full", "opacity-0", "transition-all", "duration-300"), 3000);
  setTimeout(() => toast.remove(), 3500);
}

function loadInitialData() {
  setupResultsListener();
}

const refreshDevBtn = document.getElementById("refreshDevicesBtn");
if (refreshDevBtn) refreshDevBtn.addEventListener("click", loadDevices);

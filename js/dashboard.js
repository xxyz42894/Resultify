// Dashboard Module - Results CRUD, Push Notifications, Analytics, Subscribers
import { 
  ref, 
  push, 
  set, 
  update, 
  remove, 
  onValue 
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth, database } from "./firebase-config.js";
import { logout } from "./auth.js";
import { 
  getOneSignalOverview, 
  getOneSignalSubscribers, 
  sendResultPushNotification, 
  sendPushNotification 
} from "./onesignal-api.js";

// HTML Escape Helper
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Top Bar Elements
const adminEmailEl = document.getElementById("adminEmail");
const logoutBtn = document.getElementById("logoutBtn");
const themeToggle = document.getElementById("themeToggle");
const totalSubscribersEl = document.getElementById("totalSubscribers");
const totalResultsEl = document.getElementById("totalResults");
const totalNotificationsEl = document.getElementById("totalNotifications");
const systemStatusEl = document.getElementById("systemStatus");

// Navigation Tabs
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// Results UI
const searchInput = document.getElementById("searchInput");
const filterBtns = document.querySelectorAll(".filter-btn");
const addResultBtn = document.getElementById("addResultBtn");
const emptyAddBtn = document.getElementById("emptyAddBtn");
const resultsGrid = document.getElementById("resultsGrid");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");

// Result Form Modal
const resultModal = document.getElementById("resultModal");
const modalTitle = document.getElementById("modalTitle");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const resultForm = document.getElementById("resultForm");
const submitBtn = document.getElementById("submitBtn");
const submitBtnText = document.getElementById("submitBtnText");
const submitSpinner = document.getElementById("submitSpinner");

// Modal Input Fields
const resultIdInput = document.getElementById("resultId");
const titleInput = document.getElementById("title");
const labelInput = document.getElementById("label");
const categoryInput = document.getElementById("category");
const boardOrUniversityInput = document.getElementById("boardOrUniversity");
const yearInput = document.getElementById("year");
const statusInput = document.getElementById("status");
const publishedInput = document.getElementById("published");
const urlInput = document.getElementById("url");
const descriptionInput = document.getElementById("description");
const openActivityInput = document.getElementById("openActivity");
const sendPushToggle = document.getElementById("sendPushToggle");
const notificationFields = document.getElementById("notificationFields");
const notificationTitleInput = document.getElementById("notificationTitle");
const notificationBodyInput = document.getElementById("notificationBody");

// Delete Modal
const deleteModal = document.getElementById("deleteModal");
const deleteItemName = document.getElementById("deleteItemName");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
const deleteBtnText = document.getElementById("deleteBtnText");
const deleteSpinner = document.getElementById("deleteSpinner");

// Quick Broadcast
const quickPushForm = document.getElementById("quickPushForm");
const quickTitleInput = document.getElementById("quickTitle");
const quickBodyInput = document.getElementById("quickBody");
const quickPushBtn = document.getElementById("quickPushBtn");
const quickPushBtnText = document.getElementById("quickPushBtnText");
const quickPushSpinner = document.getElementById("quickPushSpinner");

// Subscribers Elements
const cardSubscribersClick = document.getElementById("cardSubscribersClick");
const tabBtnSubscribers = document.getElementById("tabBtnSubscribers");
const subscribersListGrid = document.getElementById("subscribersListGrid");
const subscribersLoading = document.getElementById("subscribersLoading");
const subscribersEmpty = document.getElementById("subscribersEmpty");
const refreshSubscribersBtn = document.getElementById("refreshSubscribersBtn");
const subscriberModal = document.getElementById("subscriberModal");
const closeSubModalBtn = document.getElementById("closeSubModalBtn");

// Global Toast
const toastContainer = document.getElementById("toastContainer");

// Application State
let results = [];
let filteredResults = [];
let currentFilter = "all";
let searchQuery = "";
let isEditMode = false;
let editingResultKey = null;
let deleteTargetKey = null;
let deleteTargetName = "";
let subscribersList = [];

// Local environment check
const isLocal = window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1" ||
                window.location.hostname.startsWith("10.") ||
                window.location.hostname.startsWith("192.168.");

// Auth listener
onAuthStateChanged(auth, (user) => {
  if (user && adminEmailEl) {
    adminEmailEl.textContent = user.email || user.displayName || "Admin";
  }
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await logout();
  });
}

// Theme Engine
const THEME_KEY = "resultify_admin_theme";

function getTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return saved || (prefersDark ? "dark" : "light");
  } catch (e) {
    return "dark";
  }
}

function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  const root = document.documentElement;
  if (t === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.setAttribute("data-theme", t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch (e) {}
  const icon = document.getElementById("themeIcon") || themeToggle?.querySelector(".material-symbols-outlined");
  if (icon) {
    icon.textContent = t === "light" ? "light_mode" : "dark_mode";
  }
}

applyTheme(getTheme());

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

// Ripple Effect
document.querySelectorAll(".ripple, button").forEach(btn => {
  btn.addEventListener("click", function(e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement("span");
    ripple.className = "ripple-effect";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
});

// Tab Navigation
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const tabId = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    tabContents.forEach(content => {
      content.classList.add("hidden");
      content.classList.remove("active");
    });
    
    const activeContent = document.getElementById(`tab-${tabId}`);
    if (activeContent) {
      activeContent.classList.remove("hidden");
      activeContent.classList.add("active");
    }

    if (tabId === "subscribers") {
      fetchSubscribersData();
    }
  });
});

// Analytics Overview
async function fetchAnalytics() {
  try {
    const analytics = await getOneSignalOverview();
    if (totalSubscribersEl) {
      totalSubscribersEl.textContent = analytics.totalSubscriptions.toLocaleString();
    }
    if (totalNotificationsEl) {
      totalNotificationsEl.textContent = analytics.messageableSubscriptions.toLocaleString();
    }
    if (systemStatusEl) {
      systemStatusEl.textContent = isLocal ? "Local Dev" : "Online";
      systemStatusEl.classList.remove("text-red-400");
      systemStatusEl.classList.add(isLocal ? "text-teal-400" : "text-green-400");
    }
  } catch (error) {
    console.error("Error fetching analytics:", error);
    if (totalSubscribersEl) totalSubscribersEl.textContent = "—";
    if (totalNotificationsEl) totalNotificationsEl.textContent = "—";
    if (systemStatusEl) {
      systemStatusEl.textContent = "API Error";
      systemStatusEl.classList.add("text-red-400");
    }
  }
}

// Results from Firebase
function fetchResults() {
  const resultsRef = ref(database, "results");
  
  onValue(resultsRef, (snapshot) => {
    results = [];
    let notificationCount = 0;
    
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const result = childSnapshot.val();
        results.push({ key: childSnapshot.key, ...result });
        if (result.notificationSent) notificationCount++;
      });
    }
    
    results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    if (totalResultsEl) totalResultsEl.textContent = results.length.toString();
    if (totalNotificationsEl) totalNotificationsEl.textContent = notificationCount.toString();
    
    applyFilters();
    if (loadingState) loadingState.classList.add("hidden");
    if (results.length === 0 && emptyState) {
      emptyState.classList.remove("hidden");
      emptyState.classList.add("flex");
    }
  }, (error) => {
    console.error("Firebase Error:", error);
    showToast("Error loading results from Firebase", "error");
    if (loadingState) loadingState.classList.add("hidden");
    if (emptyState) {
      emptyState.classList.remove("hidden");
      emptyState.classList.add("flex");
    }
  });
}

function applyFilters() {
  filteredResults = results.filter(result => {
    if (currentFilter !== "all" && result.category !== currentFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = (result.title || "").toLowerCase();
      const cat = (result.category || "").toLowerCase();
      const board = (result.boardOrUniversity || "").toLowerCase();
      if (!title.includes(q) && !cat.includes(q) && !board.includes(q)) return false;
    }
    return true;
  });
  renderResults();
}

function renderResults() {
  if (!resultsGrid) return;
  resultsGrid.innerHTML = "";

  if (filteredResults.length === 0) {
    if (emptyState) {
      emptyState.classList.remove("hidden");
      emptyState.classList.add("flex");
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");
  }

  filteredResults.forEach(result => {
    const card = document.createElement("div");
    card.className = "glass-card rounded-2xl border border-[var(--border-primary)] p-4 sm:p-5 shadow-lg flex flex-col h-full";
    const createdDate = result.createdAt ? new Date(result.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "N/A";
    const statusBadge = getStatusBadge(result.status);
    const categoryBadge = getCategoryBadge(result.category);
    const pushBadge = result.notificationSent 
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs badge-green"><span class="material-symbols-outlined text-14">check_circle</span>Sent</span>'
      : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs badge-gray">Not Sent</span>';

    card.innerHTML = `
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">${categoryBadge}${statusBadge}${pushBadge}</div>
          <h3 class="text-base sm:text-lg font-semibold text-[var(--text-primary)] leading-snug line-clamp-2">${escapeHtml(result.title || '-')}</h3>
          ${result.label && result.label !== result.title ? `<p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 line-clamp-1">${escapeHtml(result.label)}</p>` : ''}
        </div>
        <div class="text-right shrink-0">
          <p class="text-xs text-[var(--text-tertiary)]">ID</p>
          <p class="text-sm font-semibold text-[var(--text-primary)]">${escapeHtml(result.id || '-')}</p>
        </div>
      </div>
      <div class="space-y-2 text-sm mb-4 flex-1">
        <div class="flex items-start justify-between gap-3"><span class="text-[var(--text-secondary)] shrink-0">Board/Univ</span><span class="text-[var(--text-primary)] text-right font-medium line-clamp-2">${escapeHtml(result.boardOrUniversity || '-')}</span></div>
        <div class="flex items-center justify-between gap-3"><span class="text-[var(--text-secondary)]">Year</span><span class="text-[var(--text-primary)] font-medium">${escapeHtml(result.year || '-')}</span></div>
        <div class="flex items-center justify-between gap-3"><span class="text-[var(--text-secondary)]">Published</span><span class="text-[var(--text-primary)] font-medium">${createdDate}</span></div>
        <div class="pt-2 border-t border-[var(--border-primary)]/60"><p class="text-xs text-[var(--text-secondary)] line-clamp-2">${escapeHtml(result.description || '-')}</p></div>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2 mt-auto pt-2 border-t border-[var(--border-primary)]/60">
        <button class="quick-push-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-medium ripple" data-key="${result.key}"><span class="material-symbols-outlined text-16">campaign</span><span>Send Push</span></button>
        <button class="edit-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs font-medium ripple" data-key="${result.key}"><span class="material-symbols-outlined text-16">edit</span><span>Edit</span></button>
        <button class="delete-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-medium ripple" data-key="${result.key}" data-name="${escapeHtml(result.title || 'this result')}"><span class="material-symbols-outlined text-16">delete</span><span>Delete</span></button>
      </div>
    `;
    resultsGrid.appendChild(card);
  });

  document.querySelectorAll(".edit-btn").forEach(btn => btn.addEventListener("click", () => openEditModal(btn.dataset.key)));
  document.querySelectorAll(".delete-btn").forEach(btn => btn.addEventListener("click", () => openDeleteModal(btn.dataset.key, btn.dataset.name)));
  document.querySelectorAll(".quick-push-btn").forEach(btn => btn.addEventListener("click", () => sendQuickPush(btn.dataset.key)));
}

function getStatusBadge(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("available")) return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-green">Result Available</span>';
  if (s.includes("coming")) return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-orange">Coming Soon</span>';
  if (s.includes("announced")) return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-blue">Date Announced</span>';
  return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-gray">Unknown</span>';
}

function getCategoryBadge(category) {
  const c = (category || "").toLowerCase();
  if (c === "10th") return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-10th">10th</span>';
  if (c === "12th") return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-12th">12th</span>';
  if (c === "university") return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-university">University</span>';
  return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-other">Other</span>';
}

// Search & Filter listeners
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    applyFilters();
  });
}

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    applyFilters();
  });
});

// Modal Helpers
function showModal(modal) {
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

function hideModal(modal) {
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

function openAddModal() {
  isEditMode = false;
  editingResultKey = null;
  if (modalTitle) modalTitle.innerHTML = '<span class="material-symbols-outlined text-teal-400">add_circle</span>Add New Result';
  if (submitBtnText) submitBtnText.textContent = "Publish Result";
  if (resultForm) resultForm.reset();
  if (sendPushToggle) sendPushToggle.checked = false;
  if (notificationFields) notificationFields.classList.add("hidden");
  showModal(resultModal);
}

function openEditModal(key) {
  const result = results.find(r => r.key === key);
  if (!result) return;
  isEditMode = true;
  editingResultKey = key;
  if (modalTitle) modalTitle.innerHTML = '<span class="material-symbols-outlined text-teal-400">edit</span>Edit Result';
  if (submitBtnText) submitBtnText.textContent = "Update Result";

  resultIdInput.value = result.id || "";
  titleInput.value = result.title || "";
  labelInput.value = result.label || "";
  categoryInput.value = result.category || "";
  boardOrUniversityInput.value = result.boardOrUniversity || "";
  yearInput.value = result.year || "";
  statusInput.value = result.status || "";
  publishedInput.value = result.published || "";
  urlInput.value = result.url || "";
  descriptionInput.value = result.description || "";
  openActivityInput.value = result.openActivity || "ResultDetailActivity";

  if (sendPushToggle) sendPushToggle.checked = false;
  if (notificationFields) notificationFields.classList.add("hidden");
  showModal(resultModal);
}

if (addResultBtn) addResultBtn.addEventListener("click", openAddModal);
if (emptyAddBtn) emptyAddBtn.addEventListener("click", openAddModal);
if (closeModalBtn) closeModalBtn.addEventListener("click", () => hideModal(resultModal));
if (cancelBtn) cancelBtn.addEventListener("click", () => hideModal(resultModal));

if (titleInput && notificationTitleInput) {
  titleInput.addEventListener("input", () => {
    if (!notificationTitleInput.value) notificationTitleInput.value = titleInput.value;
  });
}

if (sendPushToggle) {
  sendPushToggle.addEventListener("change", () => {
    if (notificationFields) notificationFields.classList.toggle("hidden", !sendPushToggle.checked);
    if (sendPushToggle.checked && notificationTitleInput && titleInput) {
      if (!notificationTitleInput.value) notificationTitleInput.value = titleInput.value;
      if (!notificationBodyInput.value) notificationBodyInput.value = "New result available. Tap to check now!";
    }
  });
}

// Result Form Submit
if (resultForm) {
  resultForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const resultData = {
      id: parseInt(resultIdInput.value),
      title: titleInput.value.trim(),
      label: labelInput.value.trim(),
      category: categoryInput.value,
      boardOrUniversity: boardOrUniversityInput.value.trim(),
      year: yearInput.value.trim(),
      status: statusInput.value,
      published: publishedInput.value.trim(),
      description: descriptionInput.value.trim(),
      url: urlInput.value.trim(),
      openActivity: openActivityInput.value || "ResultDetailActivity",
      createdAt: isEditMode ? (results.find(r => r.key === editingResultKey)?.createdAt || Date.now()) : Date.now(),
      notificationSent: isEditMode ? (results.find(r => r.key === editingResultKey)?.notificationSent || false) : false
    };

    if (submitBtn) submitBtn.disabled = true;
    if (submitSpinner) submitSpinner.classList.remove("hidden");

    try {
      if (isEditMode) {
        await update(ref(database, `results/${editingResultKey}`), resultData);
        showToast("Result updated successfully", "success");
      } else {
        const newRef = push(ref(database, "results"));
        await set(newRef, resultData);
        showToast("Result published successfully", "success");

        if (sendPushToggle.checked) {
          const notifTitle = notificationTitleInput.value.trim() || resultData.title;
          const notifBody = notificationBodyInput.value.trim() || "Tap to check your result now!";
          const pushRes = await sendResultPushNotification(resultData, notifTitle, notifBody);
          if (pushRes.success) {
            await update(newRef, { notificationSent: true });
            showToast("Push broadcast delivered to subscribers", "success");
          } else {
            showToast(`Push failed: ${pushRes.errors?.[0] || "Unknown error"}`, "warning");
          }
        }
      }
      hideModal(resultModal);
    } catch (err) {
      showToast("Error saving result: " + err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (submitSpinner) submitSpinner.classList.add("hidden");
    }
  });
}

// Delete Logic
function openDeleteModal(key, name) {
  deleteTargetKey = key;
  deleteTargetName = name;
  if (deleteItemName) deleteItemName.textContent = name;
  showModal(deleteModal);
}

if (deleteCancelBtn) deleteCancelBtn.addEventListener("click", () => hideModal(deleteModal));
if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener("click", async () => {
    if (!deleteTargetKey) return;
    deleteConfirmBtn.disabled = true;
    if (deleteSpinner) deleteSpinner.classList.remove("hidden");
    try {
      await remove(ref(database, `results/${deleteTargetKey}`));
      showToast("Result deleted successfully", "success");
      hideModal(deleteModal);
    } catch (err) {
      showToast("Error deleting: " + err.message, "error");
    } finally {
      deleteConfirmBtn.disabled = false;
      if (deleteSpinner) deleteSpinner.classList.add("hidden");
    }
  });
}

// Quick Push
async function sendQuickPush(key) {
  const result = results.find(r => r.key === key);
  if (!result || !confirm(`Broadcast push notification for "${result.title}"?`)) return;

  try {
    const res = await sendResultPushNotification(result);
    if (res.success) {
      await update(ref(database, `results/${key}`), { notificationSent: true });
      showToast("Push notification dispatched", "success");
    } else {
      showToast(`Failed: ${res.errors?.[0]}`, "error");
    }
  } catch (err) {
    showToast("Push error: " + err.message, "error");
  }
}

// Quick Broadcast Tab
if (quickPushForm) {
  quickPushForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = quickTitleInput.value.trim();
    const body = quickBodyInput.value.trim();
    if (!title || !body) return;

    if (quickPushBtn) quickPushBtn.disabled = true;
    if (quickPushSpinner) quickPushSpinner.classList.remove("hidden");

    try {
      const res = await sendPushNotification({ title, body });
      if (res.success) {
        showToast(`Broadcast sent (Recipients: ${res.recipients || 0})`, "success");
        quickPushForm.reset();
      } else {
        showToast(`Broadcast failed: ${res.errors?.[0]}`, "error");
      }
    } catch (err) {
      showToast("Broadcast error: " + err.message, "error");
    } finally {
      if (quickPushBtn) quickPushBtn.disabled = false;
      if (quickPushSpinner) quickPushSpinner.classList.add("hidden");
    }
  });
}

// ============ SUBSCRIBERS LOGIC ============
if (cardSubscribersClick && tabBtnSubscribers) {
  cardSubscribersClick.addEventListener("click", () => {
    tabBtnSubscribers.click();
  });
}

async function fetchSubscribersData() {
  if (subscribersLoading) subscribersLoading.classList.remove("hidden");
  if (subscribersEmpty) subscribersEmpty.classList.add("hidden");
  if (subscribersListGrid) subscribersListGrid.innerHTML = "";

  const res = await getOneSignalSubscribers({ limit: 50 });
  if (subscribersLoading) subscribersLoading.classList.add("hidden");

  if (!res.success || !res.players || res.players.length === 0) {
    if (subscribersEmpty) subscribersEmpty.classList.remove("hidden");
    return;
  }

  subscribersList = res.players;
  renderSubscribersList(subscribersList);
}

function formatRelativeTime(timestampSec) {
  if (!timestampSec) return "N/A";
  const diffSec = Math.floor(Date.now() / 1000 - timestampSec);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  return `${Math.floor(diffSec / 86400)} days ago`;
}

function formatDuration(seconds) {
  if (!seconds) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function renderSubscribersList(players) {
  if (!subscribersListGrid) return;
  subscribersListGrid.innerHTML = "";

  players.forEach((player) => {
    const card = document.createElement("div");
    card.className = "glass-card rounded-2xl border admin-border p-4 sm:p-5 flex flex-col justify-between hover:border-teal-400 transition-all cursor-pointer";
    const deviceName = `${player.device_model || "Android Device"} (OS ${player.device_os || "N/A"})`;
    const lastActiveText = formatRelativeTime(player.last_active);
    const country = player.country || "IN";
    const isSubscribed = !player.invalid_identifier;

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs ${isSubscribed ? 'badge-green' : 'badge-orange'}">
            <span class="material-symbols-outlined text-14">${isSubscribed ? 'notifications_active' : 'notifications_off'}</span>
            ${isSubscribed ? 'Subscribed' : 'Inactive'}
          </span>
          <span class="text-xs text-slate-400 font-mono">${country}</span>
        </div>
        <h3 class="text-base font-semibold text-slate-100 flex items-center gap-2">
          <span class="material-symbols-outlined text-teal-400 text-20">smartphone</span>
          ${escapeHtml(deviceName)}
        </h3>
        <p class="text-xs font-mono text-slate-400 truncate mt-1">ID: ${player.id}</p>
        <div class="mt-4 pt-3 border-t admin-border grid grid-cols-2 gap-2 text-xs">
          <div><span class="text-slate-400 block">Sessions:</span><span class="font-semibold text-slate-200">${player.session_count || 1}</span></div>
          <div><span class="text-slate-400 block">Last Active:</span><span class="font-semibold text-slate-200">${lastActiveText}</span></div>
        </div>
      </div>
      <button class="mt-4 w-full py-2 bg-[var(--bg-hover)] border admin-border rounded-xl text-xs font-medium text-teal-400 hover:bg-teal-500/10 transition-colors flex items-center justify-center gap-1.5">
        <span class="material-symbols-outlined text-16">visibility</span> View Full Profile
      </button>
    `;

    card.addEventListener("click", () => openSubscriberModal(player));
    subscribersListGrid.appendChild(card);
  });
}

function openSubscriberModal(player) {
  document.getElementById("subModalDeviceId").textContent = `OneSignal ID: ${player.id}`;
  document.getElementById("subModalDeviceModel").textContent = player.device_model || "Unknown Device";
  document.getElementById("subModalDeviceOs").textContent = `Android ${player.device_os || "N/A"}`;
  document.getElementById("subModalCountry").textContent = player.country ? `${player.country} (Timezone: ${player.timezone || "Asia/Kolkata"})` : "India (IN)";
  document.getElementById("subModalAppVersion").textContent = player.game_version || "1.0";

  document.getElementById("subModalCreatedAt").textContent = player.created_at ? new Date(player.created_at * 1000).toLocaleString("en-IN") : "N/A";
  document.getElementById("subModalLastActive").textContent = player.last_active ? `${new Date(player.last_active * 1000).toLocaleString("en-IN")} (${formatRelativeTime(player.last_active)})` : "N/A";
  document.getElementById("subModalSessions").textContent = player.session_count || 1;
  document.getElementById("subModalDuration").textContent = formatDuration(player.playtime || 0);

  document.getElementById("subModalIp").textContent = player.ip || "Hidden / N/A";
  document.getElementById("subModalSdk").textContent = player.sdk || "051002 (SDK v5)";
  document.getElementById("subModalToken").textContent = player.identifier || "No Push Token Recorded";

  const badge = document.getElementById("subModalStatusBadge");
  if (player.invalid_identifier) {
    badge.className = "text-xs px-2 py-0.5 rounded-full badge-orange";
    badge.textContent = "Unsubscribed";
  } else {
    badge.className = "text-xs px-2 py-0.5 rounded-full badge-green";
    badge.textContent = "Subscribed";
  }

  showModal(subscriberModal);
}

if (closeSubModalBtn) closeSubModalBtn.addEventListener("click", () => hideModal(subscriberModal));
if (refreshSubscribersBtn) refreshSubscribersBtn.addEventListener("click", fetchSubscribersData);

// Toast Engine
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  const bgColors = {
    success: "bg-green-500/90 border-green-400/50",
    error: "bg-red-500/90 border-red-400/50",
    warning: "bg-amber-500/90 border-amber-400/50",
    info: "bg-blue-500/90 border-blue-400/50"
  };
  const icons = {
    success: "check_circle",
    error: "error",
    warning: "warning",
    info: "info"
  };

  toast.className = `toast-enter flex items-center gap-3 px-4 py-3 rounded-xl border ${bgColors[type]} text-white shadow-lg backdrop-blur-sm max-w-sm`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-20">${icons[type]}</span>
    <p class="text-sm font-medium flex-1">${message}</p>
    <button class="toast-close flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/20">
      <span class="material-symbols-outlined text-16">close</span>
    </button>
  `;

  if (toastContainer) toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove("toast-enter");
    toast.classList.add("toast-enter-active");
  }, 10);

  const autoRemove = setTimeout(() => removeToast(toast), 4000);
  toast.querySelector(".toast-close").addEventListener("click", () => {
    clearTimeout(autoRemove);
    removeToast(toast);
  });
}

function removeToast(toast) {
  toast.classList.remove("toast-enter-active");
  toast.classList.add("toast-exit-active");
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}

// Bootstrapping
function init() {
  fetchAnalytics();
  fetchResults();
  setInterval(fetchAnalytics, 30000);
}

init();

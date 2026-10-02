// Dashboard Module - Results CRUD, Push Notifications, Analytics
import { 
  ref, 
  push, 
  set, 
  update, 
  remove, 
  onValue, 
  query, 
  orderByChild 
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth, database } from "./firebase-config.js";
import { logout } from "./auth.js";
import { 
  getOneSignalOverview, 
  sendResultPushNotification, 
  sendPushNotification 
} from "./onesignal-api.js";

// HTML Escape Helper (XSS prevention & missing reference fix)
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// DOM Elements
const adminEmailEl = document.getElementById("adminEmail");
const logoutBtn = document.getElementById("logoutBtn");
const themeToggle = document.getElementById("themeToggle");
const totalSubscribersEl = document.getElementById("totalSubscribers");
const totalResultsEl = document.getElementById("totalResults");
const totalNotificationsEl = document.getElementById("totalNotifications");
const systemStatusEl = document.getElementById("systemStatus");

// Tabs
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// Results Management
const searchInput = document.getElementById("searchInput");
const filterBtns = document.querySelectorAll(".filter-btn");
const addResultBtn = document.getElementById("addResultBtn");
const emptyAddBtn = document.getElementById("emptyAddBtn");
const resultsTableBody = document.getElementById("resultsTableBody");
const resultsGrid = document.getElementById("resultsGrid");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");

// Result Modal
const resultModal = document.getElementById("resultModal");
const modalTitle = document.getElementById("modalTitle");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const resultForm = document.getElementById("resultForm");
const submitBtn = document.getElementById("submitBtn");
const submitBtnText = document.getElementById("submitBtnText");
const submitSpinner = document.getElementById("submitSpinner");

// Modal Form Fields
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

// Quick Push
const quickPushForm = document.getElementById("quickPushForm");
const quickTitleInput = document.getElementById("quickTitle");
const quickBodyInput = document.getElementById("quickBody");
const quickPushBtn = document.getElementById("quickPushBtn");
const quickPushBtnText = document.getElementById("quickPushBtnText");
const quickPushSpinner = document.getElementById("quickPushSpinner");

// Toast
const toastContainer = document.getElementById("toastContainer");

// State
let results = [];
let filteredResults = [];
let currentFilter = "all";
let searchQuery = "";
let isEditMode = false;
let editingResultKey = null;
let deleteTargetKey = null;
let deleteTargetName = "";

// Auth State
onAuthStateChanged(auth, (user) => {
  if (user && adminEmailEl) {
    adminEmailEl.textContent = user.email || user.displayName || "Admin";
  }
});

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await logout();
  });
}

// Theme Management
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

// Add ripple effect to buttons
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

// Tabs
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
  });
});

// Detect local environment
const isLocal = window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1" ||
                window.location.hostname.startsWith("10.") ||
                window.location.hostname.startsWith("192.168.");

// Fetch OneSignal Overview
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
      if (isLocal) {
        systemStatusEl.textContent = "Local Dev";
        systemStatusEl.classList.remove("text-red-400", "text-green-400");
        systemStatusEl.classList.add("text-teal-400");
      } else {
        systemStatusEl.textContent = "Online";
        systemStatusEl.classList.remove("text-red-400");
        systemStatusEl.classList.add("text-green-400");
      }
    }
  } catch (error) {
    console.error("Error fetching analytics:", error);
    if (totalSubscribersEl) {
      totalSubscribersEl.textContent = "—";
    }
    if (totalNotificationsEl) {
      totalNotificationsEl.textContent = "—";
    }
    if (systemStatusEl) {
      if (isLocal) {
        systemStatusEl.textContent = "Local Dev";
        systemStatusEl.classList.remove("text-red-400", "text-green-400");
        systemStatusEl.classList.add("text-teal-400");
      } else {
        systemStatusEl.textContent = "API Error";
        systemStatusEl.classList.remove("text-green-400");
        systemStatusEl.classList.add("text-red-400");
      }
    }
    if (!isLocal) {
      showToast(`OneSignal API: ${error.message}`, "error");
    }
  }
}

// Fetch Results from Firebase
function fetchResults() {
  const resultsRef = ref(database, "results");
  
  onValue(resultsRef, (snapshot) => {
    results = [];
    let notificationCount = 0;
    
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        const result = childSnapshot.val();
        results.push({
          key: childSnapshot.key,
          ...result
        });
        if (result.notificationSent) {
          notificationCount++;
        }
      });
    }
    
    // Sort by createdAt descending
    results.sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return timeB - timeA;
    });
    
    // Update counts
    if (totalResultsEl) {
      totalResultsEl.textContent = results.length.toString();
    }
    if (totalNotificationsEl) {
      totalNotificationsEl.textContent = notificationCount.toString();
    }
    
    // Apply filters
    applyFilters();
    
    if (loadingState) {
      loadingState.classList.add("hidden");
    }
    if (results.length === 0) {
      if (emptyState) { emptyState.classList.remove("hidden"); emptyState.classList.add("flex"); }
    }
  }, (error) => {
    console.error("Error fetching results:", error);
    showToast("Error loading results from Firebase", "error");
    if (loadingState) { loadingState.classList.add("hidden"); }
    if (emptyState) { emptyState.classList.remove("hidden"); emptyState.classList.add("flex"); }
  });
}

// Apply Search and Filter
function applyFilters() {
  filteredResults = results.filter(result => {
    // Filter by category
    if (currentFilter !== "all" && result.category !== currentFilter) {
      return false;
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const title = (result.title || "").toLowerCase();
      const category = (result.category || "").toLowerCase();
      const board = (result.boardOrUniversity || "").toLowerCase();
      if (!title.includes(query) && !category.includes(query) && !board.includes(query)) {
        return false;
      }
    }
    
    return true;
  });
  
  renderResults();
}

// Render Results (Cards)
function renderResults() {
  const grid = document.getElementById("resultsGrid");
  if (grid) grid.innerHTML = "";
  if (filteredResults.length === 0) {
    if (emptyState) { emptyState.classList.remove("hidden"); emptyState.classList.add("flex"); }
    return;
  }
  if (emptyState) { emptyState.classList.add("hidden"); emptyState.classList.remove("flex"); }
  filteredResults.forEach(result => {
    const card = document.createElement("div");
    card.className = "glass-card rounded-2xl border border-[var(--border-primary)] p-4 sm:p-5 shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full";
    const createdDate = result.createdAt ? new Date(result.createdAt).toLocaleDateString("en-IN",{year:"numeric",month:"short",day:"numeric"}) : "N/A";
    const statusBadge = getStatusBadge(result.status);
    const categoryBadge = getCategoryBadge(result.category);
    const pushBadge = result.notificationSent ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs badge-green"><span class="material-symbols-outlined text-14">check_circle</span>Sent</span>' : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs badge-gray">Not Sent</span>';
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1.5 flex-wrap">${categoryBadge}${statusBadge}${pushBadge}</div>
          <h3 class="text-base sm:text-lg font-semibold text-[var(--text-primary)] leading-snug line-clamp-2" title="${escapeHtml(result.title||'')}">${escapeHtml(result.title||'-')}</h3>
          ${result.label && result.label!==result.title ? '<p class="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 line-clamp-1" title="'+escapeHtml(result.label)+'">'+escapeHtml(result.label)+'</p>' : ''}
        </div>
        <div class="text-right shrink-0"><p class="text-xs text-[var(--text-tertiary)]">ID</p><p class="text-sm font-semibold text-[var(--text-primary)]">${escapeHtml(result.id||'-')}</p></div>
      </div>
      <div class="space-y-2 text-sm mb-4 flex-1">
        <div class="flex items-start justify-between gap-3"><span class="text-[var(--text-secondary)] shrink-0">Board/University</span><span class="text-[var(--text-primary)] text-right font-medium line-clamp-2" title="${escapeHtml(result.boardOrUniversity||'')}">${escapeHtml(result.boardOrUniversity||'-')}</span></div>
        <div class="flex items-center justify-between gap-3"><span class="text-[var(--text-secondary)]">Year</span><span class="text-[var(--text-primary)] font-medium">${escapeHtml(result.year||'-')}</span></div>
        <div class="flex items-center justify-between gap-3"><span class="text-[var(--text-secondary)]">Created At</span><span class="text-[var(--text-primary)] font-medium">${createdDate}</span></div>
        <div class="pt-2 border-t border-[var(--border-primary)]/60"><p class="text-xs text-[var(--text-secondary)] line-clamp-2" title="${escapeHtml(result.description||'')}">${escapeHtml(result.description||'-')}</p></div>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2 mt-auto pt-2 border-t border-[var(--border-primary)]/60">
        <button class="quick-push-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors text-xs font-medium ripple" data-key="${result.key}"><span class="material-symbols-outlined text-16">campaign</span><span>Send Push</span></button>
        <button class="edit-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-medium ripple" data-key="${result.key}"><span class="material-symbols-outlined text-16">edit</span><span>Edit</span></button>
        <button class="delete-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors text-xs font-medium ripple" data-key="${result.key}" data-name="${escapeHtml(result.title||'this result')}"><span class="material-symbols-outlined text-16">delete</span><span>Delete</span></button>
      </div>
    `;
    const gridEl = document.getElementById("resultsGrid");
    if (gridEl) gridEl.appendChild(card);
  });
  document.querySelectorAll(".edit-btn").forEach(btn=>{btn.addEventListener("click",()=>openEditModal(btn.dataset.key))});
  document.querySelectorAll(".delete-btn").forEach(btn=>{btn.addEventListener("click",()=>openDeleteModal(btn.dataset.key,btn.dataset.name))});
  document.querySelectorAll(".quick-push-btn").forEach(btn => {
    btn.addEventListener("click", () => sendQuickPush(btn.dataset.key));
  });
}
function getStatusBadge(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("available")) {
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-green">Result Available</span>';
  } else if (s.includes("coming")) {
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-orange">Coming Soon</span>';
  } else if (s.includes("announced")) {
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-blue">Date Announced</span>';
  }
  return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-gray">Unknown</span>';
}

function getCategoryBadge(category) {
  const c = (category || "").toLowerCase();
  if (c === "10th") {
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-10th">10th</span>';
  } else if (c === "12th") {
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-12th">12th</span>';
  } else if (c === "university") {
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-university">University</span>';
  } else if (c === "other") {
    return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-other">Other</span>';
  }
  return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs badge-gray">-</span>';
}

// Search
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    applyFilters();
  });
}

// Filters
filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    applyFilters();
  });
});

// Modal Controls
function openAddModal() {
  isEditMode = false;
  editingResultKey = null;
  if (modalTitle) {
    modalTitle.innerHTML = '<span class="material-symbols-outlined text-teal-400">add_circle</span>Add New Result';
  }
  if (submitBtnText) {
    submitBtnText.textContent = "Publish Result";
  }
  resultForm.reset();
  if (sendPushToggle) sendPushToggle.checked = false;
  if (notificationFields) notificationFields.classList.add("hidden");
  if (resultIdInput) resultIdInput.focus();
  showModal(resultModal);
}

function openEditModal(key) {
  const result = results.find(r => r.key === key);
  if (!result) return;
  
  isEditMode = true;
  editingResultKey = key;
  
  if (modalTitle) {
    modalTitle.innerHTML = '<span class="material-symbols-outlined text-teal-400">edit</span>Edit Result';
  }
  if (submitBtnText) {
    submitBtnText.textContent = "Update Result";
  }
  
  // Populate form
  if (resultIdInput) resultIdInput.value = result.id || "";
  if (titleInput) titleInput.value = result.title || "";
  if (labelInput) labelInput.value = result.label || "";
  if (categoryInput) categoryInput.value = result.category || "";
  if (boardOrUniversityInput) boardOrUniversityInput.value = result.boardOrUniversity || "";
  if (yearInput) yearInput.value = result.year || "";
  if (statusInput) statusInput.value = result.status || "";
  if (publishedInput) publishedInput.value = result.published || "";
  if (urlInput) urlInput.value = result.url || "";
  if (descriptionInput) descriptionInput.value = result.description || "";
  if (openActivityInput) openActivityInput.value = result.openActivity || "ResultDetailActivity";
  
  if (sendPushToggle) sendPushToggle.checked = false;
  if (notificationFields) notificationFields.classList.add("hidden");
  
  showModal(resultModal);
}

function showModal(modal) {
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.classList.add("modal-backdrop");
    const content = modal.querySelector(".glass-card");
    if (content) content.classList.add("modal-content");
  }
}

function hideModal(modal) {
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.classList.remove("modal-backdrop");
    const content = modal.querySelector(".glass-card");
    if (content) content.classList.remove("modal-content");
  }
}

// Modal Events
if (addResultBtn) addResultBtn.addEventListener("click", openAddModal);
if (emptyAddBtn) emptyAddBtn.addEventListener("click", openAddModal);
if (closeModalBtn) closeModalBtn.addEventListener("click", () => hideModal(resultModal));
if (cancelBtn) cancelBtn.addEventListener("click", () => hideModal(resultModal));

// Close modal on backdrop click
if (resultModal) {
  resultModal.addEventListener("click", (e) => {
    if (e.target === resultModal) hideModal(resultModal);
  });
}

// Auto-fill notification fields when title changes
if (titleInput) {
  titleInput.addEventListener("input", () => {
    if (notificationTitleInput && !notificationTitleInput.value) {
      notificationTitleInput.value = titleInput.value;
    }
  });
}

// Toggle notification fields
if (sendPushToggle) {
  sendPushToggle.addEventListener("change", () => {
    if (notificationFields) {
      notificationFields.classList.toggle("hidden", !sendPushToggle.checked);
    }
    if (sendPushToggle.checked && notificationTitleInput && titleInput) {
      if (!notificationTitleInput.value) {
        notificationTitleInput.value = titleInput.value;
      }
      if (!notificationBodyInput.value) {
        notificationBodyInput.value = "New result available. Tap to check now!";
      }
    }
  });
}

// Submit Result Form
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
    
    setSubmitLoading(true);
    
    try {
      let pushSent = false;
      
      if (isEditMode) {
        // Update existing result
        const resultRef = ref(database, `results/${editingResultKey}`);
        await update(resultRef, resultData);
        showToast("Result updated successfully", "success");
      } else {
        // Create new result
        const resultsRef = ref(database, "results");
        const newResultRef = push(resultsRef);
        await set(newResultRef, resultData);
        showToast("Result published successfully", "success");
        
        // Send push notification if toggle is ON
        if (sendPushToggle.checked) {
          const notifTitle = notificationTitleInput.value.trim() || resultData.title;
          const notifBody = notificationBodyInput.value.trim() || "Tap to check your result now!";
          
          const pushResult = await sendResultPushNotification(resultData, notifTitle, notifBody);
          
          if (pushResult.success) {
            // Update notificationSent flag
            await update(newResultRef, { notificationSent: true });
            showToast("Push notification sent to all subscribed users", "success");
            pushSent = true;
          } else {
            showToast(`Push failed: ${pushResult.errors?.[0] || "Unknown error"}`, "warning");
          }
        }
      }
      
      hideModal(resultModal);
    } catch (error) {
      console.error("Error saving result:", error);
      showToast("Error saving result: " + error.message, "error");
    } finally {
      setSubmitLoading(false);
    }
  });
}

function setSubmitLoading(loading) {
  if (submitBtn) submitBtn.disabled = loading;
  if (submitBtnText) submitBtnText.textContent = loading ? "Publishing..." : (isEditMode ? "Update Result" : "Publish Result");
  if (submitSpinner) submitSpinner.classList.toggle("hidden", !loading);
}

// Delete Modal
function openDeleteModal(key, name) {
  deleteTargetKey = key;
  deleteTargetName = name;
  if (deleteItemName) deleteItemName.textContent = name;
  showModal(deleteModal);
}

function closeDeleteModal() {
  hideModal(deleteModal);
  deleteTargetKey = null;
  deleteTargetName = "";
}

if (deleteCancelBtn) deleteCancelBtn.addEventListener("click", closeDeleteModal);
if (deleteModal) {
  deleteModal.addEventListener("click", (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });
}

if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener("click", async () => {
    if (!deleteTargetKey) return;
    
    setDeleteLoading(true);
    
    try {
      const resultRef = ref(database, `results/${deleteTargetKey}`);
      await remove(resultRef);
      showToast("Result deleted successfully", "success");
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting result:", error);
      showToast("Error deleting result: " + error.message, "error");
    } finally {
      setDeleteLoading(false);
    }
  });
}

function setDeleteLoading(loading) {
  if (deleteConfirmBtn) deleteConfirmBtn.disabled = loading;
  if (deleteBtnText) deleteBtnText.textContent = loading ? "Deleting..." : "Delete";
  if (deleteSpinner) deleteSpinner.classList.toggle("hidden", !loading);
}

// Quick Push for specific result
async function sendQuickPush(key) {
  const result = results.find(r => r.key === key);
  if (!result) return;
  
  const confirmed = confirm(`Send push notification for "${result.title}" to all subscribers?`);
  if (!confirmed) return;
  
  try {
    const pushResult = await sendResultPushNotification(result);
    if (pushResult.success) {
      // Update notificationSent flag
      const resultRef = ref(database, `results/${key}`);
      await update(resultRef, { notificationSent: true });
      showToast("Push notification sent successfully", "success");
    } else {
      showToast(`Push failed: ${pushResult.errors?.[0] || "Unknown error"}`, "error");
    }
  } catch (error) {
    console.error("Error sending quick push:", error);
    showToast("Error sending push notification", "error");
  }
}

// Quick Broadcast Form
if (quickPushForm) {
  quickPushForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const title = quickTitleInput.value.trim();
    const body = quickBodyInput.value.trim();
    
    if (!title || !body) {
      showToast("Title and message are required", "warning");
      return;
    }
    
    setQuickPushLoading(true);
    
    try {
      const pushResult = await sendPushNotification({ title, body });
      if (pushResult.success) {
        showToast(`Broadcast sent (ID: ${pushResult.id}, recipients: ${pushResult.recipients || "?"})`, "success");
        quickPushForm.reset();
      } else {
        showToast(`Broadcast failed: ${pushResult.errors?.[0] || "Unknown error"}`, "error");
      }
    } catch (error) {
      console.error("Error sending broadcast:", error);
      showToast("Error sending broadcast", "error");
    } finally {
      setQuickPushLoading(false);
    }
  });
}

function setQuickPushLoading(loading) {
  if (quickPushBtn) quickPushBtn.disabled = loading;
  if (quickPushBtnText) quickPushBtnText.textContent = loading ? "Sending..." : "Send Broadcast";
  if (quickPushSpinner) quickPushSpinner.classList.toggle("hidden", !loading);
}

// Toast System
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
    <button class="toast-close flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/20 transition-colors">
      <span class="material-symbols-outlined text-16">close</span>
    </button>
  `;
  
  if (toastContainer) {
    toastContainer.appendChild(toast);
  }
  
  setTimeout(() => {
    toast.classList.remove("toast-enter");
    toast.classList.add("toast-enter-active");
  }, 10);
  
  const autoRemoveTimeout = setTimeout(() => {
    removeToast(toast);
  }, 4000);
  
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => {
    clearTimeout(autoRemoveTimeout);
    removeToast(toast);
  });
}

function removeToast(toast) {
  toast.classList.remove("toast-enter-active");
  toast.classList.add("toast-exit-active");
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

// Initialize
function init() {
  fetchAnalytics();
  fetchResults();
  // Refresh analytics every 30 seconds
  setInterval(fetchAnalytics, 30000);
}

// Start
init();
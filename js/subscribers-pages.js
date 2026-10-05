import { getOneSignalSubscribers, deleteOneSignalSubscriber } from "./onesignal-api.js";

let players = [];
let searchQuery = "";
let timeFilter = "all";
let activePlayerBeingInspected = null;

// Map to identify Duplicate/Ghost Devices
let duplicateMap = new Map(); // Key: ip_model_os -> Array of subscribers

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

function formatRelativeTime(sec) {
  if (!sec) return "Never";
  const diff = Math.floor(Date.now() / 1000 - sec);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDateTime(timestampSec) {
  if (!timestampSec) return "N/A";
  const d = new Date(timestampSec * 1000);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function formatPlaytime(sec) {
  if (!sec) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function translateDeviceName(model) {
  if (!model) return "Android Device";
  const m = model.toUpperCase();
  if (m === "RMX1971") return "Realme realme Q";
  if (m.startsWith("RMX")) return `Realme (${model})`;
  if (m.startsWith("SM-")) return `Samsung Galaxy (${model})`;
  if (m.startsWith("M20") || m.startsWith("220") || m.startsWith("230")) return `Redmi/Xiaomi (${model})`;
  if (m.startsWith("V2")) return `Vivo (${model})`;
  if (m.startsWith("CPH")) return `Oppo (${model})`;
  return model;
}

function isUninstalledOrOptedOut(p) {
  return Boolean(p.invalid_identifier || p.opted_out || p.notification_types === -2);
}

// Build fingerprint key using Device Model, OS and IP address
function getDeviceFingerprint(p) {
  const model = String(p.device_model || "unknown").toLowerCase().trim();
  const os = String(p.device_os || "unknown").toLowerCase().trim();
  const ip = String(p.ip || "").trim();

  // Agar IP available hai toh accurate key, warna model + os
  if (ip && ip !== "not recorded") {
    return `${ip}___${model}___${os}`;
  }
  return `${model}___${os}`;
}

// Compute duplicate device clusters
function computeDuplicateMap(subList) {
  duplicateMap = new Map();
  subList.forEach(p => {
    const key = getDeviceFingerprint(p);
    if (!duplicateMap.has(key)) {
      duplicateMap.set(key, []);
    }
    duplicateMap.get(key).push(p);
  });
}

// Main Fetcher
async function loadSubscribers() {
  const feed = document.getElementById("devicesFeed");
  if (!feed) return;

  feed.innerHTML = '<p class="text-center text-xs py-12 font-medium" style="color:var(--text-muted);">Fetching subscriber registry from OneSignal...</p>';

  try {
    const res = await getOneSignalSubscribers();
    feed.innerHTML = "";

    if (!res.success || !res.players || res.players.length === 0) {
      feed.innerHTML = '<p class="text-center text-xs py-12 font-medium" style="color:var(--text-muted);">No subscribed devices found.</p>';
      updateTelemetryCounters([], 0, 0, 0, 0);
      return;
    }

    players = res.players;
    computeDuplicateMap(players);
    applyFiltersAndRender();
  } catch (err) {
    if (feed) feed.innerHTML = `<div class="p-4 rounded-xl border text-center text-xs text-rose-500">${escapeHtml(err.message)}</div>`;
  }
}

// Filter & Render Engine
function applyFiltersAndRender() {
  const feed = document.getElementById("devicesFeed");
  if (!feed) return;
  feed.innerHTML = "";

  const nowSec = Math.floor(Date.now() / 1000);
  let onlineCount = 0;
  let inactiveCount = 0;
  let uninstalledCount = 0;
  let duplicateCount = 0;

  computeDuplicateMap(players);

  // Count telemetry metrics
  players.forEach(p => {
    const isUninstalled = isUninstalledOrOptedOut(p);
    const key = getDeviceFingerprint(p);
    const cluster = duplicateMap.get(key) || [];

    // Agar ek hi key ke 2 ya zyada devices hain toh duplicate count karo
    if (cluster.length > 1) {
      // Find latest device by created_at / last_active
      const sorted = [...cluster].sort((a, b) => (b.created_at || b.last_active || 0) - (a.created_at || a.last_active || 0));
      // Jo latest nahi hai wo dead duplicate hai
      if (p.id !== sorted[0].id) {
        duplicateCount++;
      }
    }

    if (isUninstalled) {
      uninstalledCount++;
    } else {
      const diff = nowSec - (p.last_active || 0);
      const isOnline = diff <= 120;
      if (isOnline) {
        onlineCount++;
      } else {
        inactiveCount++;
      }
    }
  });

  updateTelemetryCounters(players, onlineCount, inactiveCount, uninstalledCount, duplicateCount);

  const filtered = players.filter(p => {
    const isUninstalled = isUninstalledOrOptedOut(p);
    const diffSec = nowSec - (p.last_active || 0);
    const isOnline = diffSec <= 120 && !isUninstalled;
    const key = getDeviceFingerprint(p);
    const cluster = duplicateMap.get(key) || [];
    const isPartOfDuplicateCluster = cluster.length > 1;

    if (timeFilter === "duplicates") {
      if (!isPartOfDuplicateCluster) return false;
    } else if (timeFilter === "all") {
      // Show all
    } else if (timeFilter === "uninstalled") {
      if (!isUninstalled) return false;
    } else {
      if (isUninstalled) return false;

      if (timeFilter === "online_now") {
        if (!isOnline) return false;
      } else if (timeFilter === "10m") {
        if (diffSec > 600) return false;
      } else if (timeFilter === "2h") {
        if (diffSec > 7200) return false;
      } else if (timeFilter === "1d") {
        if (diffSec > 86400) return false;
      } else if (timeFilter === "4d") {
        if (diffSec > 345600) return false;
      } else if (timeFilter === "7d") {
        if (diffSec > 604800) return false;
      } else if (timeFilter === "15d") {
        if (diffSec > 1296000) return false;
      } else if (timeFilter === "30d") {
        if (diffSec > 2592000) return false;
      } else if (timeFilter === "inactive_30d") {
        if (diffSec <= 2592000) return false;
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = translateDeviceName(p.device_model).toLowerCase();
      const model = (p.device_model || "").toLowerCase();
      const subId = (p.id || "").toLowerCase();
      const ip = (p.ip || "").toLowerCase();
      if (!name.includes(q) && !model.includes(q) && !subId.includes(q) && !ip.includes(q)) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    feed.innerHTML = '<p class="text-center text-xs py-12 font-medium" style="color:var(--text-muted);">No devices match this search or activity filter.</p>';
    return;
  }

  filtered.forEach(p => {
    const diffSec = nowSec - (p.last_active || 0);
    const isUnsubscribed = isUninstalledOrOptedOut(p);
    const isOnlineNow = diffSec <= 120 && !isUnsubscribed;
    const friendlyName = translateDeviceName(p.device_model);
    const installDate = formatDateTime(p.created_at);
    const lastActiveRel = formatRelativeTime(p.last_active);
    const subId = p.id || "N/A";
    const ipAddress = p.ip || "N/A";

    // Duplicate detection check
    const key = getDeviceFingerprint(p);
    const cluster = duplicateMap.get(key) || [];
    let isGhostDuplicate = false;
    let isLatestOfCluster = false;

    if (cluster.length > 1) {
      const sorted = [...cluster].sort((a, b) => (b.created_at || b.last_active || 0) - (a.created_at || a.last_active || 0));
      if (p.id === sorted[0].id) {
        isLatestOfCluster = true;
      } else {
        isGhostDuplicate = true;
      }
    }

    const card = document.createElement("div");
    card.className = "p-3.5 rounded-2xl surface-card cursor-pointer transition-all hover:border-[var(--accent-mint)] space-y-2.5 border";
    card.style.borderColor = isGhostDuplicate ? "rgba(225, 29, 72, 0.45)" : "var(--border-subtle)";
    
    let statusPillHtml = '';
    if (isGhostDuplicate) {
      statusPillHtml = '<span class="text-[8px] px-1.5 py-0.2 rounded font-mono font-bold mt-0.5" style="background-color:rgba(190,18,60,0.2); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.4);">⚠️ DEAD / DUPLICATE</span>';
    } else if (isLatestOfCluster && cluster.length > 1) {
      statusPillHtml = '<span class="text-[8px] px-1.5 py-0.2 rounded font-mono font-bold mt-0.5" style="background-color:rgba(4,120,87,0.2); color:var(--accent-mint); border:1px solid rgba(4,120,87,0.4);">LATEST ACTIVE</span>';
    } else if (isUnsubscribed) {
      statusPillHtml = '<span class="text-[8px] px-1.5 py-0.2 rounded font-mono font-bold mt-0.5" style="background-color:rgba(190,18,60,0.15); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.3);">UNINSTALLED</span>';
    } else if (isOnlineNow) {
      statusPillHtml = '<span class="text-[8px] px-1.5 py-0.2 rounded font-mono font-bold mt-0.5" style="background-color:rgba(4,120,87,0.15); color:var(--accent-mint); border:1px solid rgba(4,120,87,0.3);">ONLINE</span>';
    }

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background-color:${isGhostDuplicate ? 'rgba(190,18,60,0.15)' : 'rgba(4,120,87,0.12)'}; border:1px solid ${isGhostDuplicate ? 'rgba(190,18,60,0.4)' : 'rgba(4,120,87,0.3)'}; color:${isGhostDuplicate ? 'var(--accent-rose)' : 'var(--accent-mint)'};">
            <span class="material-symbols-outlined text-18">${isGhostDuplicate ? 'phonelink_erase' : 'smartphone'}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h4 class="text-xs font-bold truncate" style="color:var(--text-primary);">${escapeHtml(friendlyName)}</h4>
              <span class="text-[10px] font-mono" style="color:var(--text-muted);">(${escapeHtml(p.device_model || 'Unknown')})</span>
            </div>
            <p class="text-[10px]" style="color:var(--text-muted);">${escapeHtml(p.country || 'IN')} • Android ${escapeHtml(p.device_os || 'N/A')} • IP: <span class="font-mono font-bold" style="color:var(--accent-cyan);">${escapeHtml(ipAddress)}</span></p>
          </div>
        </div>
        <div class="flex flex-col items-end shrink-0">
          <span class="text-[10px] font-mono font-bold" style="color:${isOnlineNow ? 'var(--accent-mint)' : 'var(--text-muted)'};">${lastActiveRel}</span>
          ${statusPillHtml}
        </div>
      </div>

      <div class="p-2 rounded-xl text-[10px] font-mono flex items-center justify-between" style="background-color:var(--bg-input); border:1px solid var(--border-subtle);">
        <span style="color:var(--text-muted);">Sub ID:</span>
        <span class="truncate ml-2 select-all font-bold" style="color:var(--text-primary);">${escapeHtml(subId)}</span>
      </div>

      <div class="flex items-center justify-between text-[11px] px-0.5" style="color:var(--text-muted);">
        <div class="flex items-center gap-1">
          <span class="material-symbols-outlined text-14" style="color:var(--accent-amber);">event</span>
          <span>Install at:</span>
        </div>
        <span class="font-mono font-semibold" style="color:var(--text-primary);">${installDate}</span>
      </div>

      ${isGhostDuplicate ? `
      <div class="flex items-center justify-between text-[10px] px-2 py-1.5 rounded-lg border pt-1 mt-1" style="background-color:rgba(190,18,60,0.08); border-color:rgba(190,18,60,0.3); color:var(--accent-rose);">
        <span class="flex items-center gap-1">
          <span class="material-symbols-outlined text-14">info</span>
          <span>App clear data / Ghost duplicate</span>
        </span>
        <button type="button" class="quickDeleteGhostBtn text-[10px] font-bold px-2 py-0.5 rounded border shadow-sm transition-all" style="background-color:var(--accent-rose); color:#FFFFFF;" data-id="${escapeHtml(subId)}">
          Delete Ghost ID
        </button>
      </div>` : ''}

      ${isUnsubscribed ? `
      <div class="flex items-center justify-between text-[11px] px-0.5 pt-1 border-t" style="border-color:var(--border-subtle); color:var(--accent-rose);">
        <div class="flex items-center gap-1">
          <span class="material-symbols-outlined text-14">cancel</span>
          <span>Uninstalled / Opted Out at:</span>
        </div>
        <span class="font-mono font-semibold">${formatDateTime(p.last_active)}</span>
      </div>` : ''}
    `;

    card.addEventListener("click", (e) => {
      // Agar direct delete button dabaya toh profile sheet na kholein
      if (e.target.closest(".quickDeleteGhostBtn")) {
        e.stopPropagation();
        triggerDirectDelete(subId);
        return;
      }
      openProfile(p);
    });

    feed.appendChild(card);
  });
}

function updateTelemetryCounters(allList, onlineCount, inactiveCount, uninstalledCount, duplicateCount) {
  const statTotal = document.getElementById("statTotalSub");
  const statOnline = document.getElementById("statOnlineSub");
  const statInactive = document.getElementById("statInactiveSub");
  const statUninstalled = document.getElementById("statUninstalledSub");
  const statDuplicates = document.getElementById("statDuplicatesSub");

  if (statTotal) statTotal.textContent = allList.length;
  if (statOnline) statOnline.textContent = onlineCount;
  if (statInactive) statInactive.textContent = inactiveCount;
  if (statUninstalled) statUninstalled.textContent = uninstalledCount;
  if (statDuplicates) statDuplicates.textContent = duplicateCount;
}

// Quick Inline Delete for Ghost IDs
async function triggerDirectDelete(subId) {
  if (!confirm(`Are you sure you want to permanently delete this dead duplicate ID from OneSignal?\n\nSub ID: ${subId}`)) {
    return;
  }

  try {
    const res = await deleteOneSignalSubscriber(subId);
    if (res.success) {
      showToast("Ghost duplicate subscriber deleted permanently!", "success");
      players = players.filter(item => item.id !== subId);
      applyFiltersAndRender();
    } else {
      showToast("Delete failed: " + (res.error || "OneSignal error"), "error");
    }
  } catch (err) {
    showToast("Exception: " + err.message, "error");
  }
}

// Bottom Sheet Profile Inspector
const subSheet = document.getElementById("subSheet");

function openProfile(p) {
  activePlayerBeingInspected = p;
  const friendlyName = translateDeviceName(p.device_model);
  const nowSec = Math.floor(Date.now() / 1000);
  const diffSec = nowSec - (p.last_active || 0);
  const isUnsubscribed = isUninstalledOrOptedOut(p);
  const isOnlineNow = diffSec <= 120 && !isUnsubscribed;

  document.getElementById("mDeviceName").textContent = friendlyName;
  document.getElementById("mModel").textContent = p.device_model || "Android Device";
  document.getElementById("mOs").textContent = `Google Android ${p.device_os || "N/A"}`;
  document.getElementById("mAppVersion").textContent = p.game_version || "1 (App Build)";
  document.getElementById("mSdkVersion").textContent = p.sdk || "051002 (OneSignal SDK v5)";

  document.getElementById("mCreatedAt").textContent = formatDateTime(p.created_at);
  document.getElementById("mLastActive").textContent = `${formatDateTime(p.last_active)} (${formatRelativeTime(p.last_active)})`;
  document.getElementById("mSessions").textContent = `${p.session_count || 1} Total sessions`;
  document.getElementById("mDuration").textContent = formatPlaytime(p.playtime || 0);

  const uninstallRow = document.getElementById("mUninstallRow");
  if (isUnsubscribed) {
    if (uninstallRow) {
      uninstallRow.classList.remove("hidden");
      document.getElementById("mUninstalledAt").textContent = formatDateTime(p.last_active);
    }
  } else {
    if (uninstallRow) uninstallRow.classList.add("hidden");
  }

  document.getElementById("mCountry").textContent = p.country ? `${p.country} (${p.country === 'IN' ? 'India' : p.country})` : "India (IN)";
  document.getElementById("mTimezone").textContent = p.timezone || "Asia/Kolkata";
  document.getElementById("mLanguage").textContent = p.language ? `${p.language} (English)` : "en (English)";
  document.getElementById("mIp").textContent = p.ip || "Not recorded";

  document.getElementById("mSubId").textContent = p.id || "N/A";
  document.getElementById("mPushToken").textContent = p.identifier || "No Push Token Recorded";

  const statusBadge = document.getElementById("mStatusBadge");
  if (isUnsubscribed) {
    statusBadge.textContent = "UNINSTALLED / UNSUBSCRIBED";
    statusBadge.style.cssText = "background-color:rgba(190,18,60,0.15); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.3);";
  } else if (isOnlineNow) {
    statusBadge.textContent = "ONLINE NOW";
    statusBadge.style.cssText = "background-color:rgba(4,120,87,0.15); color:var(--accent-mint); border:1px solid rgba(4,120,87,0.3);";
  } else {
    statusBadge.textContent = "SUBSCRIBED (INACTIVE)";
    statusBadge.style.cssText = "background-color:rgba(74,93,110,0.15); color:var(--text-muted); border:1px solid var(--border-subtle);";
  }

  if (subSheet) subSheet.classList.remove("hidden");
}

function closeProfile() {
  if (subSheet) subSheet.classList.add("hidden");
  activePlayerBeingInspected = null;
}

// Delete Subscriber Action Handler
const deleteSubBtn = document.getElementById("deleteSubBtn");
if (deleteSubBtn) {
  deleteSubBtn.addEventListener("click", async () => {
    if (!activePlayerBeingInspected || !activePlayerBeingInspected.id) return;

    const subId = activePlayerBeingInspected.id;
    const confirmMsg = `Are you sure you want to permanently delete this subscriber from OneSignal?\n\nSub ID: ${subId}`;
    if (!confirm(confirmMsg)) return;

    deleteSubBtn.disabled = true;
    deleteSubBtn.innerHTML = `<span class="material-symbols-outlined text-16 animate-spin">refresh</span> Deleting...`;

    try {
      const res = await deleteOneSignalSubscriber(subId);
      if (res.success) {
        showToast("Subscriber profile deleted permanently!", "success");
        players = players.filter(item => item.id !== subId);
        applyFiltersAndRender();
        closeProfile();
      } else {
        showToast("Delete failed: " + (res.error || "OneSignal error"), "error");
      }
    } catch (e) {
      showToast("Exception: " + e.message, "error");
    } finally {
      deleteSubBtn.disabled = false;
      deleteSubBtn.innerHTML = `<span class="material-symbols-outlined text-16">delete_forever</span><span>Delete Subscriber Record</span>`;
    }
  });
}

// Event Listeners
const closeBtn = document.getElementById("closeSubSheetBtn");
if (closeBtn) closeBtn.addEventListener("click", closeProfile);

const botCloseBtn = document.getElementById("bottomCloseBtn");
if (botCloseBtn) botCloseBtn.addEventListener("click", closeProfile);

const refBtn = document.getElementById("refreshBtn");
if (refBtn) refBtn.addEventListener("click", loadSubscribers);

// Search Box Listener
const searchInput = document.getElementById("subscriberSearch");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    applyFiltersAndRender();
  });
}

// Activity Filter Dropdown Listener
const timeFilterSelect = document.getElementById("activityTimeFilter");
if (timeFilterSelect) {
  timeFilterSelect.addEventListener("change", (e) => {
    timeFilter = e.target.value;
    applyFiltersAndRender();
  });
}

// Quick-Pill Tap Filters
const pillDuplicates = document.getElementById("pillDuplicates");
if (pillDuplicates) {
  pillDuplicates.addEventListener("click", () => {
    if (timeFilterSelect) timeFilterSelect.value = "duplicates";
    timeFilter = "duplicates";
    applyFiltersAndRender();
  });
}

const pillOnline = document.getElementById("pillOnline");
if (pillOnline) {
  pillOnline.addEventListener("click", () => {
    if (timeFilterSelect) timeFilterSelect.value = "online_now";
    timeFilter = "online_now";
    applyFiltersAndRender();
  });
}

const pillAll = document.getElementById("pillAll");
if (pillAll) {
  pillAll.addEventListener("click", () => {
    if (timeFilterSelect) timeFilterSelect.value = "all";
    timeFilter = "all";
    applyFiltersAndRender();
  });
}

const pillInactive = document.getElementById("pillInactive");
if (pillInactive) {
  pillInactive.addEventListener("click", () => {
    if (timeFilterSelect) timeFilterSelect.value = "inactive_30d";
    timeFilter = "inactive_30d";
    applyFiltersAndRender();
  });
}

const pillUninstalled = document.getElementById("pillUninstalled");
if (pillUninstalled) {
  pillUninstalled.addEventListener("click", () => {
    if (timeFilterSelect) timeFilterSelect.value = "uninstalled";
    timeFilter = "uninstalled";
    applyFiltersAndRender();
  });
}

// Initial Load
loadSubscribers();

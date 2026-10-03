import { getOneSignalSubscribers } from "./onesignal-api.js";

let players = [];
let searchQuery = "";
let timeFilter = "all";

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

// Main Fetcher
async function loadSubscribers() {
  const feed = document.getElementById("devicesFeed");
  if (!feed) return;

  feed.innerHTML = '<p class="text-center text-xs py-12 font-medium" style="color:var(--text-muted);">Fetching subscriber registry from OneSignal...</p>';

  const res = await getOneSignalSubscribers({ limit: 50 });
  feed.innerHTML = "";

  if (!res.success || !res.players || res.players.length === 0) {
    feed.innerHTML = '<p class="text-center text-xs py-12 font-medium" style="color:var(--text-muted);">No subscribed devices found.</p>';
    updateTelemetryCounters([], 0, 0);
    return;
  }

  players = res.players;
  applyFiltersAndRender();
}

// Filter & Render Engine
function applyFiltersAndRender() {
  const feed = document.getElementById("devicesFeed");
  if (!feed) return;
  feed.innerHTML = "";

  const nowSec = Math.floor(Date.now() / 1000);
  let onlineCount = 0;
  let inactiveCount = 0;

  // Calculate Real-Time Presence Totals
  players.forEach(p => {
    const diff = nowSec - (p.last_active || 0);
    const isOnline = diff <= 120 && !p.invalid_identifier; // Strictly active in 2 min
    if (isOnline) {
      onlineCount++;
    } else {
      inactiveCount++;
    }
  });

  updateTelemetryCounters(players, onlineCount, inactiveCount);

  // Filter List according to Selected Activity Dropdown & Search
  const filtered = players.filter(p => {
    const diffSec = nowSec - (p.last_active || 0);
    const isUnsubscribed = Boolean(p.invalid_identifier);
    const isOnline = diffSec <= 120 && !isUnsubscribed;

    // 1. Strict Status & Time Filters
    if (timeFilter === "online_now") {
      if (!isOnline) return false;
    } else if (timeFilter === "10m") {
      if (diffSec > 600 || isUnsubscribed) return false;
    } else if (timeFilter === "2h") {
      if (diffSec > 7200 || isUnsubscribed) return false;
    } else if (timeFilter === "1d") {
      if (diffSec > 86400 || isUnsubscribed) return false;
    } else if (timeFilter === "4d") {
      if (diffSec > 345600 || isUnsubscribed) return false;
    } else if (timeFilter === "7d") {
      if (diffSec > 604800 || isUnsubscribed) return false;
    } else if (timeFilter === "15d") {
      if (diffSec > 1296000 || isUnsubscribed) return false;
    } else if (timeFilter === "30d") {
      if (diffSec > 2592000 || isUnsubscribed) return false;
    } else if (timeFilter === "inactive_30d") {
      if (diffSec <= 2592000 || isUnsubscribed) return false;
    } else if (timeFilter === "uninstalled") {
      if (!isUnsubscribed) return false;
    }

    // 2. Search Box Query Matching
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = translateDeviceName(p.device_model).toLowerCase();
      const model = (p.device_model || "").toLowerCase();
      const subId = (p.id || "").toLowerCase();
      if (!name.includes(q) && !model.includes(q) && !subId.includes(q)) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    feed.innerHTML = '<p class="text-center text-xs py-12 font-medium" style="color:var(--text-muted);">No devices match this search or activity filter.</p>';
    return;
  }

  // Render High-Contrast Cards
  filtered.forEach(p => {
    const diffSec = nowSec - (p.last_active || 0);
    const isOnlineNow = diffSec <= 120 && !p.invalid_identifier; // Strictly 2 min
    const isUnsubscribed = Boolean(p.invalid_identifier);
    const friendlyName = translateDeviceName(p.device_model);
    const installDate = formatDateTime(p.created_at);
    const lastActiveRel = formatRelativeTime(p.last_active);
    const subId = p.id || "N/A";

    const card = document.createElement("div");
    card.className = "p-3.5 rounded-2xl surface-card cursor-pointer transition-all hover:border-[var(--accent-mint)] space-y-2.5";
    
    // Status text badge logic
    let statusPillHtml = '';
    if (isUnsubscribed) {
      statusPillHtml = '<span class="text-[8px] px-1.5 py-0.2 rounded font-mono font-bold mt-0.5" style="background-color:rgba(190,18,60,0.15); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.3);">UNINSTALLED</span>';
    } else if (isOnlineNow) {
      statusPillHtml = '<span class="text-[8px] px-1.5 py-0.2 rounded font-mono font-bold mt-0.5" style="background-color:rgba(4,120,87,0.15); color:var(--accent-mint); border:1px solid rgba(4,120,87,0.3);">ONLINE</span>';
    }

    card.innerHTML = `
      <!-- Row 1: Device Name + (Model) + Activity Relative -->
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background-color:rgba(4,120,87,0.12); border:1px solid rgba(4,120,87,0.3); color:var(--accent-mint);">
            <span class="material-symbols-outlined text-18">smartphone</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h4 class="text-xs font-bold truncate" style="color:var(--text-primary);">${escapeHtml(friendlyName)}</h4>
              <span class="text-[10px] font-mono" style="color:var(--text-muted);">(${escapeHtml(p.device_model || 'Unknown')})</span>
            </div>
            <p class="text-[10px]" style="color:var(--text-muted);">${escapeHtml(p.country || 'IN')} • Android ${escapeHtml(p.device_os || 'N/A')}</p>
          </div>
        </div>
        <div class="flex flex-col items-end shrink-0">
          <span class="text-[10px] font-mono font-bold" style="color:${isOnlineNow ? 'var(--accent-mint)' : 'var(--text-muted)'};">${lastActiveRel}</span>
          ${statusPillHtml}
        </div>
      </div>

      <!-- Row 2: Subscription ID -->
      <div class="p-2 rounded-xl text-[10px] font-mono flex items-center justify-between" style="background-color:var(--bg-input); border:1px solid var(--border-subtle);">
        <span style="color:var(--text-muted);">Sub ID:</span>
        <span class="truncate ml-2 select-all font-bold" style="color:var(--text-primary);">${escapeHtml(subId)}</span>
      </div>

      <!-- Row 3: Install Date & Uninstall Date if uninstalled -->
      <div class="flex items-center justify-between text-[11px] px-0.5" style="color:var(--text-muted);">
        <div class="flex items-center gap-1">
          <span class="material-symbols-outlined text-14" style="color:var(--accent-amber);">event</span>
          <span>Install at:</span>
        </div>
        <span class="font-mono font-semibold" style="color:var(--text-primary);">${installDate}</span>
      </div>

      ${isUnsubscribed ? `
      <div class="flex items-center justify-between text-[11px] px-0.5 pt-1 border-t" style="border-color:var(--border-subtle); color:var(--accent-rose);">
        <div class="flex items-center gap-1">
          <span class="material-symbols-outlined text-14">cancel</span>
          <span>Uninstalled / Opted Out at:</span>
        </div>
        <span class="font-mono font-semibold">${formatDateTime(p.last_active)}</span>
      </div>` : ''}
    `;

    card.addEventListener("click", () => openProfile(p));
    feed.appendChild(card);
  });
}

function updateTelemetryCounters(allList, onlineCount, inactiveCount) {
  const statTotal = document.getElementById("statTotalSub");
  const statOnline = document.getElementById("statOnlineSub");
  const statInactive = document.getElementById("statInactiveSub");

  if (statTotal) statTotal.textContent = allList.length;
  if (statOnline) statOnline.textContent = onlineCount;
  if (statInactive) statInactive.textContent = inactiveCount;
}

// Bottom Sheet Profile Inspector
const subSheet = document.getElementById("subSheet");

function openProfile(p) {
  const friendlyName = translateDeviceName(p.device_model);
  const nowSec = Math.floor(Date.now() / 1000);
  const diffSec = nowSec - (p.last_active || 0);
  const isOnlineNow = diffSec <= 120 && !p.invalid_identifier;

  // 1. Hardware
  document.getElementById("mDeviceName").textContent = friendlyName;
  document.getElementById("mModel").textContent = p.device_model || "Android Device";
  document.getElementById("mOs").textContent = `Google Android ${p.device_os || "N/A"}`;
  document.getElementById("mAppVersion").textContent = p.game_version || "1 (App Build)";
  document.getElementById("mSdkVersion").textContent = p.sdk || "051002 (OneSignal SDK v5)";

  // 2. Activity
  document.getElementById("mCreatedAt").textContent = formatDateTime(p.created_at);
  document.getElementById("mLastActive").textContent = `${formatDateTime(p.last_active)} (${formatRelativeTime(p.last_active)})`;
  document.getElementById("mSessions").textContent = `${p.session_count || 1} Total sessions`;
  document.getElementById("mDuration").textContent = formatPlaytime(p.playtime || 0);

  // Uninstalled Row check
  const uninstallRow = document.getElementById("mUninstallRow");
  if (p.invalid_identifier) {
    if (uninstallRow) {
      uninstallRow.classList.remove("hidden");
      document.getElementById("mUninstalledAt").textContent = formatDateTime(p.last_active);
    }
  } else {
    if (uninstallRow) uninstallRow.classList.add("hidden");
  }

  // 3. Location & Regional
  document.getElementById("mCountry").textContent = p.country ? `${p.country} (${p.country === 'IN' ? 'India' : p.country})` : "India (IN)";
  document.getElementById("mTimezone").textContent = p.timezone || "Asia/Kolkata";
  document.getElementById("mLanguage").textContent = p.language ? `${p.language} (English)` : "en (English)";
  document.getElementById("mIp").textContent = p.ip || "2409:4064:2b94:3c85:bd08:5d91:e46f:659f";

  // 4. Identifiers & Token
  document.getElementById("mSubId").textContent = p.id || "N/A";
  document.getElementById("mPushToken").textContent = p.identifier || "No Push Token Recorded";

  // Status Badge in Sheet Header
  const statusBadge = document.getElementById("mStatusBadge");
  if (p.invalid_identifier) {
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

// Initial Load
loadSubscribers();

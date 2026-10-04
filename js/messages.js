import { getOneSignalNotifications } from "./onesignal-api.js";

const listFeed = document.getElementById("messagesListFeed");
const searchInput = document.getElementById("searchMsgInput");
const refreshBtn = document.getElementById("refreshMsgBtn");
const totalBadge = document.getElementById("totalMsgsBadge");

// Modal Elements
const modal = document.getElementById("messageDetailModal");
const closeModalBtn = document.getElementById("closeDetailModalBtn");
const detTitle = document.getElementById("detTitle");
const detBody = document.getElementById("detBody");
const detSentTime = document.getElementById("detSentTime");
const detStatusBadge = document.getElementById("detStatusBadge");
const detDeliveredVal = document.getElementById("detDeliveredVal");
const detClicksVal = document.getElementById("detClicksVal");
const detCtrVal = document.getElementById("detCtrVal");
const detPlatform = document.getElementById("detPlatform");
const detUrl = document.getElementById("detUrl");
const detId = document.getElementById("detId");
const detImgWrap = document.getElementById("detImgWrap");
const detImg = document.getElementById("detImg");

let allNotifications = [];
let query = "";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(timestampSec) {
  if (!timestampSec) return "Recently";
  const num = Number(timestampSec);
  // Timestamp seconds me hai ya milliseconds me
  const d = new Date(num > 10000000000 ? num : num * 1000);
  if (isNaN(d.getTime())) return "Recently";
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

function extractTitle(item) {
  if (item.headings && typeof item.headings === "object" && item.headings.en) {
    return item.headings.en;
  }
  if (item.name && typeof item.name === "string" && item.name.trim() !== "") {
    return item.name;
  }
  if (typeof item.headings === "string") {
    return item.headings;
  }
  return item.title || "Notification Alert";
}

function extractBody(item) {
  if (item.contents && typeof item.contents === "object" && item.contents.en) {
    return item.contents.en;
  }
  if (typeof item.contents === "string") {
    return item.contents;
  }
  return item.body || item.message || "Message contents unavailable";
}

async function loadNotifications() {
  if (!listFeed) return;
  listFeed.innerHTML = '<p class="text-xs text-center py-10" style="color:var(--text-muted);">Fetching notifications from OneSignal...</p>';

  try {
    const res = await getOneSignalNotifications();
    if (!res.success) {
      listFeed.innerHTML = `<div class="p-4 rounded-xl surface-card border text-center text-xs text-rose-500 font-semibold">${escapeHtml(res.error || 'Failed to fetch messages from OneSignal')}</div>`;
      return;
    }

    allNotifications = res.notifications || [];
    if (totalBadge) totalBadge.textContent = `${res.totalCount ?? allNotifications.length} Total`;
    render();
  } catch (err) {
    listFeed.innerHTML = `<div class="p-4 rounded-xl surface-card border text-center text-xs text-rose-500 font-semibold">Error: ${escapeHtml(err.message)}</div>`;
  }
}

function render() {
  if (!listFeed) return;
  listFeed.innerHTML = "";

  const filtered = allNotifications.filter(n => {
    if (!query) return true;
    const q = query.toLowerCase();
    const t = extractTitle(n).toLowerCase();
    const b = extractBody(n).toLowerCase();
    return t.includes(q) || b.includes(q);
  });

  if (filtered.length === 0) {
    listFeed.innerHTML = '<p class="text-xs text-center py-10" style="color:var(--text-muted);">No messages found.</p>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = "p-3.5 rounded-2xl surface-card border space-y-2 cursor-pointer transition-all active:scale-[0.99]";
    card.style.borderColor = "var(--border-subtle)";

    const title = extractTitle(item);
    const body = extractBody(item);

    const delivered = item.successful ?? (item.received ?? (item.recipients ?? 0));
    const clicks = item.converted ?? 0;
    const sentDate = formatDate(item.completed_at || item.send_after || item.queued_at);

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 mb-1 text-[9px]">
            <span class="font-bold px-1.5 py-0.2 rounded uppercase" style="background:rgba(4,120,87,0.15); color:var(--accent-mint);">DELIVERED</span>
            <span class="font-mono" style="color:var(--text-muted);">${sentDate}</span>
          </div>
          <h4 class="text-xs font-bold truncate" style="color:var(--text-primary);">${escapeHtml(title)}</h4>
          <p class="text-[11px] line-clamp-1 mt-0.5" style="color:var(--text-muted);">${escapeHtml(body)}</p>
        </div>
        <div class="text-right shrink-0">
          <span class="text-xs font-mono font-bold block" style="color:var(--accent-mint);">${delivered} Sent</span>
          <span class="text-[10px] font-mono font-semibold" style="color:var(--accent-amber);">${clicks} clicks</span>
        </div>
      </div>
      <div class="flex items-center justify-between pt-1.5 border-t text-[10px] font-semibold" style="border-color:var(--border-subtle); color:var(--accent-cyan);">
        <span>Tap to view detailed analytics</span>
        <span class="material-symbols-outlined text-14">arrow_forward</span>
      </div>
    `;

    card.onclick = () => openModal(item);
    listFeed.appendChild(card);
  });
}

function openModal(item) {
  if (!modal) return;
  const title = extractTitle(item);
  const body = extractBody(item);

  const delivered = item.successful ?? (item.received ?? (item.recipients ?? 0));
  const clicks = item.converted ?? 0;
  const ctr = delivered > 0 ? ((clicks / delivered) * 100).toFixed(1) : 0;
  const sentDate = formatDate(item.completed_at || item.send_after || item.queued_at);

  if (detTitle) detTitle.textContent = title;
  if (detBody) detBody.textContent = body;
  if (detSentTime) detSentTime.textContent = sentDate;
  if (detDeliveredVal) detDeliveredVal.textContent = delivered;
  if (detClicksVal) detClicksVal.textContent = clicks;
  if (detCtrVal) detCtrVal.textContent = `${ctr}%`;
  if (detPlatform) detPlatform.textContent = item.platform || "Google Android";
  if (detUrl) detUrl.textContent = item.url || item.data?.url || item.data?.body_url || "In-App Open";
  if (detId) detId.textContent = item.id || "--";

  const pic = item.big_picture || item.global_image || item.chrome_web_image || item.data?.big_picture;
  if (pic && detImgWrap && detImg) {
    detImg.src = pic;
    detImgWrap.classList.remove("hidden");
  } else if (detImgWrap) {
    detImgWrap.classList.add("hidden");
  }

  modal.classList.remove("hidden");
}

if (closeModalBtn && modal) {
  closeModalBtn.onclick = () => modal.classList.add("hidden");
}

if (searchInput) {
  searchInput.oninput = (e) => {
    query = e.target.value.trim();
    render();
  };
}

if (refreshBtn) {
  refreshBtn.onclick = loadNotifications;
}

// Initial Run
loadNotifications();

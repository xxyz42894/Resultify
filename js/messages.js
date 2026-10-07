import { getOneSignalNotifications, getOneSignalNotificationDetail, cancelOneSignalNotification } from "./onesignal-api.js";

const listFeed = document.getElementById("messagesListFeed");
const searchInput = document.getElementById("searchMsgInput");
const refreshBtn = document.getElementById("refreshMsgBtn");
const totalBadge = document.getElementById("totalMsgsBadge");

// Modal Elements
const modal = document.getElementById("messageDetailModal");
const closeModalBtn = document.getElementById("closeDetailModalBtn");
const bottomCloseModalBtn = document.getElementById("bottomCloseModalBtn");
const cancelMsgBtn = document.getElementById("cancelMsgBtn");

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
const detImgUrlText = document.getElementById("detImgUrlText");
const detOpenActivity = document.getElementById("detOpenActivity");
const detResultId = document.getElementById("detResultId");
const detButtonsWrap = document.getElementById("detButtonsWrap");
const detButtonsList = document.getElementById("detButtonsList");
const detButtonsCountBadge = document.getElementById("detButtonsCountBadge");

let allNotifications = [];
let query = "";
let activeNotificationBeingViewed = null;

function escapeHtml(str) {
  if (!str) return "";
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

function formatDate(timestampSec) {
  if (!timestampSec) return "Recently";
  const num = Number(timestampSec);
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

function getPlatformStats(item) {
  const stats = item?.platform_delivery_stats;
  if (!stats || typeof stats !== "object") return {};
  return stats.android || stats.Android || stats.all || {};
}

function getNotificationMetrics(item) {
  const platform = getPlatformStats(item);

  const delivered = Number(
    item?.successful ??
    item?.received ??
    platform?.successful ??
    platform?.delivered ??
    platform?.received ??
    item?.recipients ??
    0
  );

  const clicks = Number(
    item?.converted ??
    platform?.converted ??
    platform?.clicks ??
    platform?.clicked ??
    item?.clicks ??
    0
  );

  return {
    delivered: Number.isFinite(delivered) ? delivered : 0,
    clicks: Number.isFinite(clicks) ? clicks : 0
  };
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

    const { delivered, clicks } = getNotificationMetrics(item);
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
      <div class="flex items-center justify-between pt-1.5 border-t text-[10px] font-semibold" style="border-color:var(--border-subtle);">
        <span class="flex items-center gap-0.5" style="color:var(--accent-cyan);">
          <span>Tap to view detailed analytics</span>
          <span class="material-symbols-outlined text-14">arrow_forward</span>
        </span>
        <button type="button" class="quickDeleteBtn text-rose-500 font-bold p-1 hover:underline flex items-center gap-0.5" data-id="${escapeHtml(item.id)}">
          <span class="material-symbols-outlined text-14">delete</span>
          <span>Delete</span>
        </button>
      </div>
    `;

    card.onclick = (e) => {
      if (e.target.closest(".quickDeleteBtn")) {
        e.stopPropagation();
        triggerDeleteNotification(item);
        return;
      }
      openModal(item);
    };

    listFeed.appendChild(card);
  });
}

async function openModal(item) {
  if (!modal) return;
  activeNotificationBeingViewed = item;

  const title = extractTitle(item);
  const body = extractBody(item);

  // Initial populate using available data
  let { delivered, clicks } = getNotificationMetrics(item);
  let ctr = delivered > 0 ? ((clicks / delivered) * 100).toFixed(1) : "0.0";
  const sentDate = formatDate(item.completed_at || item.send_after || item.queued_at);

  if (detTitle) detTitle.textContent = title;
  if (detBody) detBody.textContent = body;
  if (detSentTime) detSentTime.textContent = sentDate;
  if (detDeliveredVal) detDeliveredVal.textContent = delivered;
  if (detClicksVal) detClicksVal.textContent = clicks;
  if (detCtrVal) detCtrVal.textContent = `${ctr}%`;
  if (detPlatform) detPlatform.textContent = item.platform || "Google Android";

  const data = item.data || (item.custom && typeof item.custom === 'object' ? item.custom.a : {}) || {};
  const mainUrl = item.url || data.url || "";
  if (detUrl) {
    detUrl.textContent = mainUrl || "None (Default App Open)";
    detUrl.title = mainUrl;
  }
  if (detOpenActivity) detOpenActivity.textContent = data.openActivity || "ExternalLink";
  if (detResultId) detResultId.textContent = data.resultId ?? 0;
  if (detId) detId.textContent = item.id || "--";

  const pic = item.big_picture || item.global_image || item.chrome_web_image || data.big_picture;
  if (pic && detImgWrap && detImg) {
    detImg.src = pic;
    detImgWrap.classList.remove("hidden");
    if (detImgUrlText) {
      detImgUrlText.textContent = pic;
      detImgUrlText.classList.remove("hidden");
    }
  } else {
    if (detImgWrap) detImgWrap.classList.add("hidden");
    if (detImgUrlText) detImgUrlText.classList.add("hidden");
  }

  // Buttons Inspection
  const buttonsToDisplay = [];
  const rawButtons = item.web_buttons || item.buttons || [];
  if (Array.isArray(rawButtons) && rawButtons.length > 0) {
    rawButtons.forEach((b, idx) => {
      const btnId = b.id || `btn_action_${idx + 1}`;
      const btnUrl = b.url || data[`${btnId}_url`] || data[`btn_action_${idx + 1}_url`] || "";
      buttonsToDisplay.push({
        id: btnId,
        text: b.text || `Action ${idx + 1}`,
        url: btnUrl
      });
    });
  }

  if (buttonsToDisplay.length === 0) {
    if (data.btn_action_1_url) {
      buttonsToDisplay.push({ id: "btn_action_1", text: "Action Button 1", url: data.btn_action_1_url });
    }
    if (data.btn_action_2_url) {
      buttonsToDisplay.push({ id: "btn_action_2", text: "Action Button 2", url: data.btn_action_2_url });
    }
  }

  if (detButtonsWrap && detButtonsList) {
    if (buttonsToDisplay.length > 0) {
      detButtonsList.innerHTML = "";
      if (detButtonsCountBadge) {
        detButtonsCountBadge.textContent = `${buttonsToDisplay.length} Button${buttonsToDisplay.length > 1 ? 's' : ''}`;
      }

      buttonsToDisplay.forEach((b) => {
        const bDiv = document.createElement("div");
        bDiv.className = "p-2.5 rounded-xl bg-black/5 border space-y-1";
        bDiv.style.borderColor = "var(--border-subtle)";

        bDiv.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="material-symbols-outlined text-14 text-amber-600">smart_button</span>
              <span class="font-bold text-xs truncate" style="color:var(--text-primary);">${escapeHtml(b.text)}</span>
            </div>
            <span class="font-mono text-[9px] px-1.5 py-0.2 rounded font-bold bg-black/10 text-muted">${escapeHtml(b.id)}</span>
          </div>
          <div class="pt-0.5">
            ${b.url ? `
              <div class="flex items-center gap-1 text-[10px]">
                <span class="font-semibold text-muted shrink-0">Action Link:</span>
                <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer" class="font-mono text-[10px] text-cyan-600 hover:underline truncate select-all block">${escapeHtml(b.url)}</a>
              </div>
            ` : `
              <span class="text-[10px] font-mono text-muted italic">No URL (Opens App Default)</span>
            `}
          </div>
        `;
        detButtonsList.appendChild(bDiv);
      });
      detButtonsWrap.classList.remove("hidden");
    } else {
      detButtonsWrap.classList.add("hidden");
    }
  }

  modal.classList.remove("hidden");

  // Live Single Message Real-Time Fetch (OneSignal View Message API)
  if (item.id) {
    try {
      const freshRes = await getOneSignalNotificationDetail(item.id);
      if (freshRes.success && freshRes.notification && activeNotificationBeingViewed?.id === item.id) {
        const freshItem = freshRes.notification;
        const freshMetrics = getNotificationMetrics(freshItem);
        const freshCtr = freshMetrics.delivered > 0 ? ((freshMetrics.clicks / freshMetrics.delivered) * 100).toFixed(1) : "0.0";

        if (detDeliveredVal) detDeliveredVal.textContent = freshMetrics.delivered;
        if (detClicksVal) detClicksVal.textContent = freshMetrics.clicks;
        if (detCtrVal) detCtrVal.textContent = `${freshCtr}%`;

        // Update in-memory item so list cards stay in sync
        item.successful = freshItem.successful;
        item.received = freshItem.received;
        item.converted = freshItem.converted;
        item.platform_delivery_stats = freshItem.platform_delivery_stats;
      }
    } catch (ignored) {}
  }
}

function closeModal() {
  if (modal) modal.classList.add("hidden");
  activeNotificationBeingViewed = null;
}

async function triggerDeleteNotification(item) {
  if (!item || !item.id) return;

  const title = extractTitle(item);
  const confirmMsg = `Are you sure you want to permanently delete this message from OneSignal?\n\nTitle: "${title}"\nID: ${item.id}`;
  if (!confirm(confirmMsg)) return;

  if (cancelMsgBtn) {
    cancelMsgBtn.disabled = true;
    cancelMsgBtn.innerHTML = `<span class="material-symbols-outlined text-16 animate-spin">refresh</span> Deleting...`;
  }

  try {
    const res = await cancelOneSignalNotification(item.id);

    if (res.success) {
      showToast(`Message "${title}" has been deleted from OneSignal.`, "success");
      await loadNotifications();
      closeModal();
    } else {
      const errMsg = res.error || (res.data?.errors && res.data.errors[0]) || "Delete request failed";
      showToast(`OneSignal Error: ${errMsg}`, "error");
    }
  } catch (e) {
    showToast("Delete Error: " + e.message, "error");
  } finally {
    if (cancelMsgBtn) {
      cancelMsgBtn.disabled = false;
      cancelMsgBtn.innerHTML = `<span class="material-symbols-outlined text-16">delete_forever</span><span>Delete / Cancel Message</span>`;
    }
  }
}

if (cancelMsgBtn) {
  cancelMsgBtn.addEventListener("click", () => {
    if (activeNotificationBeingViewed) {
      triggerDeleteNotification(activeNotificationBeingViewed);
    }
  });
}

if (closeModalBtn) closeModalBtn.onclick = closeModal;
if (bottomCloseModalBtn) bottomCloseModalBtn.onclick = closeModal;

if (searchInput) {
  searchInput.oninput = (e) => {
    query = e.target.value.trim();
    render();
  };
}

if (refreshBtn) {
  refreshBtn.onclick = loadNotifications;
}

loadNotifications();

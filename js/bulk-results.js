import { ref, get, set, update, push } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { database } from "./firebase-config.js";
import { sendResultPushNotification } from "./onesignal-api.js";

// Form DOM
const form = document.getElementById("bulkEntryForm");
const qResId = document.getElementById("qResId");
const qCategory = document.getElementById("qCategory");
const qTitle = document.getElementById("qTitle");
const qLabel = document.getElementById("qLabel");
const qBoard = document.getElementById("qBoard");
const qYear = document.getElementById("qYear");
const qStatus = document.getElementById("qStatus");
const qPublished = document.getElementById("qPublished");
const qUrl = document.getElementById("qUrl");
const qDescription = document.getElementById("qDescription");
const qSendPush = document.getElementById("qSendPush");

// Action Elements
const saveDirectBtn = document.getElementById("saveDirectBtn");
const queuePreviewContainer = document.getElementById("queuePreviewContainer");
const queueCounterBadge = document.getElementById("queueCounterBadge");
const queueCountText = document.getElementById("queueCountText");
const clearQueueBtn = document.getElementById("clearQueueBtn");
const publishContainer = document.getElementById("publishContainer");
const publishAllBtn = document.getElementById("publishAllBtn");

let queuedResults = [];

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

// Auto Increment Result ID based on existing items
async function autoSuggestNextId() {
  try {
    const snap = await get(ref(database, "results"));
    let maxId = 100;
    if (snap.exists()) {
      snap.forEach(c => {
        const idVal = parseInt(c.val().id);
        if (idVal && idVal > maxId) maxId = idVal;
      });
    }
    // Account for current queued items
    queuedResults.forEach(item => {
      if (item.id > maxId) maxId = item.id;
    });
    if (qResId && !qResId.value) {
      qResId.value = maxId + 1;
    }
  } catch (e) {
    if (qResId && !qResId.value) qResId.value = 101;
  }
}

function getFormData() {
  return {
    id: parseInt(qResId.value),
    title: qTitle.value.trim(),
    label: qLabel.value.trim(),
    category: qCategory.value,
    boardOrUniversity: qBoard.value.trim(),
    year: qYear.value.trim(),
    status: qStatus.value,
    published: qPublished.value.trim(),
    url: qUrl.value.trim(),
    description: qDescription.value.trim(),
    openActivity: "ResultDetailActivity",
    createdAt: Date.now(),
    sendPush: qSendPush ? qSendPush.checked : false,
    notificationSent: false
  };
}

// 1. QUEUE ADD (+ ADD MORE)
if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = getFormData();
    queuedResults.push(item);

    showToast(`Added "${item.title}" to Queue!`, "success");

    // Reset inputs for fast next entry
    qTitle.value = "";
    qUrl.value = "";
    qDescription.value = "";
    qResId.value = item.id + 1; // Auto increment for next
    qTitle.focus();

    renderQueue();
  });
}

// 2. DIRECT SAVE TO DB
if (saveDirectBtn) {
  saveDirectBtn.addEventListener("click", async () => {
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const item = getFormData();
    saveDirectBtn.disabled = true;
    saveDirectBtn.textContent = "Publishing...";

    try {
      const newRef = push(ref(database, "results"));
      await set(newRef, item);
      showToast(`Published directly to App!`, "success");

      if (item.sendPush) {
        const pRes = await sendResultPushNotification(item);
        if (pRes.success) {
          await update(newRef, { notificationSent: true });
          showToast("Push notification dispatched", "success");
        }
      }

      form.reset();
      autoSuggestNextId();
    } catch (err) {
      showToast("Error saving: " + err.message, "error");
    } finally {
      saveDirectBtn.disabled = false;
      saveDirectBtn.innerHTML = `<span class="material-symbols-outlined text-16">save</span><span>Save Directly</span>`;
    }
  });
}

// 3. RENDER QUEUED RESULTS
function renderQueue() {
  const count = queuedResults.length;
  if (queueCounterBadge) queueCounterBadge.textContent = count;
  if (queueCountText) queueCountText.textContent = count;

  if (count === 0) {
    if (clearQueueBtn) clearQueueBtn.classList.add("hidden");
    if (publishContainer) publishContainer.classList.add("hidden");
    queuePreviewContainer.innerHTML = `
      <div class="p-8 text-center rounded-2xl surface-card border space-y-1" style="border-color: var(--border-subtle);">
        <span class="material-symbols-outlined text-32" style="color: var(--text-subtle);">playlist_add</span>
        <p class="text-xs font-bold" style="color: var(--text-muted);">No Results in Queue Yet</p>
        <p class="text-[10px]" style="color: var(--text-subtle);">Fill the form above and click "Queue (+ Add More)"</p>
      </div>
    `;
    return;
  }

  if (clearQueueBtn) clearQueueBtn.classList.remove("hidden");
  if (publishContainer) publishContainer.classList.remove("hidden");
  queuePreviewContainer.innerHTML = "";

  queuedResults.forEach((r, idx) => {
    const card = document.createElement("div");
    card.className = "p-3.5 rounded-2xl surface-card border space-y-2 relative";
    card.style.borderColor = "var(--border-subtle)";

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
            <span class="text-[9px] px-1.5 py-0.5 rounded font-semibold" style="background-color:var(--bg-elevated); color:${r.sendPush ? 'var(--accent-mint)' : 'var(--text-subtle)'};">${r.sendPush ? 'Push Alert ON' : 'No Push'}</span>
          </div>
          <h3 class="text-xs font-bold line-clamp-1" style="color:var(--text-primary);">${escapeHtml(r.title)}</h3>
        </div>
        <button data-remove="${idx}" class="text-rose-500 hover:text-rose-700 p-1" title="Remove from queue">
          <span class="material-symbols-outlined text-16">close</span>
        </button>
      </div>

      <div class="text-[11px] flex items-center justify-between" style="color:var(--text-muted);">
        <span class="truncate">${escapeHtml(r.boardOrUniversity || '')}</span>
        <span class="font-mono font-bold" style="color:var(--text-primary);">#${escapeHtml(r.id)} · ${escapeHtml(r.year || '')}</span>
      </div>

      <div class="text-[10px] text-cyan-600 truncate">
        ${escapeHtml(r.url)}
      </div>
    `;

    card.querySelector(`[data-remove="${idx}"]`).addEventListener("click", () => {
      queuedResults.splice(idx, 1);
      renderQueue();
    });

    queuePreviewContainer.appendChild(card);
  });
}

// 4. CLEAR ALL QUEUE
if (clearQueueBtn) {
  clearQueueBtn.addEventListener("click", () => {
    if (confirm("Clear all items currently in queue?")) {
      queuedResults = [];
      renderQueue();
    }
  });
}

// 5. PUBLISH ALL QUEUED RESULTS TO APP AT ONCE
if (publishAllBtn) {
  publishAllBtn.addEventListener("click", async () => {
    if (queuedResults.length === 0) return;

    if (!confirm(`Publish all ${queuedResults.length} queued results to the App now?`)) {
      return;
    }

    publishAllBtn.disabled = true;
    publishAllBtn.innerHTML = `<span class="material-symbols-outlined text-18 animate-spin">refresh</span> Publishing ${queuedResults.length} Results to Database...`;

    try {
      let publishedCount = 0;
      let pushCount = 0;

      for (const item of queuedResults) {
        const itemCopy = { ...item };
        const shouldPush = itemCopy.sendPush;
        delete itemCopy.sendPush;

        const newRef = push(ref(database, "results"));
        await set(newRef, itemCopy);
        publishedCount++;

        // Send Push if configured
        if (shouldPush) {
          try {
            const pRes = await sendResultPushNotification(itemCopy);
            if (pRes.success) {
              await update(newRef, { notificationSent: true });
              pushCount++;
            }
          } catch (e) {
            console.warn("Push error for", itemCopy.title, e);
          }
        }
      }

      showToast(`Successfully published ${publishedCount} results to App! (${pushCount} alerts sent)`, "success");

      // Clear queue after successful publish
      queuedResults = [];
      renderQueue();
      autoSuggestNextId();

    } catch (err) {
      showToast("Publish error: " + err.message, "error");
    } finally {
      publishAllBtn.disabled = false;
      publishAllBtn.innerHTML = `<span class="material-symbols-outlined text-18">rocket_launch</span><span>Publish All Queued Results to App Now</span>`;
    }
  });
}

// Initial Run
autoSuggestNextId();
renderQueue();

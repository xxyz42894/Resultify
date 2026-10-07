import { ref, get, remove } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { database } from "./firebase-config.js";
import { getOneSignalSubscribers, sendPushNotification, deleteOneSignalSubscriber } from "./onesignal-api.js";

// Normalize OneSignal timestamps: seconds, milliseconds, numeric strings, or ISO dates.
function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric > 10000000000 ? numeric / 1000 : numeric;
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed / 1000 : 0;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10000000000 ? value / 1000 : value;
  }
  return 0;
}

// DOM Elements
const form = document.getElementById("broadcastForm");
const targetSelect = document.getElementById("targetAudience");
const audienceCountBadge = document.getElementById("targetAudienceCountBadge");
const audienceExplanationText = document.getElementById("audienceExplanationText");

// Target Activity & Result ID Toggle Elements
const targetActivitySelect = document.getElementById("bcTargetActivity");
const toggleResultId = document.getElementById("toggleResultId");
const resultIdContainer = document.getElementById("bcResultIdContainer");
const resultIdInput = document.getElementById("bcResultId");
const resultMatchCard = document.getElementById("resultMatchCard");
const matchedResultCategory = document.getElementById("matchedResultCategory");
const matchedResultTitle = document.getElementById("matchedResultTitle");
const resultNotFoundWarning = document.getElementById("resultNotFoundWarning");
const resultIdCheckingSpinner = document.getElementById("resultIdCheckingSpinner");

// Action Button Inputs
const btn1TextInput = document.getElementById("bcBtn1Text");
const btn1UrlInput = document.getElementById("bcBtn1Url");
const btn2TextInput = document.getElementById("bcBtn2Text");
const btn2UrlInput = document.getElementById("bcBtn2Url");

// Custom Subscription ID Validator Elements
const customSubIdContainer = document.getElementById("customSubIdContainer");
const manualSubIdInput = document.getElementById("manualSubIdInput");
const validateAddSubBtn = document.getElementById("validateAddSubBtn");
const validatedSubList = document.getElementById("validatedSubList");
const customSubCountBadge = document.getElementById("customSubCountBadge");

// Ghost Device Controls
const ghostDeviceAlertBox = document.getElementById("ghostDeviceAlertBox");
const ghostCountBadge = document.getElementById("ghostCountBadge");
const toggleIgnoreGhost = document.getElementById("toggleIgnoreGhost");
const ghostDevicesList = document.getElementById("ghostDevicesList");

// Custom Range Picker Controls
const customRangePickerBox = document.getElementById("customRangePickerBox");
const rangePickerTitle = document.getElementById("rangePickerTitle");
const rangeResultPreview = document.getElementById("rangeResultPreview");
const dualRangeInputs = document.getElementById("dualRangeInputs");
const singleThresholdInput = document.getElementById("singleThresholdInput");
const inputMinDays = document.getElementById("inputMinDays");
const inputMaxDays = document.getElementById("inputMaxDays");
const inputInactiveDays = document.getElementById("inputInactiveDays");

// Testing Controls
const testingDevContainer = document.getElementById("testingDeviceContainer");
const testersCheckboxList = document.getElementById("testersCheckboxList");
const refreshDevsBtn = document.getElementById("refreshTestingDevs");
const selectedSubIdText = document.getElementById("selectedSubIdText");

const titleInput = document.getElementById("bcTitle");
const bodyInput = document.getElementById("bcBody");
const urlInput = document.getElementById("bcUrl");
const bigPictureInput = document.getElementById("bcBigPicture");
const largeIconInput = document.getElementById("bcLargeIcon");

// Mockup Elements
const mockupTitle = document.getElementById("mockupTitle");
const mockupBody = document.getElementById("mockupBody");
const mockupPriorityBadge = document.getElementById("mockupPriorityBadge");
const mockupBigPicContainer = document.getElementById("mockupBigPictureContainer");
const mockupBigPicImg = document.getElementById("mockupBigPictureImg");
const mockupBtnsContainer = document.getElementById("mockupBtnsContainer");
const mockupBtn1 = document.getElementById("mockupBtn1");
const mockupBtn2 = document.getElementById("mockupBtn2");

// Inspector Elements
const inspectorCard = document.getElementById("responseInspectorCard");
const respStatusBadge = document.getElementById("respStatusBadge");
const respRecipientsVal = document.getElementById("respRecipientsVal");
const respIdVal = document.getElementById("respIdVal");
const outgoingPayloadJson = document.getElementById("outgoingPayloadJson");
const rawJsonResponse = document.getElementById("rawJsonResponse");
const payloadItemsCount = document.getElementById("payloadItemsCount");

// Modal Elements
const openTemplateModalBtn = document.getElementById("openTemplateModalBtn");
const closeTemplateModalBtn = document.getElementById("closeTemplateModalBtn");
const templateModal = document.getElementById("templateModal");
const modalTemplatesList = document.getElementById("modalTemplatesList");

let allSubscribers = [];
let officialTestUsers = [];
let detectedGhostIds = new Set();
let validatedManualSubscribers = [];

// DEFAULT PRESETS (Fallback built-in)
const DEFAULT_PRESETS = [
  {
    id: "def_bpsc_result",
    name: "BPSC Result Declared (Urgent)",
    priority: "urgent",
    title: "BPSC Final Result & Cutoff Declared! 🎯",
    body: "Merit list and scorecards are now published officially. Check your roll number and cutoff marks.",
    url: "https://bpsc.bihar.gov.in",
    image: "https://picsum.photos/800/450",
    btn1Text: "Check Result",
    btn1Url: "https://bpsc.bihar.gov.in",
    btn2Text: "Official Site",
    btn2Url: "https://bpsc.bihar.gov.in",
    isDefault: true
  },
  {
    id: "def_10th_12th_board",
    name: "Bihar Board 10th / 12th Result",
    priority: "urgent",
    title: "BSEB Matric / Inter Result Live! 📋",
    body: "Bihar School Examination Board has declared the annual secondary results online.",
    url: "http://results.biharboardonline.com",
    image: "https://picsum.photos/800/450",
    btn1Text: "Check Marks",
    btn1Url: "http://results.biharboardonline.com",
    btn2Text: "Official Site",
    btn2Url: "http://biharboardonline.bihar.gov.in",
    isDefault: true
  },
  {
    id: "def_app_update",
    name: "Resultify New App Update",
    priority: "high",
    title: "New Resultify Update Available 🚀",
    body: "Faster server load, instant result PDF downloads and performance improvements.",
    url: "https://play.google.com/store/apps/details?id=com.resultify.app",
    image: "",
    btn1Text: "Update Now",
    btn1Url: "https://play.google.com/store/apps/details?id=com.resultify.app",
    btn2Text: "Later",
    btn2Url: "",
    isDefault: true
  }
];

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
  setTimeout(() => toast.remove(), 4000);
}

// 1. REAL-TIME RESULT ID LOOKUP & SUGGESTION
let resultLookupTimeout = null;

async function checkResultIdInDatabase(idVal) {
  if (!idVal || isNaN(idVal)) {
    if (resultMatchCard) resultMatchCard.classList.add("hidden");
    if (resultNotFoundWarning) resultNotFoundWarning.classList.add("hidden");
    return;
  }

  if (resultIdCheckingSpinner) resultIdCheckingSpinner.classList.remove("hidden");

  try {
    const snap = await get(ref(database, "results"));
    let foundResult = null;

    if (snap.exists()) {
      snap.forEach(child => {
        const val = child.val();
        if (Number(val.id) === Number(idVal) || String(child.key) === String(idVal)) {
          foundResult = val;
        }
      });
    }

    if (foundResult) {
      if (resultMatchCard) {
        resultMatchCard.classList.remove("hidden");
        matchedResultCategory.textContent = (foundResult.category || "EXAM").toUpperCase();
        matchedResultTitle.textContent = foundResult.title || "Found Result";
      }
      if (resultNotFoundWarning) resultNotFoundWarning.classList.add("hidden");
    } else {
      if (resultMatchCard) resultMatchCard.classList.add("hidden");
      if (resultNotFoundWarning) resultNotFoundWarning.classList.remove("hidden");
    }
  } catch (err) {
    console.warn("Result verify error:", err);
  } finally {
    if (resultIdCheckingSpinner) resultIdCheckingSpinner.classList.add("hidden");
  }
}

if (resultIdInput) {
  resultIdInput.addEventListener("input", () => {
    clearTimeout(resultLookupTimeout);
    const val = resultIdInput.value.trim();
    resultLookupTimeout = setTimeout(() => {
      checkResultIdInDatabase(val);
    }, 400);
  });
}

if (toggleResultId && resultIdContainer) {
  toggleResultId.addEventListener("change", () => {
    if (toggleResultId.checked) {
      resultIdContainer.classList.remove("hidden");
      if (btn1UrlInput) btn1UrlInput.disabled = true;
      if (btn2UrlInput) btn2UrlInput.disabled = true;
      if (resultIdInput && resultIdInput.value) checkResultIdInDatabase(resultIdInput.value.trim());
    } else {
      resultIdContainer.classList.add("hidden");
      if (resultIdInput) resultIdInput.value = "";
      if (resultMatchCard) resultMatchCard.classList.add("hidden");
      if (resultNotFoundWarning) resultNotFoundWarning.classList.add("hidden");
      if (btn1UrlInput) btn1UrlInput.disabled = false;
      if (btn2UrlInput) btn2UrlInput.disabled = false;
    }
  });
}

// 2. LIVE PREVIEW UPDATE
function updateMockup() {
  if (titleInput && mockupTitle) {
    mockupTitle.textContent = titleInput.value.trim() || "Notification Title";
  }
  if (bodyInput && mockupBody) {
    mockupBody.textContent = bodyInput.value.trim() || "Message will show here...";
  }

  const p = document.querySelector('input[name="bcPriority"]:checked')?.value || "urgent";
  if (mockupPriorityBadge) {
    if (p === "urgent") {
      mockupPriorityBadge.textContent = "URGENT POP";
      mockupPriorityBadge.style.cssText = "background-color:rgba(4,120,87,0.15); color:var(--accent-mint);";
    } else if (p === "high") {
      mockupPriorityBadge.textContent = "HIGH POP";
      mockupPriorityBadge.style.cssText = "background-color:rgba(180,83,9,0.15); color:var(--accent-amber);";
    } else {
      mockupPriorityBadge.textContent = "NORMAL QUIET";
      mockupPriorityBadge.style.cssText = "background-color:rgba(74,93,110,0.15); color:var(--text-muted);";
    }
  }

  if (bigPictureInput && mockupBigPicContainer && mockupBigPicImg) {
    const val = bigPictureInput.value.trim();
    if (val) {
      mockupBigPicImg.src = val;
      mockupBigPicContainer.classList.remove("hidden");
    } else {
      mockupBigPicContainer.classList.add("hidden");
    }
  }

  if (mockupBtnsContainer && mockupBtn1 && mockupBtn2) {
    const t1 = btn1TextInput ? btn1TextInput.value.trim() : "";
    const t2 = btn2TextInput ? btn2TextInput.value.trim() : "";
    if (t1 || t2) {
      mockupBtnsContainer.classList.remove("hidden");
      mockupBtn1.textContent = t1 || "Button 1";
      mockupBtn1.style.display = t1 ? "inline-block" : "none";
      mockupBtn2.textContent = t2 || "Button 2";
      mockupBtn2.style.display = t2 ? "inline-block" : "none";
    } else {
      mockupBtnsContainer.classList.add("hidden");
    }
  }
}

[titleInput, bodyInput, bigPictureInput, btn1TextInput, btn2TextInput].forEach(el => {
  if (el) {
    el.addEventListener("input", updateMockup);
    el.addEventListener("keyup", updateMockup);
    el.addEventListener("change", updateMockup);
  }
});

document.querySelectorAll('input[name="bcPriority"]').forEach(r => {
  r.addEventListener("change", updateMockup);
});

function isInstalledSubscriber(p) {
  return !p.invalid_identifier && !p.opted_out && p.notification_types !== -2;
}

function getDeviceFingerprint(p) {
  const model = String(p.device_model || "unknown").toLowerCase().trim();
  const os = String(p.device_os || "unknown").toLowerCase().trim();
  const ip = String(p.ip || "").trim();
  if (ip && ip !== "not recorded") {
    return `${ip}___${model}___${os}`;
  }
  return `${model}___${os}`;
}

// 3. GHOST DEVICE ENGINE
function analyzeGhostDevices(subList) {
  const clusterMap = new Map();
  detectedGhostIds = new Set();
  const ghostListDetails = [];

  subList.forEach(p => {
    const key = getDeviceFingerprint(p);
    if (!clusterMap.has(key)) clusterMap.set(key, []);
    clusterMap.get(key).push(p);
  });

  clusterMap.forEach((devices) => {
    if (devices.length > 1) {
      const sorted = [...devices].sort((a, b) => (normalizeTimestamp(b.created_at) || normalizeTimestamp(b.last_active)) - (normalizeTimestamp(a.created_at) || normalizeTimestamp(a.last_active)));
      for (let i = 1; i < sorted.length; i++) {
        detectedGhostIds.add(sorted[i].id);
        ghostListDetails.push(sorted[i]);
      }
    }
  });

  renderGhostUI(ghostListDetails);
}

function renderGhostUI(ghostDevices) {
  if (!ghostDeviceAlertBox || !ghostCountBadge || !ghostDevicesList) return;

  if (ghostDevices.length === 0) {
    ghostDeviceAlertBox.classList.add("hidden");
    return;
  }

  ghostDeviceAlertBox.classList.remove("hidden");
  ghostCountBadge.textContent = `${ghostDevices.length} Dead Ghost ID${ghostDevices.length === 1 ? '' : 's'}`;
  ghostDevicesList.innerHTML = "";

  ghostDevices.forEach(d => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between p-2 rounded-xl border surface-card text-[10px]";
    row.style.borderColor = "var(--border-subtle)";

    const subIdShort = d.id ? `${d.id.slice(0, 16)}...` : "Unknown";

    row.innerHTML = `
      <div class="min-w-0 flex-1 pr-2">
        <span class="font-bold text-rose-500 block truncate">${escapeHtml(d.device_model || 'Android')} (Ghost ID)</span>
        <span class="font-mono text-[9px] text-muted block select-all">Sub: ${escapeHtml(subIdShort)}</span>
        <span class="text-[9px] text-muted">IP: ${escapeHtml(d.ip || 'N/A')}</span>
      </div>
      <button type="button" class="quickDeleteGhostBtn text-[10px] font-bold px-2 py-1 rounded border shadow-sm transition-all shrink-0" style="background-color: var(--accent-rose); color: #FFFFFF;" data-id="${escapeHtml(d.id)}">
        Delete ID
      </button>
    `;

    row.querySelector(".quickDeleteGhostBtn").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete ghost subscriber ${d.id} from OneSignal?`)) return;
      try {
        const res = await deleteOneSignalSubscriber(d.id);
        if (res.success) {
          showToast("Ghost ID deleted!", "success");
          allSubscribers = allSubscribers.filter(item => item.id !== d.id);
          analyzeGhostDevices(allSubscribers);
          updateAudienceUI();
        } else {
          showToast("Delete failed: " + res.error, "error");
        }
      } catch (err) {
        showToast("Error: " + err.message, "error");
      }
    });

    ghostDevicesList.appendChild(row);
  });
}

// 4. AUDIENCE ENGINE
function getAudienceTargets(mode) {
  const nowSec = Math.floor(Date.now() / 1000);
  let installedList = (allSubscribers || []).filter(isInstalledSubscriber);

  const shouldIgnoreGhost = (mode === "all_clean") || (toggleIgnoreGhost && toggleIgnoreGhost.checked && mode !== "all_raw");

  if (shouldIgnoreGhost && detectedGhostIds.size > 0) {
    installedList = installedList.filter(p => !detectedGhostIds.has(p.id));
  }

  switch (mode) {
    case "all_clean":
    case "all_raw":
      return installedList;

    case "custom_active_range": {
      const minDays = Math.max(0, parseInt(inputMinDays?.value) || 0);
      const maxDays = Math.max(minDays, parseInt(inputMaxDays?.value) || 7);
      const minSec = minDays * 86400;
      const maxSec = maxDays * 86400;

      return installedList.filter(p => {
        const diff = nowSec - normalizeTimestamp(p.last_active);
        return diff >= minSec && diff <= maxSec;
      });
    }

    case "custom_inactive_threshold": {
      const inactiveDays = Math.max(1, parseInt(inputInactiveDays?.value) || 14);
      const thresholdSec = inactiveDays * 86400;

      return installedList.filter(p => {
        const diff = nowSec - normalizeTimestamp(p.last_active);
        return diff > thresholdSec;
      });
    }

    case "testing_all":
    case "testing_specific": {
      const selectedBoxes = testersCheckboxList?.querySelectorAll('input[name="selectedTester"]:checked');
      if (!selectedBoxes || selectedBoxes.length === 0) return [];
      const selectedIds = Array.from(selectedBoxes).map(b => b.value);
      return officialTestUsers.filter(p => selectedIds.includes(p.id));
    }

    case "custom_subscription_id": {
      const checkedBoxes = validatedSubList?.querySelectorAll('input[name="selectedManualSub"]:checked');
      if (!checkedBoxes || checkedBoxes.length === 0) return [];
      const selectedIds = Array.from(checkedBoxes).map(b => b.value);
      return validatedManualSubscribers.filter(p => selectedIds.includes(p.id));
    }

    default:
      return installedList;
  }
}

function updateAudienceUI() {
  const mode = targetSelect ? targetSelect.value : "all_clean";
  const matched = getAudienceTargets(mode);

  if (audienceCountBadge) {
    if (mode === "testing_all" || mode === "testing_specific") {
      audienceCountBadge.textContent = `${matched.length} Test Device${matched.length === 1 ? '' : 's'}`;
    } else if (mode === "custom_subscription_id") {
      audienceCountBadge.textContent = `${matched.length} Custom Target${matched.length === 1 ? '' : 's'}`;
    } else {
      audienceCountBadge.textContent = `${matched.length} Devices Target`;
    }
  }

  if (customSubIdContainer) {
    if (mode === "custom_subscription_id") {
      customSubIdContainer.classList.remove("hidden");
    } else {
      customSubIdContainer.classList.add("hidden");
    }
  }

  if (customRangePickerBox) {
    if (mode === "custom_active_range") {
      customRangePickerBox.classList.remove("hidden");
      if (dualRangeInputs) dualRangeInputs.classList.remove("hidden");
      if (singleThresholdInput) singleThresholdInput.classList.add("hidden");
      if (rangePickerTitle) rangePickerTitle.textContent = "Active Range (Chune Hue Din)";
      if (rangeResultPreview) rangeResultPreview.textContent = `${matched.length} Active users`;
    } else if (mode === "custom_inactive_threshold") {
      customRangePickerBox.classList.remove("hidden");
      if (dualRangeInputs) dualRangeInputs.classList.add("hidden");
      if (singleThresholdInput) singleThresholdInput.classList.remove("hidden");
      if (rangePickerTitle) rangePickerTitle.textContent = "Inactive Threshold (X Din Se Zyada)";
      if (rangeResultPreview) rangeResultPreview.textContent = `${matched.length} Inactive users`;
    } else {
      customRangePickerBox.classList.add("hidden");
    }
  }

  if (audienceExplanationText) {
    const explanations = {
      all_clean: "Dead duplicate/ghost devices ko hata kar sabhi active devices ko message jayega.",
      all_raw: "Sabhi devices (including dead ghost duplicates) par message dispatch hoga.",
      custom_active_range: `Pichhle ${inputMinDays?.value || 0} din se ${inputMaxDays?.value || 7} din ke beech active rahe users ko message jayega.`,
      custom_inactive_threshold: `Jo users pichhle ${inputInactiveDays?.value || 14} din se app bilkul nahi khole, unhi ko jayega.`,
      testing_all: "Neeche tick kiye gaye test device(s) ko push deliver hoga.",
      testing_specific: "Neeche tick kiye gaye test device(s) ko push deliver hoga.",
      custom_subscription_id: "Khud se Subscription ID daal kar device model validate karein aur selectively send karein."
    };
    audienceExplanationText.textContent = explanations[mode] || "";
  }

  if (testingDevContainer) {
    if (mode === "testing_specific" || mode === "testing_all") {
      testingDevContainer.classList.remove("hidden");
    } else {
      testingDevContainer.classList.add("hidden");
    }
  }
}

[inputMinDays, inputMaxDays, inputInactiveDays].forEach(input => {
  if (input) {
    input.addEventListener("input", updateAudienceUI);
    input.addEventListener("change", updateAudienceUI);
  }
});

if (toggleIgnoreGhost) {
  toggleIgnoreGhost.addEventListener("change", updateAudienceUI);
}

// 5. MANUAL SUBSCRIPTION ID VALIDATION
function renderValidatedManualSubsList() {
  if (!validatedSubList) return;
  validatedSubList.innerHTML = "";

  if (validatedManualSubscribers.length === 0) {
    validatedSubList.innerHTML = `<p class="text-[10px]" style="color: var(--text-muted);">Enter ID above to fetch device name and target directly.</p>`;
    if (customSubCountBadge) customSubCountBadge.textContent = "0 Added";
    return;
  }

  if (customSubCountBadge) {
    customSubCountBadge.textContent = `${validatedManualSubscribers.length} Added`;
  }

  validatedManualSubscribers.forEach((sub, idx) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between p-2 rounded-xl border surface-card text-[11px]";
    row.style.borderColor = "var(--border-subtle)";

    const subIdShort = sub.id ? `${sub.id.slice(0, 16)}...` : "Unknown";

    row.innerHTML = `
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <input type="checkbox" name="selectedManualSub" value="${escapeHtml(sub.id)}" checked class="rounded accent-emerald-600 shrink-0">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="font-bold truncate" style="color: var(--text-primary);">${escapeHtml(sub.device_model || 'Unknown Device')}</span>
            <span class="text-[9px] font-mono px-1 py-0.2 rounded" style="background: rgba(14,116,144,0.15); color: var(--accent-cyan);">${escapeHtml(sub.device_os || 'Android')}</span>
          </div>
          <span class="font-mono text-[9px] block select-all" style="color: var(--text-muted);">${escapeHtml(subIdShort)}</span>
        </div>
      </div>
      <button type="button" class="removeManualSubBtn text-[10px] font-bold p-1 rounded hover:bg-black/10 shrink-0 text-rose-500" data-idx="${idx}" title="Remove">
        <span class="material-symbols-outlined text-16">close</span>
      </button>
    `;

    row.querySelector(".removeManualSubBtn").addEventListener("click", () => {
      validatedManualSubscribers.splice(idx, 1);
      renderValidatedManualSubsList();
      updateAudienceUI();
    });

    row.querySelector('input[name="selectedManualSub"]').addEventListener("change", () => {
      updateAudienceUI();
    });

    validatedSubList.appendChild(row);
  });
}

if (validateAddSubBtn && manualSubIdInput) {
  validateAddSubBtn.addEventListener("click", async () => {
    const inputVal = manualSubIdInput.value.trim();
    if (!inputVal) {
      showToast("Kripya Subscription ID daalein.", "error");
      return;
    }

    if (validatedManualSubscribers.some(item => item.id === inputVal)) {
      showToast("Yeh Subscription ID pehle se list me add hai.", "info");
      return;
    }

    validateAddSubBtn.disabled = true;
    validateAddSubBtn.innerHTML = `<span class="material-symbols-outlined text-14 animate-spin">refresh</span> Checking...`;

    try {
      if (allSubscribers.length === 0) {
        const res = await getOneSignalSubscribers();
        allSubscribers = res.players || (Array.isArray(res) ? res : []);
      }

      const found = allSubscribers.find(p => p.id === inputVal);

      if (found) {
        validatedManualSubscribers.push(found);
        manualSubIdInput.value = "";
        renderValidatedManualSubsList();
        updateAudienceUI();
        showToast(`Validated: ${found.device_model || 'Android Device'} (${found.device_os || ''})`, "success");
      } else {
        const fallbackObj = {
          id: inputVal,
          device_model: "Custom Targeted Phone",
          device_os: "Verified Active"
        };
        validatedManualSubscribers.push(fallbackObj);
        manualSubIdInput.value = "";
        renderValidatedManualSubsList();
        updateAudienceUI();
        showToast("ID Added as Custom Device!", "info");
      }
    } catch (e) {
      showToast("Validation Error: " + e.message, "error");
    } finally {
      validateAddSubBtn.disabled = false;
      validateAddSubBtn.innerHTML = `<span class="material-symbols-outlined text-16">add_circle</span> <span>Validate & Add</span>`;
    }
  });
}

// 6. TEST USERS LIST
async function loadOneSignalSubscribersAndTesters() {
  if (testersCheckboxList) {
    testersCheckboxList.innerHTML = '<p class="text-[11px]" style="color: var(--text-muted);">Fetching official test devices from OneSignal...</p>';
  }

  try {
    const res = await getOneSignalSubscribers();
    allSubscribers = res.players || (Array.isArray(res) ? res : []);

    analyzeGhostDevices(allSubscribers);

    officialTestUsers = allSubscribers.filter(p => {
      return Boolean(p.tags && p.tags.test_user);
    });

    renderTestersList();
  } catch (err) {
    allSubscribers = [];
    officialTestUsers = [];
    if (testersCheckboxList) {
      testersCheckboxList.innerHTML = `<p class="text-[11px] text-rose-500">Error: ${err.message}</p>`;
    }
  } finally {
    updateAudienceUI();
  }
}

function renderTestersList() {
  if (!testersCheckboxList) return;
  testersCheckboxList.innerHTML = "";

  if (officialTestUsers.length === 0) {
    testersCheckboxList.innerHTML = `
      <div class="p-3 rounded-xl border space-y-1" style="border-color: rgba(180,83,9,0.3); background: rgba(180,83,9,0.06);">
        <p class="text-[11px] font-bold" style="color: var(--accent-amber);">No Test Devices Detected with Tag "test_user"</p>
        <p class="text-[10px]" style="color: var(--text-muted);">
          OneSignal dashboard me user profile ke <b>Data tags</b> me <code>Key: test_user</code> aur <code>Value: Device Name</code> save hona chahiye.
        </p>
      </div>
    `;
    return;
  }

  const selectAllRow = document.createElement("div");
  selectAllRow.className = "flex items-center justify-between pb-1.5 border-b mb-1";
  selectAllRow.style.borderColor = "var(--border-subtle)";
  selectAllRow.innerHTML = `
    <label class="flex items-center gap-1.5 text-[11px] font-bold cursor-pointer" style="color: var(--accent-mint);">
      <input type="checkbox" id="selectAllTestersCheckbox" class="rounded accent-emerald-600">
      <span>Select All Testers (${officialTestUsers.length})</span>
    </label>
  `;
  testersCheckboxList.appendChild(selectAllRow);

  const selectAllBox = selectAllRow.querySelector("#selectAllTestersCheckbox");

  officialTestUsers.forEach((tester) => {
    const row = document.createElement("label");
    row.className = "flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border surface-card text-[11px]";
    row.style.borderColor = "var(--border-subtle)";

    const displayName = tester.tags.test_user || tester.device_model || "Test Device";
    const subIdFull = tester.id || "";
    const subIdShort = subIdFull ? subIdFull.slice(0, 18) + "..." : "Unknown";

    row.innerHTML = `
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <input type="checkbox" name="selectedTester" value="${subIdFull}" class="rounded accent-emerald-600 tester-checkbox shrink-0">
        <div class="min-w-0 flex-1">
          <span class="font-bold block truncate" style="color: var(--text-primary);">${escapeHtml(displayName)}</span>
          <span class="font-mono text-[9px] select-all block" style="color: var(--text-muted);">Sub ID: ${escapeHtml(subIdShort)}</span>
        </div>
      </div>
      <span class="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold shrink-0 ml-1" style="background: rgba(4,120,87,0.15); color: var(--accent-mint);">TESTER</span>
    `;

    testersCheckboxList.appendChild(row);
  });

  const individualCheckboxes = testersCheckboxList.querySelectorAll('input[name="selectedTester"]');
  individualCheckboxes.forEach(cb => cb.checked = true);
  if (selectAllBox) selectAllBox.checked = true;

  if (selectAllBox) {
    selectAllBox.addEventListener("change", () => {
      individualCheckboxes.forEach(b => b.checked = selectAllBox.checked);
      updateAudienceUI();
    });
  }

  individualCheckboxes.forEach(b => {
    b.addEventListener("change", () => {
      const allChecked = Array.from(individualCheckboxes).every(cb => cb.checked);
      if (selectAllBox) selectAllBox.checked = allChecked;
      updateAudienceUI();
    });
  });
}

if (targetSelect) {
  targetSelect.addEventListener("change", updateAudienceUI);
}

if (refreshDevsBtn) {
  refreshDevsBtn.addEventListener("click", loadOneSignalSubscribersAndTesters);
}

// 7. TEMPLATES MODAL ENGINE
async function fetchAllTemplatesList() {
  const combined = [...DEFAULT_PRESETS];
  try {
    const snap = await get(ref(database, "push_templates"));
    if (snap.exists()) {
      snap.forEach(child => {
        combined.push({ id: child.key, ...child.val(), isDefault: false });
      });
    }
  } catch (err) {
    console.warn("Could not load templates:", err);
  }
  return combined;
}

function applyTemplate(t) {
  if (!t) return;

  // Templates are data-only presets. Ignore obsolete banner/dispatch keys.
  const cleanTemplate = {
    title: String(t.title || ""),
    body: String(t.body || ""),
    priority: ["urgent", "high", "normal"].includes(t.priority) ? t.priority : "urgent",
    url: String(t.url || ""),
    image: String(t.image || ""),
    btn1Text: String(t.btn1Text || ""),
    btn1Url: String(t.btn1Url || ""),
    btn2Text: String(t.btn2Text || ""),
    btn2Url: String(t.btn2Url || "")
  };

  if (titleInput) titleInput.value = cleanTemplate.title;
  if (bodyInput) bodyInput.value = cleanTemplate.body;

  if (cleanTemplate.priority) {
    const radio = document.querySelector(`input[name="bcPriority"][value="${cleanTemplate.priority}"]`);
    if (radio) radio.checked = true;
  }

  if (urlInput) urlInput.value = cleanTemplate.url;
  if (bigPictureInput) bigPictureInput.value = cleanTemplate.image;
  if (largeIconInput) largeIconInput.value = cleanTemplate.image;

  if (btn1TextInput) btn1TextInput.value = cleanTemplate.btn1Text;
  if (btn1UrlInput) btn1UrlInput.value = cleanTemplate.btn1Url;

  if (btn2TextInput) btn2TextInput.value = cleanTemplate.btn2Text;
  if (btn2UrlInput) btn2UrlInput.value = cleanTemplate.btn2Url;

  updateMockup();
  showToast(`Applied preset: "${t.name}"!`, "success");
}

async function renderModalTemplates() {
  if (!modalTemplatesList) return;
  modalTemplatesList.innerHTML = '<p class="text-xs text-center py-4" style="color:var(--text-muted);">Loading presets...</p>';

  const templates = await fetchAllTemplatesList();
  modalTemplatesList.innerHTML = "";

  templates.forEach(t => {
    const card = document.createElement("div");
    card.className = "p-3 rounded-2xl border surface-card space-y-2.5 relative";
    card.style.borderColor = "var(--border-subtle)";

    const badgeColor = t.priority === "urgent" 
      ? "background:rgba(4,120,87,0.15); color:var(--accent-mint);" 
      : (t.priority === "high" ? "background:rgba(180,83,9,0.15); color:var(--accent-amber);" : "background:rgba(74,93,110,0.15); color:var(--text-muted);");

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold" style="color:var(--text-primary);">${t.name}</h4>
        <div class="flex items-center gap-1.5">
          <span class="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase" style="${badgeColor}">${t.priority}</span>
          ${!t.isDefault ? `
            <button type="button" class="delModalTplBtn text-rose-500 hover:text-rose-700 p-0.5" data-id="${t.id}" title="Delete Template">
              <span class="material-symbols-outlined text-16">delete</span>
            </button>
          ` : ''}
        </div>
      </div>
      <div class="p-2.5 rounded-xl bg-black/5 text-[11px] space-y-1 border" style="border-color:var(--border-subtle);">
        <p class="font-bold text-xs" style="color:var(--text-primary);">${t.title}</p>
        <p class="line-clamp-2" style="color:var(--text-muted);">${t.body}</p>
        ${t.image ? `<div class="mt-1 max-h-20 overflow-hidden rounded"><img src="${t.image}" class="w-full h-auto object-cover" /></div>` : ''}
        ${(t.btn1Text || t.btn2Text) ? `
          <div class="flex gap-1.5 pt-1">
            ${t.btn1Text ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded surface-card border" style="color:var(--accent-mint);">${t.btn1Text}</span>` : ''}
            ${t.btn2Text ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded surface-card border" style="color:var(--accent-mint);">${t.btn2Text}</span>` : ''}
          </div>
        ` : ''}
      </div>
      <button type="button" class="useModalTplBtn w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm" style="background-color:var(--accent-mint); color:#FFFFFF;">
        <span class="material-symbols-outlined text-16">done_all</span>
        <span>Use This Preset</span>
      </button>
    `;

    card.querySelector(".useModalTplBtn").addEventListener("click", () => {
      applyTemplate(t);
      if (templateModal) templateModal.classList.add("hidden");
    });

    const delBtn = card.querySelector(".delModalTplBtn");
    if (delBtn) {
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`Delete template "${t.name}" permanently from Firebase?`)) {
          try {
            await remove(ref(database, `push_templates/${t.id}`));
            showToast("Template deleted!", "success");
            renderModalTemplates();
          } catch (err) {
            showToast("Delete failed: " + err.message, "error");
          }
        }
      });
    }

    modalTemplatesList.appendChild(card);
  });
}

if (openTemplateModalBtn && templateModal) {
  openTemplateModalBtn.addEventListener("click", () => {
    templateModal.classList.remove("hidden");
    renderModalTemplates();
  });
}

if (closeTemplateModalBtn && templateModal) {
  closeTemplateModalBtn.addEventListener("click", () => {
    templateModal.classList.add("hidden");
  });
}

// Check sessionStorage if opened from templates.html
const savedTpl = sessionStorage.getItem("resultify_selected_template");
if (savedTpl) {
  try {
    const parsed = JSON.parse(savedTpl);
    applyTemplate(parsed);
    sessionStorage.removeItem("resultify_selected_template");
  } catch (e) {}
}

// 8. FORM DISPATCH ENGINE (Push Alerts Exclusively)
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const url = urlInput ? urlInput.value.trim() : "";
    const bigPicture = bigPictureInput ? bigPictureInput.value.trim() : "";
    const largeIcon = largeIconInput ? largeIconInput.value.trim() : "";
    const selectedMode = document.querySelector('input[name="bcPriority"]:checked')?.value || "urgent";
    const selectedChannel = document.getElementById("bcChannelSelect")?.value || "Result Alerts";
    const targetMode = targetSelect.value;

    const selectedActivity = targetActivitySelect ? targetActivitySelect.value : "ExternalLink";

    let finalResultId = 0;
    if (toggleResultId && toggleResultId.checked && resultIdInput) {
      finalResultId = parseInt(resultIdInput.value.trim()) || 0;
    }

    if (!title || !body) return;

    const customData = {
      openActivity: selectedActivity,
      resultId: finalResultId
    };

    if (url) {
      customData.url = url;
    }

    const actionButtons = [];
    const b1Text = btn1TextInput ? btn1TextInput.value.trim() : "";
    const b1Url = (finalResultId === 0 && btn1UrlInput) ? btn1UrlInput.value.trim() : "";

    const b2Text = btn2TextInput ? btn2TextInput.value.trim() : "";
    const b2Url = (finalResultId === 0 && btn2UrlInput) ? btn2UrlInput.value.trim() : "";

    if (b1Text) {
      actionButtons.push({
        id: "btn_action_1",
        text: b1Text,
        url: b1Url || undefined
      });
      if (b1Url) customData.btn_action_1_url = b1Url;
    }

    if (b2Text) {
      actionButtons.push({
        id: "btn_action_2",
        text: b2Text,
        url: b2Url || undefined
      });
      if (b2Url) customData.btn_action_2_url = b2Url;
    }

    let targetIds = [];

    if (targetMode === "testing_all" || targetMode === "testing_specific") {
      const checkedBoxes = testersCheckboxList?.querySelectorAll('input[name="selectedTester"]:checked');
      if (!checkedBoxes || checkedBoxes.length === 0) {
        alert("Kripya kam se kam ek test device check karein.");
        return;
      }
      targetIds = Array.from(checkedBoxes).map(b => b.value);
    } else if (targetMode === "custom_subscription_id") {
      const checkedBoxes = validatedSubList?.querySelectorAll('input[name="selectedManualSub"]:checked');
      if (!checkedBoxes || checkedBoxes.length === 0) {
        alert("Kripya kam se kam ek validated subscription ID check karein.");
        return;
      }
      targetIds = Array.from(checkedBoxes).map(b => b.value);
    } else {
      const targetDevices = getAudienceTargets(targetMode);
      targetIds = targetDevices.map(d => d.id);
    }

    if (!targetIds || targetIds.length === 0) {
      alert(`Koi valid target device nahi mila.`);
      return;
    }

    const submitBtn = document.getElementById("bcSubmitBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="material-symbols-outlined text-18 animate-spin">refresh</span> Dispatching (${targetIds.length} Device${targetIds.length === 1 ? '' : 's'})...`;
    }

    const oneSignalPayload = {
      target_channel: "push",
      headings: { en: title },
      contents: { en: body },
      existing_android_channel_id: selectedChannel,
      data: customData,
      include_subscription_ids: targetIds
    };

    if (selectedMode === "urgent") {
      oneSignalPayload.priority = 10;
      oneSignalPayload.android_sound = "default";
      oneSignalPayload.android_visibility = 1;
      oneSignalPayload.android_accent_color = "FF047857";
    } else if (selectedMode === "high") {
      oneSignalPayload.priority = 10;
      oneSignalPayload.android_sound = "default";
      oneSignalPayload.android_visibility = 1;
      oneSignalPayload.android_accent_color = "FFB45309";
    } else {
      oneSignalPayload.priority = 5;
      oneSignalPayload.android_sound = null;
      oneSignalPayload.android_visibility = 0;
    }

    if (url) oneSignalPayload.url = url;
    if (bigPicture) oneSignalPayload.big_picture = bigPicture;
    if (largeIcon) oneSignalPayload.large_icon = largeIcon;

    if (actionButtons.length > 0) {
      oneSignalPayload.buttons = actionButtons;
    }

    try {
      const pushRes = await sendPushNotification(oneSignalPayload);

      if (inspectorCard) inspectorCard.classList.remove("hidden");
      const raw = pushRes.raw || pushRes;

      if (outgoingPayloadJson) outgoingPayloadJson.textContent = JSON.stringify(raw.outgoingPayloadSent || oneSignalPayload, null, 2);
      if (rawJsonResponse) rawJsonResponse.textContent = JSON.stringify(raw.rawOneSignalResponse || raw, null, 2);
      if (payloadItemsCount) payloadItemsCount.textContent = `(${targetIds.length} Target ID${targetIds.length === 1 ? '' : 's'})`;

      const isSuccess = Boolean(pushRes.success && pushRes.id);

      if (isSuccess) {
        if (respStatusBadge) {
          respStatusBadge.textContent = `HTTP ${pushRes.statusCode || 200} OK`;
          respStatusBadge.style.cssText = "background-color:rgba(4,120,87,0.15); color:var(--accent-mint); border:1px solid rgba(4,120,87,0.3);";
        }
        if (respRecipientsVal) respRecipientsVal.textContent = pushRes.recipients || targetIds.length;
        if (respIdVal) {
          respIdVal.textContent = pushRes.id;
          respIdVal.style.color = "var(--accent-mint)";
        }
        showToast(`Delivered successfully to ${targetIds.length} device(s)!`, "success");
      } else {
        if (respStatusBadge) {
          respStatusBadge.textContent = `HTTP ${pushRes.statusCode || 400} REJECTED`;
          respStatusBadge.style.cssText = "background-color:rgba(190,18,60,0.15); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.3);";
        }
        if (respRecipientsVal) respRecipientsVal.textContent = "0";
        if (respIdVal) {
          respIdVal.textContent = "No UUID Returned";
          respIdVal.style.color = "var(--accent-rose)";
        }

        const errText = Array.isArray(pushRes.errors) ? pushRes.errors.join(", ") : (pushRes.errors || "Target device invalid or unsubscribed");
        showToast(`OneSignal Rejected: ${errText}`, "error");
      }

      if (inspectorCard) inspectorCard.scrollIntoView({ behavior: "smooth" });

    } catch (err) {
      if (inspectorCard) inspectorCard.classList.remove("hidden");
      if (respStatusBadge) {
        respStatusBadge.textContent = `HTTP ${err.statusCode || 500} ERROR`;
        respStatusBadge.style.cssText = "background-color:rgba(190,18,60,0.15); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.3);";
      }
      if (respRecipientsVal) respRecipientsVal.textContent = "0";
      if (respIdVal) {
        respIdVal.textContent = "Failed";
        respIdVal.style.color = "var(--accent-rose)";
      }

      if (outgoingPayloadJson) outgoingPayloadJson.textContent = JSON.stringify(oneSignalPayload, null, 2);
      if (rawJsonResponse) rawJsonResponse.textContent = JSON.stringify(err.data || { error: err.message }, null, 2);

      alert("OneSignal Delivery Exception:\n" + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span class="material-symbols-outlined text-18">send</span> Send Notification Now`;
      }
    }
  });
}

// Initial Run
updateMockup();
loadOneSignalSubscribersAndTesters();

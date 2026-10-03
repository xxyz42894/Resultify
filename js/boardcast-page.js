import { ref, set } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { database } from "./firebase-config.js";
import { getOneSignalSubscribers, sendPushNotification } from "./onesignal-api.js";

// DOM Elements
const form = document.getElementById("broadcastForm");
const targetSelect = document.getElementById("targetAudience");
const testingDevContainer = document.getElementById("testingDeviceContainer");
const testingDevSelect = document.getElementById("testingDeviceSelect");
const refreshDevsBtn = document.getElementById("refreshTestingDevs");
const selectedSubIdText = document.getElementById("selectedSubIdText");

const titleInput = document.getElementById("bcTitle");
const bodyInput = document.getElementById("bcBody");
const urlInput = document.getElementById("bcUrl");
const bigPictureInput = document.getElementById("bcBigPicture");
const largeIconInput = document.getElementById("bcLargeIcon");
const btn1TextInput = document.getElementById("bcBtn1Text");
const btn1UrlInput = document.getElementById("bcBtn1Url");
const btn2TextInput = document.getElementById("bcBtn2Text");
const btn2UrlInput = document.getElementById("bcBtn2Url");

// Toggles
const toggleUpdate = document.getElementById("toggleAppUpdate");
const toggleNotice = document.getElementById("toggleNotice");
const toggleBug = document.getElementById("toggleBug");
const allToggles = [toggleUpdate, toggleNotice, toggleBug];

// Inspector Elements
const inspectorCard = document.getElementById("responseInspectorCard");
const respStatusBadge = document.getElementById("respStatusBadge");
const respRecipientsVal = document.getElementById("respRecipientsVal");
const respIdVal = document.getElementById("respIdVal");
const outgoingPayloadJson = document.getElementById("outgoingPayloadJson");
const rawJsonResponse = document.getElementById("rawJsonResponse");
const payloadItemsCount = document.getElementById("payloadItemsCount");

let registeredDevices = [];

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

// 1. Audience Target Switcher
targetSelect.addEventListener("change", (e) => {
  if (e.target.value === "testing") {
    testingDevContainer.classList.remove("hidden");
    loadTestingDevices();
  } else {
    testingDevContainer.classList.add("hidden");
  }
});

// Device Fetching Logic (Direct parse of players array)
async function loadTestingDevices() {
  testingDevSelect.innerHTML = '<option value="">Fetching live subscriber IDs...</option>';
  selectedSubIdText.textContent = "";

  try {
    const res = await getOneSignalSubscribers({ limit: 50 });
    testingDevSelect.innerHTML = "";

    const playerList = res.players || (Array.isArray(res) ? res : []);

    if (!res.success && (!playerList || playerList.length === 0)) {
      testingDevSelect.innerHTML = '<option value="">No subscribed devices found</option>';
      selectedSubIdText.textContent = res.error || "No active devices";
      return;
    }

    registeredDevices = playerList;

    if (registeredDevices.length === 0) {
      testingDevSelect.innerHTML = '<option value="">No subscribed devices found</option>';
      return;
    }

    registeredDevices.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.device_model || 'Android Device'} (${p.id.slice(0, 16)}...)`;
      testingDevSelect.appendChild(opt);
    });

    // Auto-select first device and display ID
    if (testingDevSelect.value) {
      selectedSubIdText.textContent = `Target Subscription ID: ${testingDevSelect.value}`;
    }
  } catch (err) {
    testingDevSelect.innerHTML = '<option value="">Error fetching devices</option>';
    selectedSubIdText.textContent = err.message;
  }
}

testingDevSelect.addEventListener("change", () => {
  if (testingDevSelect.value) {
    selectedSubIdText.textContent = `Target Subscription ID: ${testingDevSelect.value}`;
  } else {
    selectedSubIdText.textContent = "";
  }
});

if (refreshDevsBtn) refreshDevsBtn.addEventListener("click", loadTestingDevices);

// 2. Banner Toggles Mutual Switch
allToggles.forEach(tog => {
  tog.addEventListener("change", () => {
    if (tog.checked) {
      allToggles.forEach(other => {
        if (other !== tog) other.checked = false;
      });
    }
  });
});

// 3. Mockup updates
titleInput.addEventListener("input", (e) => {
  const el = document.getElementById("mockupTitle");
  if (el) el.textContent = e.target.value.trim() || "Notification Title";
});

bodyInput.addEventListener("input", (e) => {
  const el = document.getElementById("mockupBody");
  if (el) el.textContent = e.target.value.trim() || "Message will show here...";
});

// 4. Form Submit with Validated Payload
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  const url = urlInput.value.trim();
  const bigPicture = bigPictureInput.value.trim();
  const largeIcon = largeIconInput.value.trim();
  const priority = parseInt(document.querySelector('input[name="bcPriority"]:checked').value);
  const targetMode = targetSelect.value;
  const selectedDevId = testingDevSelect.value;

  if (!title || !body) return;

  const submitBtn = document.getElementById("bcSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="material-symbols-outlined text-18 animate-spin">refresh</span> Calling OneSignal API...`;

  const actionButtons = [];
  const b1Text = btn1TextInput.value.trim();
  const b1Url = btn1UrlInput.value.trim();
  if (b1Text) actionButtons.push({ id: "btn_action_1", text: b1Text, url: b1Url || undefined });

  const b2Text = btn2TextInput.value.trim();
  const b2Url = btn2UrlInput.value.trim();
  if (b2Text) actionButtons.push({ id: "btn_action_2", text: b2Text, url: b2Url || undefined });

  let targetIds = [];

  if (targetMode === "testing") {
    if (!selectedDevId) {
      alert("Please select a device from the list.");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span class="material-symbols-outlined text-18">send</span> Send Notification Now`;
      return;
    }
    targetIds = [selectedDevId];
  } else {
    const subsRes = await getOneSignalSubscribers({ limit: 300 });
    if (subsRes.success && subsRes.players) {
      targetIds = subsRes.players
        .filter(p => !p.invalid_identifier)
        .map(p => p.id);
    }
  }

  // Exact Payload schema matching successful curl
  const oneSignalPayload = {
    target_channel: "push",
    headings: { en: title },
    contents: { en: body },
    priority: priority || 10,
    include_subscription_ids: targetIds
  };

  if (url) oneSignalPayload.url = url;
  if (bigPicture) oneSignalPayload.big_picture = bigPicture;
  if (largeIcon) oneSignalPayload.large_icon = largeIcon;
  if (actionButtons.length > 0) {
    oneSignalPayload.buttons = actionButtons;
    oneSignalPayload.web_buttons = actionButtons;
  }

  try {
    const pushRes = await sendPushNotification(oneSignalPayload);

    inspectorCard.classList.remove("hidden");
    const raw = pushRes.raw || pushRes;

    outgoingPayloadJson.textContent = JSON.stringify(raw.outgoingPayloadSent || oneSignalPayload, null, 2);
    rawJsonResponse.textContent = JSON.stringify(raw.rawOneSignalResponse || raw, null, 2);
    payloadItemsCount.textContent = `(${targetIds.length} Target IDs)`;

    const isSuccess = Boolean(pushRes.success && pushRes.id);

    if (isSuccess) {
      respStatusBadge.textContent = `HTTP ${pushRes.statusCode || 200} OK`;
      respStatusBadge.style.cssText = "background-color:rgba(4,120,87,0.15); color:var(--accent-mint); border:1px solid rgba(4,120,87,0.3);";
      respRecipientsVal.textContent = pushRes.recipients || targetIds.length;
      respIdVal.textContent = pushRes.id;
      respIdVal.style.color = "var(--accent-mint)";

      // Firebase Sync if toggle is ON
      let bannerType = null;
      if (toggleUpdate.checked) bannerType = "UPDATE";
      if (toggleNotice.checked) bannerType = "NOTICE";
      if (toggleBug.checked) bannerType = "BUG";

      if (bannerType) {
        await set(ref(database, "app_announcement"), {
          active: true,
          type: bannerType,
          title,
          message: body,
          url: url || "",
          updatedAt: Date.now()
        });
        showToast(`Sent & pinned as ${bannerType} banner in App!`, "success");
      } else {
        showToast("Notification successfully dispatched to device!", "success");
      }
    } else {
      respStatusBadge.textContent = `HTTP ${pushRes.statusCode || 400} REJECTED`;
      respStatusBadge.style.cssText = "background-color:rgba(190,18,60,0.15); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.3);";
      respRecipientsVal.textContent = "0";
      respIdVal.textContent = "No UUID Returned";
      respIdVal.style.color = "var(--accent-rose)";

      const errText = Array.isArray(pushRes.errors) ? pushRes.errors.join(", ") : (pushRes.errors || "Target device invalid or unsubscribed");
      showToast(`OneSignal Rejected: ${errText}`, "error");
    }

    inspectorCard.scrollIntoView({ behavior: "smooth" });

  } catch (err) {
    inspectorCard.classList.remove("hidden");
    respStatusBadge.textContent = `HTTP ${err.statusCode || 500} ERROR`;
    respStatusBadge.style.cssText = "background-color:rgba(190,18,60,0.15); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.3);";
    respRecipientsVal.textContent = "0";
    respIdVal.textContent = "Failed";
    respIdVal.style.color = "var(--accent-rose)";

    outgoingPayloadJson.textContent = JSON.stringify(oneSignalPayload, null, 2);
    rawJsonResponse.textContent = JSON.stringify(err.data || { error: err.message }, null, 2);

    alert("OneSignal Delivery Exception:\n" + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span class="material-symbols-outlined text-18">send</span> Send Notification Now`;
  }
});

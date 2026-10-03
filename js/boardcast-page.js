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

// Mockup Elements
const mockupTitle = document.getElementById("mockupTitle");
const mockupBody = document.getElementById("mockupBody");
const mockupPriorityBadge = document.getElementById("mockupPriorityBadge");
const mockupBigPicContainer = document.getElementById("mockupBigPictureContainer");
const mockupBigPicImg = document.getElementById("mockupBigPictureImg");
const mockupBtnsContainer = document.getElementById("mockupBtnsContainer");
const mockupBtn1 = document.getElementById("mockupBtn1");
const mockupBtn2 = document.getElementById("mockupBtn2");

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

// 1. LIVE PREVIEW UPDATE
function updateMockup() {
  if (titleInput && mockupTitle) {
    mockupTitle.textContent = titleInput.value.trim() || "Notification Title";
  }
  if (bodyInput && mockupBody) {
    mockupBody.textContent = bodyInput.value.trim() || "Message will show here...";
  }
}

if (titleInput) {
  titleInput.addEventListener("input", updateMockup);
  titleInput.addEventListener("keyup", updateMockup);
  titleInput.addEventListener("change", updateMockup);
}

if (bodyInput) {
  bodyInput.addEventListener("input", updateMockup);
  bodyInput.addEventListener("keyup", updateMockup);
  bodyInput.addEventListener("change", updateMockup);
}

// 2. AUDIENCE TARGET SWITCHER & DEVICE LOADER
function handleAudienceChange() {
  if (!targetSelect || !testingDevContainer) return;
  if (targetSelect.value === "testing") {
    testingDevContainer.classList.remove("hidden");
    testingDevContainer.style.display = "block";
    loadTestingDevices();
  } else {
    testingDevContainer.classList.add("hidden");
    testingDevContainer.style.display = "none";
  }
}

if (targetSelect) {
  targetSelect.addEventListener("change", handleAudienceChange);
  if (targetSelect.value === "testing") {
    handleAudienceChange();
  }
}

async function loadTestingDevices() {
  if (!testingDevSelect) return;
  testingDevSelect.innerHTML = '<option value="">Fetching live subscriber IDs...</option>';
  if (selectedSubIdText) selectedSubIdText.textContent = "";

  try {
    const res = await getOneSignalSubscribers();
    testingDevSelect.innerHTML = "";

    const playerList = res.players || (Array.isArray(res) ? res : []);

    if (!playerList || playerList.length === 0) {
      testingDevSelect.innerHTML = '<option value="">No subscribed devices found</option>';
      if (selectedSubIdText) selectedSubIdText.textContent = res.error || "No active devices registered";
      return;
    }

    registeredDevices = playerList;

    registeredDevices.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.device_model || 'Android Device'} (${p.id.slice(0, 16)}...)`;
      testingDevSelect.appendChild(opt);
    });

    if (testingDevSelect.value && selectedSubIdText) {
      selectedSubIdText.textContent = `Target Subscription ID: ${testingDevSelect.value}`;
    }
  } catch (err) {
    testingDevSelect.innerHTML = '<option value="">Error fetching devices</option>';
    if (selectedSubIdText) selectedSubIdText.textContent = err.message;
  }
}

if (testingDevSelect) {
  testingDevSelect.addEventListener("change", () => {
    if (testingDevSelect.value && selectedSubIdText) {
      selectedSubIdText.textContent = `Target Subscription ID: ${testingDevSelect.value}`;
    } else if (selectedSubIdText) {
      selectedSubIdText.textContent = "";
    }
  });
}

if (refreshDevsBtn) {
  refreshDevsBtn.addEventListener("click", loadTestingDevices);
}

// 3. PRIORITY BADGE & UI UPDATE FOR 3 MODES
document.querySelectorAll('input[name="bcPriority"]').forEach(r => {
  r.addEventListener("change", (e) => {
    if (!mockupPriorityBadge) return;
    if (e.target.value === "urgent") {
      mockupPriorityBadge.textContent = "URGENT POP";
      mockupPriorityBadge.style.cssText = "background-color:rgba(4,120,87,0.15); color:var(--accent-mint);";
    } else if (e.target.value === "high") {
      mockupPriorityBadge.textContent = "HIGH POP";
      mockupPriorityBadge.style.cssText = "background-color:rgba(180,83,9,0.15); color:var(--accent-amber);";
    } else {
      mockupPriorityBadge.textContent = "NORMAL QUIET";
      mockupPriorityBadge.style.cssText = "background-color:rgba(74,93,110,0.15); color:var(--text-muted);";
    }
  });
});

// 4. BIG PICTURE & BUTTONS PREVIEW
if (bigPictureInput) {
  bigPictureInput.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    if (val && mockupBigPicContainer && mockupBigPicImg) {
      mockupBigPicImg.src = val;
      mockupBigPicContainer.classList.remove("hidden");
    } else if (mockupBigPicContainer) {
      mockupBigPicContainer.classList.add("hidden");
    }
  });
}

function updateBtnMockups() {
  if (!mockupBtnsContainer || !mockupBtn1 || !mockupBtn2) return;
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

if (btn1TextInput) btn1TextInput.addEventListener("input", updateBtnMockups);
if (btn2TextInput) btn2TextInput.addEventListener("input", updateBtnMockups);

// 5. BANNER TOGGLES MUTUAL SWITCH
allToggles.forEach(tog => {
  if (!tog) return;
  tog.addEventListener("change", () => {
    if (tog.checked) {
      allToggles.forEach(other => {
        if (other && other !== tog) other.checked = false;
      });
    }
  });
});

// 6. FORM DISPATCH ENGINE (3-Modes Fully Configured)
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const url = urlInput ? urlInput.value.trim() : "";
    const bigPicture = bigPictureInput ? bigPictureInput.value.trim() : "";
    const largeIcon = largeIconInput ? largeIconInput.value.trim() : "";
    const selectedMode = document.querySelector('input[name="bcPriority"]:checked')?.value || "urgent";
    const targetMode = targetSelect.value;
    const selectedDevId = testingDevSelect ? testingDevSelect.value : "";

    if (!title || !body) return;

    const submitBtn = document.getElementById("bcSubmitBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="material-symbols-outlined text-18 animate-spin">refresh</span> Dispatching (${selectedMode.toUpperCase()})...`;
    }

    const actionButtons = [];
    const b1Text = btn1TextInput ? btn1TextInput.value.trim() : "";
    const b1Url = btn1UrlInput ? btn1UrlInput.value.trim() : "";
    if (b1Text) actionButtons.push({ id: "btn_action_1", text: b1Text, url: b1Url || undefined });

    const b2Text = btn2TextInput ? btn2TextInput.value.trim() : "";
    const b2Url = btn2UrlInput ? btn2UrlInput.value.trim() : "";
    if (b2Text) actionButtons.push({ id: "btn_action_2", text: b2Text, url: b2Url || undefined });

    let targetIds = [];

    if (targetMode === "testing") {
      if (!selectedDevId) {
        alert("Please select a device from the list.");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span class="material-symbols-outlined text-18">send</span> Send Notification Now`;
        }
        return;
      }
      targetIds = [selectedDevId];
    } else {
      const subsRes = await getOneSignalSubscribers();
      if (subsRes.success && subsRes.players) {
        targetIds = subsRes.players
          .filter(p => !p.invalid_identifier)
          .map(p => p.id);
      }
    }

    // Direct Payload Construction for Urgent vs High vs Normal
    const oneSignalPayload = {
      target_channel: "push",
      headings: { en: title },
      contents: { en: body },
      include_subscription_ids: targetIds,
      priority_mode: selectedMode
    };

    if (selectedMode === "urgent") {
      // Urgent: Force channel id, max priority, sound, and heads up pop
      oneSignalPayload.priority = 10;
      oneSignalPayload.existing_android_channel_id = "Result Alerts";
      oneSignalPayload.android_sound = "default";
      oneSignalPayload.android_visibility = 1;
      oneSignalPayload.android_accent_color = "FF047857";
    } else if (selectedMode === "high") {
      // High: Heads-up pop + sound without forcing channel override
      oneSignalPayload.priority = 10;
      oneSignalPayload.android_sound = "default";
      oneSignalPayload.android_visibility = 1;
    } else {
      // Normal: Quiet tray alert, no heads-up, no sound interrupt
      oneSignalPayload.priority = 5;
      oneSignalPayload.android_sound = null;
      oneSignalPayload.android_visibility = 0;
    }

    if (url) oneSignalPayload.url = url;
    if (bigPicture) oneSignalPayload.big_picture = bigPicture;
    if (largeIcon) oneSignalPayload.large_icon = largeIcon;
    if (actionButtons.length > 0) {
      oneSignalPayload.buttons = actionButtons;
      oneSignalPayload.web_buttons = actionButtons;
    }

    try {
      const pushRes = await sendPushNotification(oneSignalPayload);

      if (inspectorCard) inspectorCard.classList.remove("hidden");
      const raw = pushRes.raw || pushRes;

      if (outgoingPayloadJson) outgoingPayloadJson.textContent = JSON.stringify(raw.outgoingPayloadSent || oneSignalPayload, null, 2);
      if (rawJsonResponse) rawJsonResponse.textContent = JSON.stringify(raw.rawOneSignalResponse || raw, null, 2);
      if (payloadItemsCount) payloadItemsCount.textContent = `(${targetIds.length} Target IDs)`;

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

        // Firebase Sync
        let bannerType = null;
        if (toggleUpdate?.checked) bannerType = "UPDATE";
        if (toggleNotice?.checked) bannerType = "NOTICE";
        if (toggleBug?.checked) bannerType = "BUG";

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
          showToast(`Delivered successfully as ${selectedMode.toUpperCase()}!`, "success");
        }
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

// Initial Sync
updateMockup();
if (targetSelect && targetSelect.value === "testing") {
  handleAudienceChange();
}

import { ref, set, get } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
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

// Modal Elements
const openTemplateModalBtn = document.getElementById("openTemplateModalBtn");
const closeTemplateModalBtn = document.getElementById("closeTemplateModalBtn");
const templateModal = document.getElementById("templateModal");
const modalTemplatesList = document.getElementById("modalTemplatesList");

let registeredDevices = [];

// DEFAULT 6 TEMPLATES
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
    bannerType: "NOTICE"
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
    bannerType: "NOTICE"
  },
  {
    id: "def_university_exam",
    name: "University UG / PG Semester Result",
    priority: "high",
    title: "University Semester Result Declared 🎓",
    body: "BA, BSc, BCom Part 1/2/3 examination marksheet link is now activated on portal.",
    url: "https://ppup.ac.in",
    image: "",
    btn1Text: "Check Result",
    btn1Url: "https://ppup.ac.in",
    btn2Text: "Portal",
    btn2Url: "https://ppup.ac.in",
    bannerType: "NONE"
  },
  {
    id: "def_admit_card",
    name: "Admit Card / Hall Ticket Released",
    priority: "high",
    title: "Admit Card Released - Download Hall Ticket 🎟️",
    body: "Exam city slips and official hall tickets are now available. Download before exam date.",
    url: "https://example.com/admit-card",
    image: "",
    btn1Text: "Download Slip",
    btn1Url: "https://example.com/admit-card",
    btn2Text: "Official Notice",
    btn2Url: "https://example.com",
    bannerType: "NONE"
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
    bannerType: "UPDATE"
  },
  {
    id: "def_server_alert",
    name: "Emergency Server Maintenance Alert",
    priority: "urgent",
    title: "Server Maintenance In Progress ⚠️",
    body: "Result servers are undergoing routine maintenance for 30 minutes. Services will be restored shortly.",
    url: "",
    image: "",
    btn1Text: "",
    btn1Url: "",
    btn2Text: "",
    btn2Url: "",
    bannerType: "BUG"
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

// 1. LIVE PREVIEW UPDATE
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

// 3. BANNER TOGGLES MUTUAL SWITCH
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

// 4. TEMPLATE FETCH & AUTO-FILL ENGINE
async function fetchAllTemplatesList() {
  const combined = [...DEFAULT_PRESETS];
  try {
    const snap = await get(ref(database, "push_templates"));
    if (snap.exists()) {
      snap.forEach(child => {
        combined.push({ id: child.key, ...child.val() });
      });
    }
  } catch (err) {
    console.warn("Could not load templates:", err);
  }
  return combined;
}

function applyTemplate(t) {
  if (!t) return;

  if (titleInput) titleInput.value = t.title || "";
  if (bodyInput) bodyInput.value = t.body || "";

  if (t.priority) {
    const radio = document.querySelector(`input[name="bcPriority"][value="${t.priority}"]`);
    if (radio) radio.checked = true;
  }

  if (urlInput) urlInput.value = t.url || "";
  if (bigPictureInput) bigPictureInput.value = t.image || "";
  if (largeIconInput) largeIconInput.value = t.image || "";

  if (btn1TextInput) btn1TextInput.value = t.btn1Text || "";
  if (btn1UrlInput) btn1UrlInput.value = t.btn1Url || "";

  if (btn2TextInput) btn2TextInput.value = t.btn2Text || "";
  if (btn2UrlInput) btn2UrlInput.value = t.btn2Url || "";

  // Reset toggles then set
  allToggles.forEach(tog => { if (tog) tog.checked = false; });
  if (t.bannerType === "UPDATE" && toggleUpdate) toggleUpdate.checked = true;
  if (t.bannerType === "NOTICE" && toggleNotice) toggleNotice.checked = true;
  if (t.bannerType === "BUG" && toggleBug) toggleBug.checked = true;

  updateMockup();
  showToast(`Applied: "${t.name}"!`, "success");
}

// Check session storage if redirected from templates.html
const savedTpl = sessionStorage.getItem("resultify_selected_template");
if (savedTpl) {
  try {
    const parsed = JSON.parse(savedTpl);
    applyTemplate(parsed);
    sessionStorage.removeItem("resultify_selected_template");
  } catch (e) {}
}

// Open Template Modal
if (openTemplateModalBtn && templateModal) {
  openTemplateModalBtn.addEventListener("click", async () => {
    templateModal.classList.remove("hidden");
    if (!modalTemplatesList) return;
    modalTemplatesList.innerHTML = '<p class="text-xs text-center py-4">Loading templates...</p>';

    const templates = await fetchAllTemplatesList();
    modalTemplatesList.innerHTML = "";

    templates.forEach(t => {
      const card = document.createElement("div");
      card.className = "p-3 rounded-2xl border surface-card space-y-2.5";
      card.style.borderColor = "var(--border-subtle)";

      const badgeColor = t.priority === "urgent" 
        ? "background:rgba(4,120,87,0.15); color:var(--accent-mint);" 
        : (t.priority === "high" ? "background:rgba(180,83,9,0.15); color:var(--accent-amber);" : "background:rgba(74,93,110,0.15); color:var(--text-muted);");

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold" style="color:var(--text-primary);">${t.name}</h4>
          <span class="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase" style="${badgeColor}">${t.priority}</span>
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
        <button type="button" class="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm" style="background-color:var(--accent-mint); color:#FFFFFF;">
          <span class="material-symbols-outlined text-16">done_all</span>
          <span>Use Me / Select Me</span>
        </button>
      `;

      card.querySelector("button").addEventListener("click", () => {
        applyTemplate(t);
        templateModal.classList.add("hidden");
      });

      modalTemplatesList.appendChild(card);
    });
  });
}

if (closeTemplateModalBtn && templateModal) {
  closeTemplateModalBtn.addEventListener("click", () => templateModal.classList.add("hidden"));
}

// 5. FORM DISPATCH ENGINE
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

        // In boardcast-page.js -> form submit listener
    const selectedChannel = document.getElementById("bcChannelSelect")?.value || "Result Alerts";

    const oneSignalPayload = {
      target_channel: "push",
      headings: { en: title },
      contents: { en: body },
      include_subscription_ids: targetIds,
      priority_mode: selectedMode,
      existing_android_channel_id: selectedChannel
    };


    if (selectedMode === "urgent") {
      oneSignalPayload.priority = 10;
      oneSignalPayload.existing_android_channel_id = "Result Alerts";
      oneSignalPayload.android_sound = "default";
      oneSignalPayload.android_visibility = 1;
      oneSignalPayload.android_accent_color = "FF047857";
    } else if (selectedMode === "high") {
      oneSignalPayload.priority = 10;
      oneSignalPayload.android_sound = "default";
      oneSignalPayload.android_visibility = 1;
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

        // Firebase Announcement Sync
        let bannerType = null;
        if (toggleUpdate?.checked) bannerType = "UPDATE";
        if (toggleNotice?.checked) bannerType = "NOTICE";
        if (toggleBug?.checked) bannerType = "BUG";

        if (bannerType) {
          try {
            await set(ref(database, "app_announcement"), {
              active: true,
              type: bannerType,
              title,
              message: body,
              url: url || "",
              updatedAt: Date.now()
            });
            showToast(`Sent & pinned as ${bannerType} banner in App!`, "success");
          } catch (firebaseErr) {
            console.warn("[Firebase Rule Denied]:", firebaseErr.message);
            showToast(`Push sent! (Firebase sync skipped: ${firebaseErr.code})`, "info");
          }
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

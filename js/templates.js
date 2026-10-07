import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { database } from "./firebase-config.js";

// DOM Elements
const form = document.getElementById("templateForm");
const tplName = document.getElementById("tplName");
const tplTitle = document.getElementById("tplTitle");
const tplBody = document.getElementById("tplBody");
const tplUrl = document.getElementById("tplUrl");
const tplImage = document.getElementById("tplImage");
const tplBtn1Text = document.getElementById("tplBtn1Text");
const tplBtn1Url = document.getElementById("tplBtn1Url");
const tplBtn2Text = document.getElementById("tplBtn2Text");
const tplBtn2Url = document.getElementById("tplBtn2Url");

// Live Preview
const prevTitle = document.getElementById("prevTitle");
const prevBody = document.getElementById("prevBody");
const prevBadge = document.getElementById("prevBadge");
const prevImageWrap = document.getElementById("prevImageWrap");
const prevImg = document.getElementById("prevImg");
const prevBtnsWrap = document.getElementById("prevBtnsWrap");
const prevB1 = document.getElementById("prevB1");
const prevB2 = document.getElementById("prevB2");

const listContainer = document.getElementById("templatesListContainer");
const tplCountBadge = document.getElementById("tplCountBadge");

// DEFAULT 6 CLEAN PRESETS (Pure Push Standard)
export const DEFAULT_TEMPLATES = [
  {
    id: "def_bpsc_result",
    name: "BPSC Result Declared (Urgent)",
    priority: "urgent",
    title: "BPSC Final Result & Cutoff Declared! 🎯",
    body: "Merit list and scorecards are now published officially. Check your roll number and cutoff marks.",
    url: "https://bpsc.bihar.gov.in",
    image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800",
    btn1Text: "Check Result",
    btn1Url: "https://bpsc.bihar.gov.in",
    btn2Text: "Download PDF",
    btn2Url: "https://bpsc.bihar.gov.in/pdf",
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
    id: "def_university_exam",
    name: "University UG / PG Semester Result",
    priority: "high",
    title: "Patliputra / Magadh Univ Semester Result Out 🎓",
    body: "BA, BSc, BCom Part 1/2/3 examination marksheet link is now activated on examination portal.",
    url: "https://ppup.ac.in",
    image: "",
    btn1Text: "Marksheet",
    btn1Url: "https://ppup.ac.in/results",
    btn2Text: "College Login",
    btn2Url: "https://ppup.ac.in",
    isDefault: true
  },
  {
    id: "def_admit_card",
    name: "Admit Card / Hall Ticket Released",
    priority: "high",
    title: "Admit Card Released - Download Hall Ticket 🎟️",
    body: "Exam city slips and official hall tickets are now available. Download before portal closes.",
    url: "https://example.com/admit-card",
    image: "",
    btn1Text: "Download Slip",
    btn1Url: "https://example.com/admit-card",
    btn2Text: "Center Details",
    btn2Url: "https://example.com/centers",
    isDefault: true
  },
  {
    id: "def_app_update",
    name: "Resultify New Update Available",
    priority: "high",
    title: "New Resultify Update v1.2 Available 🚀",
    body: "Faster server load, instant result PDF downloads and bug fixes inside. Update now on Play Store!",
    url: "https://play.google.com/store/apps/details?id=com.resultify.app",
    image: "",
    btn1Text: "Update Now",
    btn1Url: "https://play.google.com/store/apps/details?id=com.resultify.app",
    btn2Text: "Later",
    btn2Url: "",
    isDefault: true
  },
  {
    id: "def_server_maintenance",
    name: "Emergency Server Maintenance Alert",
    priority: "urgent",
    title: "Emergency Server Maintenance Notice ⚠️",
    body: "Results syncing server will be under routine maintenance for 30 minutes. Services will resume shortly.",
    url: "",
    image: "",
    btn1Text: "",
    btn1Url: "",
    btn2Text: "",
    btn2Url: "",
    isDefault: true
  }
];

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(msg, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const t = document.createElement("div");
  t.className = "px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md flex items-center gap-2";
  t.style.cssText = type === "success" 
    ? "background:#DDD6C7; border:1px solid #047857; color:#047857;" 
    : "background:#DDD6C7; border:1px solid #BE123C; color:#BE123C;";
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// 1. LIVE PREVIEW UPDATE
function updateLivePreview() {
  if (prevTitle) prevTitle.textContent = tplTitle.value.trim() || "Notification Title";
  if (prevBody) prevBody.textContent = tplBody.value.trim() || "Message body will appear here...";

  const prio = document.querySelector('input[name="tplPriority"]:checked')?.value || "urgent";
  if (prevBadge) {
    if (prio === "urgent") {
      prevBadge.textContent = "URGENT POP";
      prevBadge.style.cssText = "background-color:rgba(4,120,87,0.15); color:var(--accent-mint);";
    } else if (prio === "high") {
      prevBadge.textContent = "HIGH POP";
      prevBadge.style.cssText = "background-color:rgba(180,83,9,0.15); color:var(--accent-amber);";
    } else {
      prevBadge.textContent = "NORMAL QUIET";
      prevBadge.style.cssText = "background-color:rgba(74,93,110,0.15); color:var(--text-muted);";
    }
  }

  const imgVal = tplImage?.value.trim();
  if (imgVal && prevImageWrap && prevImg) {
    prevImg.src = imgVal;
    prevImageWrap.classList.remove("hidden");
  } else if (prevImageWrap) {
    prevImageWrap.classList.add("hidden");
  }

  const b1 = tplBtn1Text?.value.trim();
  const b2 = tplBtn2Text?.value.trim();
  if (b1 || b2) {
    prevBtnsWrap.classList.remove("hidden");
    prevB1.textContent = b1 || "Button 1";
    prevB1.style.display = b1 ? "inline-block" : "none";
    prevB2.textContent = b2 || "Button 2";
    prevB2.style.display = b2 ? "inline-block" : "none";
  } else {
    prevBtnsWrap.classList.add("hidden");
  }
}

[tplTitle, tplBody, tplImage, tplBtn1Text, tplBtn2Text].forEach(el => {
  if (el) {
    el.addEventListener("input", updateLivePreview);
  }
});
document.querySelectorAll('input[name="tplPriority"]').forEach(r => r.addEventListener("change", updateLivePreview));

// 2. FETCH ALL TEMPLATES (BUILT-IN + FIREBASE RTDB)
export async function getAllTemplates() {
  const combined = [...DEFAULT_TEMPLATES];
  try {
    const snap = await get(ref(database, "push_templates"));
    if (snap.exists()) {
      snap.forEach(child => {
        combined.push({ id: child.key, ...child.val(), isDefault: false });
      });
    }
  } catch (err) {
    console.warn("Could not load RTDB templates:", err.message);
  }
  return combined;
}

// 3. RENDER SAVED LIST (Safe & Crash-Free Loop)
async function renderTemplatesList() {
  if (!listContainer) return;
  listContainer.innerHTML = '<p class="text-xs text-center py-4" style="color:var(--text-muted);">Loading templates...</p>';

  const templates = await getAllTemplates();
  if (tplCountBadge) tplCountBadge.textContent = `${templates.length} Total`;

  listContainer.innerHTML = "";

  templates.forEach(t => {
    const card = document.createElement("div");
    card.className = "p-3.5 rounded-2xl border surface-card space-y-2.5 relative";
    card.style.borderColor = "var(--border-subtle)";

    const badgeColor = t.priority === "urgent" 
      ? "background:rgba(4,120,87,0.15); color:var(--accent-mint);" 
      : (t.priority === "high" ? "background:rgba(180,83,9,0.15); color:var(--accent-amber);" : "background:rgba(74,93,110,0.15); color:var(--text-muted);");

    const imgTag = t.image && t.image.trim()
      ? `<div class="mt-1.5 max-h-24 overflow-hidden rounded"><img src="${escapeHtml(t.image.trim())}" class="w-full h-auto object-cover" /></div>`
      : "";

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <h4 class="text-xs font-bold" style="color:var(--text-primary);">${escapeHtml(t.name || "Template")}</h4>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase" style="${badgeColor}">${escapeHtml(t.priority || "urgent")}</span>
            ${t.isDefault ? `<span class="text-[9px] font-bold text-gray-500">DEFAULT</span>` : ''}
          </div>
        </div>
        ${!t.isDefault ? `
          <button data-del="${escapeHtml(t.id)}" class="delTplBtn text-rose-500 hover:text-rose-700 p-1" title="Delete Template">
            <span class="material-symbols-outlined text-16">delete</span>
          </button>
        ` : ''}
      </div>

      <!-- Preview Box -->
      <div class="p-2.5 rounded-xl border bg-black/5 text-[11px] space-y-1" style="border-color:var(--border-subtle);">
        <p class="font-bold text-xs" style="color:var(--text-primary);">${escapeHtml(t.title || "")}</p>
        <p class="line-clamp-2" style="color:var(--text-muted);">${escapeHtml(t.body || "")}</p>
        ${imgTag}
        ${(t.btn1Text || t.btn2Text) ? `
          <div class="flex gap-2 pt-1">
            ${t.btn1Text ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded surface-card border" style="color:var(--accent-mint);">${escapeHtml(t.btn1Text)}</span>` : ''}
            ${t.btn2Text ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded surface-card border" style="color:var(--accent-mint);">${escapeHtml(t.btn2Text)}</span>` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Use Button -->
      <button data-use="${escapeHtml(t.id)}" class="useTplBtn w-full py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm" style="background-color:rgba(4,120,87,0.15); color:var(--accent-mint); border:1px solid rgba(4,120,87,0.3);">
        <span class="material-symbols-outlined text-16">check_circle</span>
        <span>Use This Preset</span>
      </button>
    `;

    // Delete Event
    const delBtn = card.querySelector(".delTplBtn");
    if (delBtn) {
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${t.name}" template?`)) {
          await remove(ref(database, `push_templates/${t.id}`));
          showToast("Template deleted successfully", "success");
          renderTemplatesList();
        }
      });
    }

    // Use Button Event
    const useBtn = card.querySelector(".useTplBtn");
    if (useBtn) {
      useBtn.addEventListener("click", () => {
        const cleanTpl = {
          name: String(t.name || ""),
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
        sessionStorage.setItem("resultify_selected_template", JSON.stringify(cleanTpl));
        window.location.href = "broadcast.html";
      });
    }

    listContainer.appendChild(card);
  });
}

// 4. SAVE NEW TEMPLATE FORM SUBMIT
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = tplName.value.trim();
    const title = tplTitle.value.trim();
    const body = tplBody.value.trim();
    const priority = document.querySelector('input[name="tplPriority"]:checked')?.value || "urgent";
    const url = tplUrl ? tplUrl.value.trim() : "";
    const image = tplImage ? tplImage.value.trim() : "";
    const btn1Text = tplBtn1Text ? tplBtn1Text.value.trim() : "";
    const btn1Url = tplBtn1Url ? tplBtn1Url.value.trim() : "";
    const btn2Text = tplBtn2Text ? tplBtn2Text.value.trim() : "";
    const btn2Url = tplBtn2Url ? tplBtn2Url.value.trim() : "";

    if (!name || !title || !body) return;

    const newId = "tpl_" + Date.now();
    const payload = {
      name,
      title,
      body,
      priority,
      url,
      image,
      btn1Text,
      btn1Url,
      btn2Text,
      btn2Url,
      createdAt: Date.now()
    };

    try {
      await set(ref(database, `push_templates/${newId}`), payload);
      showToast("Template saved in Firebase!", "success");
      form.reset();
      updateLivePreview();
      renderTemplatesList();
    } catch (err) {
      showToast("Error saving template: " + err.message, "error");
    }
  });
}

// Initial Run
updateLivePreview();
renderTemplatesList();

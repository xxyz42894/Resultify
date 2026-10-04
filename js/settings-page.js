import { ref, get, set } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { database } from "./firebase-config.js";

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
    error: "background-color:#DDD6C7; border:1px solid #BE123C; color:#BE123C;"
  };
  toast.className = "flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-md";
  toast.style.cssText = colors[type] || "background-color:#DDD6C7; border:1px solid #BAAF98; color:#0E7490;";
  toast.innerHTML = `<span class="material-symbols-outlined text-18">info</span><span class="text-xs font-semibold">${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

async function initGoogleAuthToggle() {
  const toggle = document.getElementById("toggleGoogleAuth");
  if (!toggle) return;
  try {
    const snap = await get(ref(database, "admin_settings/allowGoogleAuth"));
    toggle.checked = snap.exists() ? snap.val() : true;
    toggle.onchange = async () => {
      await set(ref(database, "admin_settings/allowGoogleAuth"), toggle.checked);
      showToast(toggle.checked ? "Google login enabled" : "Google login disabled", "success");
    };
  } catch (e) {
    showToast("Error loading toggle: " + e.message, "error");
  }
}

async function initRemoteConfig() {
  try {
    const snap = await get(ref(database, "app_config"));
    if (snap.exists()) {
      const cfg = snap.val();
      document.getElementById("cfgBannerText").value = cfg.bannerText || "";
      document.getElementById("cfgBannerActive").checked = Boolean(cfg.bannerActive);
      document.getElementById("cfgForceActive").checked = Boolean(cfg.forceUpdateActive);
      document.getElementById("cfgForceVersion").value = cfg.minVersionCode || 1;
      document.getElementById("cfgUpdateUrl").value = cfg.updateUrl || "";
    }
  } catch (e) {
    console.warn("Config load error:", e.message);
  }

  const saveBtn = document.getElementById("saveRemoteConfigBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const bannerText = document.getElementById("cfgBannerText").value.trim();
      const bannerActive = document.getElementById("cfgBannerActive").checked;
      const forceUpdateActive = document.getElementById("cfgForceActive").checked;
      const minVersionCode = parseInt(document.getElementById("cfgForceVersion").value) || 1;
      const updateUrl = document.getElementById("cfgUpdateUrl").value.trim();

      try {
        await set(ref(database, "app_config"), {
          bannerText,
          bannerActive,
          forceUpdateActive,
          minVersionCode,
          updateUrl,
          updatedAt: Date.now()
        });
        showToast("Config broadcasted to Android apps!", "success");
      } catch (err) {
        showToast("Save failed: " + err.message, "error");
      }
    });
  }
}

const backupBtn = document.getElementById("exportBackupBtn");
if (backupBtn) {
  backupBtn.addEventListener("click", async () => {
    try {
      const snap = await get(ref(database, "results"));
      const data = snap.exists() ? snap.val() : {};
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resultify_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      showToast("Database backup downloaded", "success");
    } catch (err) {
      showToast("Backup error: " + err.message, "error");
    }
  });
}

initGoogleAuthToggle();
initRemoteConfig();

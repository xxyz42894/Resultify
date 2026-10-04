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

// 1. Google Auth Switch Sync
async function initGoogleAuthToggle() {
  const toggle = document.getElementById("toggleGoogleAuth");
  if (!toggle) return;

  try {
    const snap = await get(ref(database, "admin_settings/allowGoogleAuth"));
    toggle.checked = snap.exists() ? Boolean(snap.val()) : true;

    toggle.onchange = async () => {
      try {
        await set(ref(database, "admin_settings/allowGoogleAuth"), toggle.checked);
        showToast(toggle.checked ? "Google Sign-In is now Enabled" : "Google Sign-In is now Disabled", "success");
      } catch (err) {
        toggle.checked = !toggle.checked; // Revert if failed
        showToast("Update failed: " + err.message, "error");
      }
    };
  } catch (e) {
    showToast("Error loading toggle: " + e.message, "error");
  }
}

// 2. Remote Config & In-App Banner
async function initRemoteConfig() {
  try {
    const snap = await get(ref(database, "app_config"));
    if (snap.exists()) {
      const cfg = snap.val();
      const txt = document.getElementById("cfgBannerText");
      const bAct = document.getElementById("cfgBannerActive");
      const fAct = document.getElementById("cfgForceActive");
      const ver = document.getElementById("cfgForceVersion");
      const url = document.getElementById("cfgUpdateUrl");

      if (txt) txt.value = cfg.bannerText || "";
      if (bAct) bAct.checked = Boolean(cfg.bannerActive);
      if (fAct) fAct.checked = Boolean(cfg.forceUpdateActive);
      if (ver) ver.value = cfg.minVersionCode || 1;
      if (url) url.value = cfg.updateUrl || "";
    }
  } catch (e) {
    console.warn("Config load error:", e.message);
  }

  const saveBtn = document.getElementById("saveRemoteConfigBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const bannerText = document.getElementById("cfgBannerText")?.value.trim() || "";
      const bannerActive = Boolean(document.getElementById("cfgBannerActive")?.checked);
      const forceUpdateActive = Boolean(document.getElementById("cfgForceActive")?.checked);
      const minVersionCode = parseInt(document.getElementById("cfgForceVersion")?.value) || 1;
      const updateUrl = document.getElementById("cfgUpdateUrl")?.value.trim() || "";

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

// 3. Database Backup Export
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
      showToast("Database backup downloaded successfully", "success");
    } catch (err) {
      showToast("Backup error: " + err.message, "error");
    }
  });
}

initGoogleAuthToggle();
initRemoteConfig();

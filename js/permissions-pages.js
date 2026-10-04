import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";

let currentAdminUid = null;
let currentAdminEmail = "";

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

// Security Check: Only "Owner" role is allowed on this page
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("index.html");
    return;
  }
  
  currentAdminUid = user.uid;
  currentAdminEmail = (user.email || "").toLowerCase();

  try {
    const roleSnap = await get(ref(database, `admin_users/${user.uid}`));
    
    // Agar user database me exist nahi karta to use Owner initialize karein
    if (!roleSnap.exists()) {
      await set(ref(database, `admin_users/${user.uid}`), {
        email: currentAdminEmail,
        role: "owner",
        addedAt: Date.now()
      });
    } else {
      const role = roleSnap.val().role || "owner";
      if (role !== "owner") {
        alert("Unauthorized: Only the Owner can manage team permissions.");
        window.location.replace("dashboard.html");
        return;
      }
    }
  } catch (e) {
    console.warn("Owner check warning:", e.message);
  }

  loadTeamList();
});

async function loadTeamList() {
  const container = document.getElementById("teamList");
  const loading = document.getElementById("teamLoading");
  if (loading) loading.classList.remove("hidden");
  if (container) container.innerHTML = "";

  try {
    const snap = await get(ref(database, "admin_users"));
    if (loading) loading.classList.add("hidden");

    if (!snap.exists()) {
      container.innerHTML = '<p class="text-xs py-3 text-center" style="color:var(--text-subtle);">No partner admins invited yet.</p>';
      return;
    }

    let partnerCount = 0;

    snap.forEach(child => {
      const data = child.val();
      // Apne account ko delete/revoke list me na dikhaye
      if (child.key === currentAdminUid || data.email?.toLowerCase() === currentAdminEmail) return;

      partnerCount++;
      const roleBadge = data.role === "editor" 
        ? '<span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold" style="background-color:rgba(180,83,9,0.15); color:var(--accent-amber); border:1px solid rgba(180,83,9,0.3);">EDITOR</span>'
        : '<span class="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold" style="background-color:rgba(14,116,144,0.15); color:var(--accent-cyan); border:1px solid rgba(14,116,144,0.3);">VIEWER</span>';

      const card = document.createElement("div");
      card.className = "p-3 rounded-2xl surface-card flex items-center justify-between border";
      card.style.borderColor = "var(--border-subtle)";
      card.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0 pr-2">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background-color:rgba(4,120,87,0.12); color:var(--accent-mint);">
            <span class="material-symbols-outlined text-18">person</span>
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold truncate" style="color:var(--text-primary);">${escapeHtml(data.email)}</p>
            <div class="mt-0.5">${roleBadge}</div>
          </div>
        </div>
        <button data-uid="${child.key}" class="revokeBtn px-2.5 py-1 text-[11px] rounded-lg font-bold transition-all active:scale-95" style="background-color:rgba(190,18,60,0.12); color:var(--accent-rose); border:1px solid rgba(190,18,60,0.25);">
          Revoke
        </button>
      `;
      container.appendChild(card);
    });

    if (partnerCount === 0) {
      container.innerHTML = '<p class="text-xs py-3 text-center" style="color:var(--text-subtle);">No partner admins invited yet.</p>';
    }

    document.querySelectorAll(".revokeBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (confirm("Revoke this partner's access permanently?")) {
          await remove(ref(database, `admin_users/${btn.dataset.uid}`));
          showToast("Access revoked successfully", "success");
          loadTeamList();
        }
      });
    });
  } catch (err) {
    if (loading) loading.classList.add("hidden");
    showToast("Error loading team: " + err.message, "error");
  }
}

const inviteForm = document.getElementById("invitePartnerForm");
if (inviteForm) {
  inviteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("partnerEmail").value.trim().toLowerCase();
    const role = document.getElementById("partnerRole").value;
    const submitBtn = document.getElementById("inviteBtn");

    if (!email) return;

    if (email === currentAdminEmail) {
      showToast("Aap khud ko invite nahi kar sakte!", "error");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Authorizing...";
    }

    try {
      const userSnap = await get(ref(database, "admin_users"));
      let targetKey = `partner_${Date.now()}`;
      
      if (userSnap.exists()) {
        userSnap.forEach(child => {
          if (child.val().email?.toLowerCase() === email) {
            targetKey = child.key;
          }
        });
      }

      await set(ref(database, `admin_users/${targetKey}`), {
        email,
        role,
        addedAt: Date.now(),
        invitedBy: currentAdminUid
      });

      showToast(`Partner authorized as ${role.toUpperCase()}!`, "success");
      inviteForm.reset();
      loadTeamList();
    } catch (err) {
      showToast("Authorization failed: " + err.message, "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Authorize Partner Access";
      }
    }
  });
}

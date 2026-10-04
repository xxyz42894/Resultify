import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";

// Clean Dynamic URL Resolver (Supports root, subfolder, and localhost)
function getLoginUrl() {
  const currentUrl = new URL(window.location.href);
  const pathParts = currentUrl.pathname.split("/").filter(Boolean);
  
  if (pathParts.length > 1) {
    pathParts.pop(); // Remove current file (e.g. broadcast.html, results.html)
    pathParts.push("index.html");
    return `${currentUrl.origin}/${pathParts.join("/")}`;
  }
  return `${currentUrl.origin}/index.html`;
}

// Current Page check
const pathname = (window.location.pathname || "").toLowerCase();
const isLoginPage = pathname.endsWith("index.html") || pathname === "/" || pathname.endsWith("/web_app/") || pathname.endsWith("/web_app");

if (isLoginPage) {
  document.body.classList.add("auth-passed");
}

// Auth State Monitor
onAuthStateChanged(auth, async (user) => {
  // 1. Agar login page par hain toh koi check nahi chalega
  if (isLoginPage) {
    document.body.classList.add("auth-passed");
    return;
  }

  // 2. UN-AUTHENTICATED: Block UI & Show Access Denied
  if (!user) {
    // Stop any pending DOM/Interval tasks
    window.stop();

    document.body.className = "";
    document.body.classList.add("auth-passed"); // Allow only the lock screen to show

    document.body.innerHTML = `
      <div style="min-height:100vh;background-color:#E8E2D5;color:#1B2834;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;user-select:none;">
        <div style="width:72px;height:72px;border-radius:24px;background-color:rgba(190,18,60,0.12);border:1px solid rgba(190,18,60,0.25);display:flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
          <span style="font-size:32px;">🔒</span>
        </div>
        <h1 style="font-size:20px;font-weight:bold;margin-bottom:8px;color:#1B2834;letter-spacing:-0.02em;">404 - Access Denied</h1>
        <p style="font-size:12px;color:#4A5D6E;max-width:300px;line-height:1.6;margin-bottom:24px;font-weight:500;">
          Aap bina login kiye direct is administrative page ko open nahi kar sakte. Pehle login verify karein.
        </p>
        <button id="directLoginBtn" type="button" style="padding:12px 28px;background-color:#047857;color:#FFFFFF;border-radius:14px;font-size:13px;font-weight:bold;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(4,120,87,0.25);outline:none;">
          Go to Login Screen
        </button>
      </div>
    `;

    const btn = document.getElementById("directLoginBtn");
    if (btn) {
      btn.onclick = () => {
        btn.textContent = "Redirecting...";
        btn.disabled = true;
        window.location.href = getLoginUrl();
      };
    }
    return;
  }

  // 3. AUTHENTICATED: Role Checks
  try {
    const roleSnap = await get(ref(database, `admin_users/${user.uid}/role`));
    const role = roleSnap.exists() ? roleSnap.val() : "owner";

    if (pathname.includes("permissions.html") && role !== "owner") {
      alert("Unauthorized Access: Only Owners can manage roles.");
      window.location.replace("dashboard.html");
      return;
    }
  } catch (err) {
    console.warn("Role guard fallback:", err.message);
  }

  // Access Granted: Unhide Full Screen
  document.body.classList.add("auth-passed");
});

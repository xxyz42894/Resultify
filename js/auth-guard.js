import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

document.documentElement.style.visibility = "hidden";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    document.documentElement.style.visibility = "visible";
    document.body.innerHTML = `
      <div style="min-height:100vh;background:#E8E2D5;color:#1B2834;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:sans-serif;">
        <div style="width:68px;height:68px;border-radius:22px;background:rgba(190,18,60,0.12);border:1px solid rgba(190,18,60,0.3);display:flex;align-items:center;justify-content:center;margin-bottom:18px;">
          <span style="font-size:32px;color:#BE123C;">🔒</span>
        </div>
        <h1 style="font-size:22px;font-weight:bold;margin-bottom:8px;color:#1B2834;">404 - Access Denied</h1>
        <p style="font-size:13px;color:#4A5D6E;max-width:320px;line-height:1.6;margin-bottom:24px;">
          Aap bina login kiye direct is administrative page ko open nahi kar sakte. Pehle login verify karein.
        </p>
        <a href="index.html" style="padding:12px 24px;background:#047857;color:#E8E2D5;border-radius:12px;font-size:13px;font-weight:bold;text-decoration:none;box-shadow:0 4px 14px rgba(4,120,87,0.25);">
          Go to Login Screen
        </a>
      </div>
    `;
  } else {
    document.documentElement.style.visibility = "visible";
  }
});

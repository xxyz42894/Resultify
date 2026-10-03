import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";

const googleProvider = new GoogleAuthProvider();
const googleAuthSection = document.getElementById("googleAuthSection");
const googleDisabledNotice = document.getElementById("googleDisabledNotice");

// Check if Owner has allowed Google Sign-In
async function checkGoogleAuthSettings() {
  try {
    const snapshot = await get(ref(database, "admin_settings/allowGoogleAuth"));
    const allowed = snapshot.exists() ? snapshot.val() : true;
    if (!allowed) {
      if (googleAuthSection) googleAuthSection.classList.add("hidden");
      if (googleDisabledNotice) googleDisabledNotice.classList.remove("hidden");
    }
  } catch (e) {
    console.warn("Auth settings check bypassed:", e.message);
  }
}
checkGoogleAuthSettings();

// Universal Route Guard (Redirects if already logged in)
onAuthStateChanged(auth, (user) => {
  const path = window.location.pathname;
  const isLoginPage = path.endsWith("index.html") || path.endsWith("login.html") || path === "/" || path === "";
  if (user && isLoginPage) {
    window.location.href = "dashboard.html";
  }
});

// Email/Password Login
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const errBox = document.getElementById("errorMessage");

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.classList.remove("hidden");
      }
    }
  });
}

// Google Login
const googleBtn = document.getElementById("googleSignInBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      window.location.href = "dashboard.html";
    } catch (err) {
      alert("Google Sign-In Error: " + err.message);
    }
  });
}

// Authentication Module - Firebase Auth with Google Sign-In & Email/Password
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

// DOM Elements
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("togglePassword");
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginSpinner = document.getElementById("loginSpinner");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const googleBtnText = document.getElementById("googleBtnText");
const googleSpinner = document.getElementById("googleSpinner");
const errorMessage = document.getElementById("errorMessage");
const errorText = document.getElementById("errorText");
const toastContainer = document.getElementById("toastContainer");

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

// Set Auth Persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting persistence:", error);
});

// Auth State Listener - Route Guard
onAuthStateChanged(auth, (user) => {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  
  if (user) {
    // User is authenticated
    if (currentPage === "login.html") {
      window.location.href = "index.html";
    }
  } else {
    // User is not authenticated
    if (currentPage !== "login.html") {
      window.location.href = "login.html";
    }
  }
});

// Show/Hide Password Toggle
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    const icon = togglePasswordBtn.querySelector(".material-symbols-outlined");
    icon.textContent = type === "password" ? "visibility" : "visibility_off";
  });
}

// Email/Password Login
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
      showError("Please enter both email and password");
      return;
    }
    
    setLoading(loginBtn, loginBtnText, loginSpinner, true);
    hideError();
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Login successful! Redirecting...", "success");
      // Redirect handled by onAuthStateChanged
    } catch (error) {
      console.error("Login error:", error, "code:", error.code);
      const errorMsg = getAuthErrorMessage(error.code);
      showError(errorMsg);
      setLoading(loginBtn, loginBtnText, loginSpinner, false);
    }
  });
}

// Google Sign In
if (googleSignInBtn) {
  googleSignInBtn.addEventListener("click", async () => {
    setLoading(googleSignInBtn, googleBtnText, googleSpinner, true);
    hideError();
    
    try {
      await signInWithPopup(auth, googleProvider);
      showToast("Google sign-in successful! Redirecting...", "success");
      // Redirect handled by onAuthStateChanged
    } catch (error) {
      console.error("Google sign-in error:", error, "code:", error.code);
      const errorMsg = getAuthErrorMessage(error.code);
      showError(errorMsg);
      setLoading(googleSignInBtn, googleBtnText, googleSpinner, false);
    }
  });
}

// Logout Function (exported for use in dashboard)
export async function logout() {
  try {
    await signOut(auth);
    showToast("Logged out successfully", "success");
  } catch (error) {
    console.error("Logout error:", error);
    showToast("Error logging out", "error");
  }
}

// Utility Functions
function setLoading(button, textEl, spinnerEl, isLoading) {
  if (isLoading) {
    button.disabled = true;
    if (textEl) textEl.textContent = textEl.dataset.loadingText || "Signing in...";
    if (spinnerEl) spinnerEl.classList.remove("hidden");
  } else {
    button.disabled = false;
    if (textEl) textEl.textContent = textEl.dataset.originalText || "Sign In";
    if (spinnerEl) spinnerEl.classList.add("hidden");
  }
}

// Store original text
if (loginBtnText) {
  loginBtnText.dataset.originalText = loginBtnText.textContent;
  loginBtnText.dataset.loadingText = "Signing in...";
}
if (googleBtnText) {
  googleBtnText.dataset.originalText = googleBtnText.textContent;
  googleBtnText.dataset.loadingText = "Signing in...";
}

function showError(message) {
  if (errorText && errorMessage) {
    errorText.textContent = message;
    errorMessage.classList.remove("hidden");
  }
}

function hideError() {
  if (errorMessage) {
    errorMessage.classList.add("hidden");
  }
}

function getAuthErrorMessage(errorCode) {
  switch (errorCode) {
    case "auth/user-not-found":
      return "No account found with this email address";
    case "auth/wrong-password":
      return "Incorrect password. Please try again";
    case "auth/invalid-email":
      return "Invalid email address format";
    case "auth/user-disabled":
      return "This account has been disabled";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later";
    case "auth/email-already-in-use":
      return "An account with this email already exists";
    case "auth/weak-password":
      return "Password should be at least 6 characters";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before completion";
    case "auth/cancelled-popup-request":
      return "Sign-in request was cancelled";
    case "auth/popup-blocked":
      return "Sign-in popup was blocked by the browser";
    case "auth/invalid-credential":
      return "Invalid login credentials";
    default:
      return "Authentication failed. Please try again (check console for error code)";
  }
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  const bgColors = {
    success: "bg-green-500/90 border-green-400/50",
    error: "bg-red-500/90 border-red-400/50",
    warning: "bg-amber-500/90 border-amber-400/50",
    info: "bg-blue-500/90 border-blue-400/50"
  };
  const icons = {
    success: "check_circle",
    error: "error",
    warning: "warning",
    info: "info"
  };
  
  toast.className = `toast-enter flex items-center gap-3 px-4 py-3 rounded-xl border ${bgColors[type]} text-white shadow-lg backdrop-blur-sm max-w-sm`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-20">${icons[type]}</span>
    <p class="text-sm font-medium flex-1">${message}</p>
    <button class="toast-close flex items-center justify-center w-6 h-6 rounded-full hover:bg-white/20 transition-colors">
      <span class="material-symbols-outlined text-16">close</span>
    </button>
  `;
  
  if (toastContainer) {
    toastContainer.appendChild(toast);
  }
  
  // Trigger enter animation
  setTimeout(() => {
    toast.classList.remove("toast-enter");
    toast.classList.add("toast-enter-active");
  }, 10);
  
  // Auto remove after 4 seconds
  const autoRemoveTimeout = setTimeout(() => {
    removeToast(toast);
  }, 4000);
  
  // Close button
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => {
    clearTimeout(autoRemoveTimeout);
    removeToast(toast);
  });
}

function removeToast(toast) {
  toast.classList.remove("toast-enter-active");
  toast.classList.add("toast-exit-active");
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}


// Theme Management (Synced with dashboard.js)
const THEME_KEY = "resultify_admin_theme";

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

function getTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.setAttribute("data-theme", theme);
  if (themeIcon) {
    themeIcon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
  }
  localStorage.setItem(THEME_KEY, theme);
}

applyTheme(getTheme());

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.classList.contains("dark") ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

// Add ripple effect to buttons
document.querySelectorAll(".ripple").forEach(btn => {
  btn.addEventListener("click", function(e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement("span");
    ripple.className = "ripple-effect";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
});
      

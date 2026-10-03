import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { auth, database } from "./firebase-config.js";
import { getOneSignalOverview } from "./onesignal-api.js";

// Auth State & Real-Time Sync
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  // Set Logged-in Admin Email
  const emailEl = document.getElementById("adminEmailDisplay");
  if (emailEl) {
    emailEl.textContent = user.email || user.displayName || "Admin Authenticated";
  }

  // Fetch Role
  let role = "viewer";
  try {
    const roleSnap = await get(ref(database, `admin_users/${user.uid}/role`));
    role = roleSnap.exists() ? roleSnap.val() : "owner";
  } catch (e) {
    role = "owner";
  }

  const roleBadge = document.getElementById("adminRoleBadge");
  if (roleBadge) {
    roleBadge.textContent = role.toUpperCase();
  }

  // Hide permissions card if not Owner
  if (role !== "owner") {
    const permCard = document.getElementById("cardPermissions");
    if (permCard) permCard.classList.add("hidden");
  }

  // Immediately load live counts & latency
  loadLiveMetrics();
  setInterval(loadLiveMetrics, 25000);
});

// Logout handler
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => { window.location.href = "index.html"; });
  });
}

// Live Metrics Engine
async function loadLiveMetrics() {
  const t0 = performance.now();
  let dbOk = false;
  let dbMs = 0;

  // 1. Firebase RTDB Results & Notification Counters
  try {
    const snap = await get(ref(database, "results"));
    dbMs = Math.round(performance.now() - t0);
    dbOk = true;

    let resCount = 0;
    let notifSent = 0;
    if (snap.exists()) {
      snap.forEach(child => {
        resCount++;
        if (child.val().notificationSent) notifSent++;
      });
    }

    const statRes = document.getElementById("statResults");
    if (statRes) statRes.textContent = resCount;

    const statNotif = document.getElementById("statNotifications");
    if (statNotif) statNotif.textContent = notifSent;
  } catch (e) {
    dbOk = false;
  }

  // 2. OneSignal Overview Latency & Subscriber Counter
  const t1 = performance.now();
  let osOk = false;
  let osMs = 0;
  try {
    const osData = await getOneSignalOverview();
    osMs = Math.round(performance.now() - t1);
    osOk = true;

    const statSub = document.getElementById("statSubscribers");
    if (statSub) {
      statSub.textContent = osData.totalSubscriptions ?? 0;
    }
  } catch (e) {
    osOk = false;
  }

  // 3. System Status & Millisecond Ping Update
  const statSystem = document.getElementById("statSystem");
  const statLatency = document.getElementById("statLatency");

  if (dbOk && osOk) {
    if (statSystem) {
      statSystem.textContent = "Online";
      statSystem.style.color = "var(--accent-mint)";
    }
    if (statLatency) {
      statLatency.textContent = `RTDB: ${dbMs}ms | OneSignal: ${osMs}ms`;
    }
  } else {
    if (statSystem) {
      statSystem.textContent = "Degraded";
      statSystem.style.color = "var(--accent-amber)";
    }
    if (statLatency) {
      statLatency.textContent = `RTDB: ${dbOk ? dbMs + 'ms' : 'ERR'} | OneSignal: ${osOk ? osMs + 'ms' : 'ERR'}`;
    }
  }
}

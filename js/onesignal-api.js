// OneSignal API Client - 100% Zero-Credential Architecture
// All requests are securely routed through Vercel Serverless Function (/api/onesignal)

const VERCEL_BACKEND_URL = "https://resultify-psi.vercel.app";

const isLocal = typeof window !== "undefined" && (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("10.") ||
  window.location.hostname.startsWith("192.168.")
);

async function callOneSignalApi(endpoint, options = {}) {
  const baseUrl = isLocal ? `${VERCEL_BACKEND_URL}/api/onesignal` : "/api/onesignal";
  const targetUrl = `${baseUrl}${endpoint}`;

  const response = await fetch(targetUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error(`Server response error (HTTP ${response.status})`);
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

export async function getOneSignalOverview() {
  try {
    const res = await callOneSignalApi("?action=overview");
    const d = res.data || res;
    return {
      totalSubscriptions: Number(d.totalSubscriptions ?? d.players ?? d.total_subscriptions ?? 0),
      messageableSubscriptions: Number(d.messageableSubscriptions ?? d.messageable_players ?? 0),
      appName: d.appName ?? d.name ?? "Resultify",
      appId: d.appId ?? d.id ?? "Server Synced"
    };
  } catch (error) {
    console.error("[OneSignal Overview Error]:", error.message);
    return {
      totalSubscriptions: 0,
      messageableSubscriptions: 0,
      appName: "Resultify",
      appId: "Server Synced",
      error: error.message
    };
  }
}

export async function getOneSignalSubscribers({ limit = 50, offset = 0 } = {}) {
  try {
    const res = await callOneSignalApi(`?action=subscribers&limit=${limit}&offset=${offset}`);
    return {
      success: true,
      totalCount: Number(res.total_count) || 0,
      players: res.players || []
    };
  } catch (error) {
    console.error("[OneSignal Subscribers Fetch Error]:", error.message);
    return {
      success: false,
      totalCount: 0,
      players: [],
      error: error.message
    };
  }
}

export async function sendPushNotification(notificationData) {
  const { title, body, data = {}, imageUrl, url, segments } = notificationData || {};
  if (!title || !body) return { success: false, errors: ["Title & Message required"] };

  try {
    const res = await callOneSignalApi("?action=send", {
      method: "POST",
      body: JSON.stringify({ title, body, data, imageUrl, url, segments })
    });
    return {
      success: true,
      id: res.messageId || res.id,
      messageId: res.messageId || res.id,
      recipients: res.recipients ?? 0
    };
  } catch (error) {
    console.error("[OneSignal Send Error]:", error.message);
    return { success: false, errors: [error.message] };
  }
}

export async function sendResultPushNotification(result, customTitle, customBody) {
  const title = customTitle || result?.title || "New Result Available";
  const body = customBody || (result?.description?.substring(0, 150) || "Tap to check your result now!");
  const data = {
    resultId: String(result?.id || ""),
    category: result?.category || "",
    openActivity: result?.openActivity || "ResultDetailActivity",
    url: result?.url || ""
  };
  return sendPushNotification({ title, body, data });
}

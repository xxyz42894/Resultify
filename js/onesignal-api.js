// OneSignal API Client Bridge
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
    throw new Error(`Server JSON Parse Error (HTTP ${response.status})`);
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
    return {
      totalSubscriptions: 0,
      messageableSubscriptions: 0,
      appName: "Resultify",
      appId: "Server Synced",
      error: error.message
    };
  }
}

export async function getOneSignalSubscribers() {
  try {
    // Koi unnecessary limit nahi, direct call
    const res = await callOneSignalApi("?action=subscribers");
    return {
      success: true,
      totalCount: Number(res.total_count) || 0,
      players: res.players || []
    };
  } catch (error) {
    return {
      success: false,
      totalCount: 0,
      players: [],
      error: error.message
    };
  }
}

export async function sendPushNotification(notificationData) {
  try {
    const res = await callOneSignalApi("?action=send", {
      method: "POST",
      body: JSON.stringify(notificationData)
    });

    const isSuccess = Boolean(res.success && res.id && String(res.id).trim() !== "");

    return {
      success: isSuccess,
      statusCode: res.statusCode || 200,
      id: res.id || null,
      messageId: res.id || null,
      recipients: res.recipients ?? 0,
      errors: res.errors || (isSuccess ? null : ["OneSignal rejected dispatch."]),
      raw: res
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 500,
      errors: [error.message],
      raw: { error: error.message }
    };
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
  return sendPushNotification({
    target_channel: "push",
    headings: { en: String(title) },
    contents: { en: String(body) },
    data
  });
}

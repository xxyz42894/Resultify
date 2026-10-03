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

  // Strict Inspection: HTTP 200 me bhi agar success false ya id missing ho[span_6](start_span)[span_6](end_span)
  if (!response.ok || data.success === false || !data.id && endpoint.includes("action=send")) {
    const errText = data.error || (data.errors ? (Array.isArray(data.errors) ? data.errors.join(", ") : JSON.stringify(data.errors)) : `HTTP ${response.status}`);
    const customErr = new Error(errText);
    customErr.data = data;
    customErr.statusCode = response.status;
    throw customErr;
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
  const {
    title,
    body,
    data = {},
    imageUrl,
    largeIcon,
    url,
    priority = 10,
    buttons,
    target_device_id,
    subscription_ids
  } = notificationData || {};

  if (!title || !body) {
    return { success: false, errors: ["Title & Body are required"] };
  }

  try {
    const res = await callOneSignalApi("?action=send", {
      method: "POST",
      body: JSON.stringify({
        title,
        body,
        data,
        imageUrl,
        largeIcon,
        url,
        priority,
        buttons,
        target_device_id,
        subscription_ids
      })
    });

    return {
      success: true,
      statusCode: 200,
      id: res.id,
      messageId: res.id,
      recipients: res.recipients ?? 0,
      warnings: res.warnings || null,
      raw: res
    };
  } catch (error) {
    console.error("[OneSignal Send Error]:", error);
    return {
      success: false,
      statusCode: error.statusCode || 500,
      errors: [error.message],
      raw: error.data || null
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
  return sendPushNotification({ title, body, data });
}

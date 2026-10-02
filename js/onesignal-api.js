// OneSignal API Client - Hybrid: Vercel Serverless Function (production) + CORS Proxy (local AndroidIDE)

const ONESIGNAL_CONFIG = {
  appId: "739d1e55-aef0-450a-8d69-1624967cdcce",
  restApiKey: "os_v2_app_ooor4vno6bcqvdljcysjm7g4zzlag6irwnremjmfq34i7guug2gctj6xg7xdasm62y7vhrlultkruvbbeysakgmvm722boqdw6wxiyy"
};

const isLocal = window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1" ||
                window.location.hostname.startsWith("10.") ||
                window.location.hostname.startsWith("192.168.");

async function callOneSignalApi(endpoint, options = {}) {
  let targetUrl = `/api/onesignal${endpoint}`;

  if (isLocal) {
    if (endpoint.includes("action=send")) {
      targetUrl = `https://corsproxy.io/?url=${encodeURIComponent("https://api.onesignal.com/notifications")}`;
      options.headers = {
        ...options.headers,
        "Authorization": `Key ${ONESIGNAL_CONFIG.restApiKey}`,
        "Content-Type": "application/json"
      };
      if (options.body) {
        const parsed = JSON.parse(options.body);
        parsed.app_id = ONESIGNAL_CONFIG.appId;
        options.body = JSON.stringify(parsed);
      }
    } else {
      targetUrl = `https://corsproxy.io/?url=${encodeURIComponent(`https://api.onesignal.com/apps/${ONESIGNAL_CONFIG.appId}`)}`;
      options.headers = {
        ...options.headers,
        "Authorization": `Key ${ONESIGNAL_CONFIG.restApiKey}`,
        "Content-Type": "application/json"
      };
    }
  }

  const response = await fetch(targetUrl, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json();
  if (!response.ok || (data.success === false)) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

export async function getOneSignalOverview() {
  try {
    const res = await callOneSignalApi("?action=overview");
    const d = res.data || res;
    return {
      totalSubscriptions: Number(d.players ?? d.totalSubscriptions ?? d.total_subscriptions ?? 0),
      messageableSubscriptions: Number(d.messageable_players ?? d.messageableSubscriptions ?? 0),
      appName: d.name ?? d.appName ?? "Resultify",
      appId: d.id ?? ONESIGNAL_CONFIG.appId
    };
  } catch (error) {
    console.error("[OneSignal Overview Error]:", error);
    return {
      totalSubscriptions: 0,
      messageableSubscriptions: 0,
      appName: "Resultify",
      appId: ONESIGNAL_CONFIG.appId,
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
    console.error("[OneSignal Send Error]:", error);
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
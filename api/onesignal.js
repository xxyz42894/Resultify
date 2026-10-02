export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || "739d1e55-aef0-450a-8d69-1624967cdcce";
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || "os_v2_app_ooor4vno6bcqvdljcysjm7g4zzlag6irwnremjmfq34i7guug2gctj6xg7xdasm62y7vhrlultkruvbbeysakgmvm722boqdw6wxiyy";
  const ONESIGNAL_BASE_URL = "https://api.onesignal.com";

  const { action } = req.query;

  if (req.method === "GET" && (!action || action === "overview")) {
    try {
      const response = await fetch(`${ONESIGNAL_BASE_URL}/apps/${ONESIGNAL_APP_ID}`, {
        method: "GET",
        headers: {
          "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: data.errors?.[0] || "OneSignal API Error" });
      }
      return res.status(200).json({
        success: true,
        data: {
          totalSubscriptions: data.players ?? data.total_subscriptions ?? 0,
          messageableSubscriptions: data.messageable_players ?? 0,
          appName: data.name ?? "Resultify",
          appId: data.id
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === "POST" && action === "send") {
    try {
      const parsedBody = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { title, body, data = {}, imageUrl, url, segments } = parsedBody;

      if (!title || !body) {
        return res.status(400).json({ success: false, error: "Title and body are required" });
      }

      const payload = {
        app_id: ONESIGNAL_APP_ID,
        included_segments: segments && segments.length ? segments : ["Subscribed Users"],
        headings: { en: title },
        contents: { en: body },
        data: data
      };

      if (imageUrl) payload.big_picture = imageUrl;
      if (url) payload.url = url;

      const response = await fetch(`${ONESIGNAL_BASE_URL}/notifications`, {
        method: "POST",
        headers: {
          "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: resData.errors?.[0] || "Broadcast failed" });
      }

      return res.status(200).json({
        success: true,
        messageId: resData.id,
        recipients: resData.recipients ?? 0
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(404).json({ success: false, error: "Unknown action" });
}

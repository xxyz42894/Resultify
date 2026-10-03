export default async function handler(req, res) {
  // CORS Preflight headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 1. Vercel Environment Variables Read & Clean
  const ONESIGNAL_APP_ID = (process.env.ONESIGNAL_APP_ID || "").trim();
  const ONESIGNAL_REST_API_KEY = (process.env.ONESIGNAL_REST_API_KEY || "").trim();
  const ONESIGNAL_BASE_URL = "https://onesignal.com/api/v1";

  // 2. Strict Key Validation Check
  if (!ONESIGNAL_APP_ID) {
    return res.status(500).json({
      success: false,
      error: "Vercel Config Error: ONESIGNAL_APP_ID is missing in Environment Variables."
    });
  }

  if (!ONESIGNAL_REST_API_KEY) {
    return res.status(500).json({
      success: false,
      error: "Vercel Config Error: ONESIGNAL_REST_API_KEY is missing in Environment Variables."
    });
  }

  const { action, limit = 50, offset = 0 } = req.query;

  // 3. GET Overview: /api/onesignal?action=overview
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
        return res.status(response.status).json({
          success: false,
          error: data.errors?.[0] || data.error || `OneSignal returned HTTP ${response.status}`
        });
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
      return res.status(500).json({ success: false, error: "Server Fetch Exception: " + err.message });
    }
  }

  // 4. GET Full Subscribers List: /api/onesignal?action=subscribers
  if (req.method === "GET" && action === "subscribers") {
    try {
      const response = await fetch(`${ONESIGNAL_BASE_URL}/players?app_id=${ONESIGNAL_APP_ID}&limit=${limit}&offset=${offset}`, {
        method: "GET",
        headers: {
          "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: data.errors?.[0] || "OneSignal Subscribers Fetch Error" });
      }
      return res.status(200).json({
        success: true,
        total_count: data.total_count ?? (data.players ? data.players.length : 0),
        players: data.players ?? []
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 5. POST Broadcast Push: /api/onesignal?action=send
  if (req.method === "POST") {
    try {
      const parsedBody = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const { title, body, data = {}, imageUrl, url, segments } = parsedBody;

      if (!title || !body) {
        return res.status(400).json({ success: false, error: "Validation Error: Title and body are required." });
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
        return res.status(response.status).json({
          success: false,
          error: resData.errors?.[0] || "Broadcast dispatch rejected by OneSignal."
        });
      }

      return res.status(200).json({
        success: true,
        messageId: resData.id,
        recipients: resData.recipients ?? 0
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: "Server Broadcast Exception: " + err.message });
    }
  }

  return res.status(404).json({ success: false, error: "Unknown API route action." });
}
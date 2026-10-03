export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: "Vercel Config Error: ONESIGNAL_APP_ID ya ONESIGNAL_REST_API_KEY missing hai."
    });
  }

  // Exact header format: 'Key ' prefix is ALWAYS required by OneSignal
  const cleanKey = ONESIGNAL_REST_API_KEY.replace(/^Key\s+/i, "");
  const authHeader = `Key ${cleanKey}`;

  const { action, limit = 50, offset = 0 } = req.query;

  // 1. Overview
  if (req.method === "GET" && (!action || action === "overview")) {
    try {
      const response = await fetch(`https://onesignal.com/api/v1/apps/${ONESIGNAL_APP_ID}`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      return res.status(response.status).json({
        success: response.ok,
        statusCode: response.status,
        data: {
          totalSubscriptions: data.players ?? data.total_subscriptions ?? 0,
          messageableSubscriptions: data.messageable_players ?? 0,
          appName: data.name ?? "Resultify",
          appId: data.id
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, statusCode: 500, error: err.message });
    }
  }

  // 2. Subscribers List (Fix: Always passes Key prefix so players list loads 100%)
  if (req.method === "GET" && action === "subscribers") {
    try {
      const response = await fetch(`https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&limit=${limit}&offset=${offset}`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          statusCode: response.status,
          error: data.errors?.[0] || data.error || "Failed to fetch devices",
          raw: data
        });
      }

      return res.status(200).json({
        success: true,
        statusCode: 200,
        total_count: data.total_count ?? (data.players ? data.players.length : 0),
        players: data.players ?? []
      });
    } catch (err) {
      return res.status(500).json({ success: false, statusCode: 500, error: err.message });
    }
  }

  // 3. Send Push
  if (req.method === "POST") {
    try {
      const parsedBody = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      
      const titleText = parsedBody.headings?.en || parsedBody.title || "Notification";
      const bodyText = parsedBody.contents?.en || parsedBody.body || "";
      const rawSubIds = parsedBody.include_subscription_ids || parsedBody.subscription_ids || (parsedBody.target_device_id ? [parsedBody.target_device_id] : []);

      let targets = [];
      if (Array.isArray(rawSubIds) && rawSubIds.length > 0) {
        targets = rawSubIds.map(id => String(id));
      } else {
        // All Users: Fetch live active players from OneSignal
        try {
          const fetchPlayers = await fetch(`https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&limit=300`, {
            method: "GET",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json"
            }
          });
          const pData = await fetchPlayers.json();
          targets = (pData.players || [])
            .filter(p => !p.invalid_identifier)
            .map(p => String(p.id));
        } catch (e) {
          targets = [];
        }
      }

      if (!targets || targets.length === 0) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: "Target Error: Koi valid active Subscription ID nahi mili."
        });
      }

      const oneSignalPayload = {
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        headings: { en: String(titleText) },
        contents: { en: String(bodyText) },
        include_subscription_ids: targets,
        priority: Number(parsedBody.priority) || 10,
        data: parsedBody.data || {}
      };

      if (parsedBody.url) oneSignalPayload.url = String(parsedBody.url);
      if (parsedBody.big_picture || parsedBody.imageUrl) oneSignalPayload.big_picture = String(parsedBody.big_picture || parsedBody.imageUrl);
      if (parsedBody.large_icon || parsedBody.largeIcon) oneSignalPayload.large_icon = String(parsedBody.large_icon || parsedBody.largeIcon);
      if (parsedBody.buttons && Array.isArray(parsedBody.buttons)) oneSignalPayload.buttons = parsedBody.buttons;

      const response = await fetch("https://api.onesignal.com/notifications?c=push", {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(oneSignalPayload)
      });

      const resData = await response.json();
      const hasValidId = Boolean(resData.id && resData.id.trim() !== "");

      return res.status(response.status).json({
        success: response.ok && hasValidId,
        statusCode: response.status,
        id: resData.id || null,
        messageId: resData.id || null,
        recipients: resData.recipients ?? (hasValidId ? targets.length : 0),
        rawOneSignalResponse: resData,
        outgoingPayloadSent: oneSignalPayload
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        error: "Server Exception: " + err.message
      });
    }
  }

  return res.status(404).json({ success: false, statusCode: 404, error: "Action not recognized." });
}

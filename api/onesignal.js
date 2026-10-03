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
      error: "Vercel Config Error: ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY is missing."
    });
  }

  const rawKey = ONESIGNAL_REST_API_KEY.replace(/^Key\s+/i, "");
  const authHeader = `Key ${rawKey}`;

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

  // 2. Subscribers List
  if (req.method === "GET" && action === "subscribers") {
    try {
      const response = await fetch(`https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&limit=3000`, {
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
        total_count: data.total_count ?? (data.players ? data.players.length : 0),
        players: data.players ?? []
      });
    } catch (err) {
      return res.status(500).json({ success: false, statusCode: 500, error: err.message });
    }
  }

  // 3. Send Push with Android Intent Isolation
  if (req.method === "POST") {
    try {
      const parsedBody = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      
      const titleText = parsedBody.headings?.en || parsedBody.title || "Notification";
      const bodyText = parsedBody.contents?.en || parsedBody.body || "";
      const rawSubIds = parsedBody.include_subscription_ids || parsedBody.subscription_ids || (parsedBody.target_device_id ? [parsedBody.target_device_id] : []);

      let targets = [];
      if (Array.isArray(rawSubIds) && rawSubIds.length > 0) {
        targets = rawSubIds.map(id => String(id).trim());
      } else {
        try {
          const fetchPlayers = await fetch(`https://onesignal.com/api/v1/players?app_id=${ONESIGNAL_APP_ID}&limit=3000`, {
            method: "GET",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json"
            }
          });
          const pData = await fetchPlayers.json();
          targets = (pData.players || [])
            .filter(p => !p.invalid_identifier)
            .map(p => String(p.id).trim());
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

      const mode = parsedBody.priority_mode || (Number(parsedBody.priority) === 5 ? "normal" : "urgent");

      // Buttons parsing: Android and Web separation
      const buttonUrlsData = {};
      const androidButtons = [];
      const webButtons = [];

      if (parsedBody.buttons && Array.isArray(parsedBody.buttons)) {
        parsedBody.buttons.forEach((btn, index) => {
          if (btn.text) {
            const btnId = btn.id || `btn_action_${index + 1}`;
            
            // Android Push strictly expects id & text
            androidButtons.push({
              id: btnId,
              text: String(btn.text)
            });

            // Web Push structure
            webButtons.push({
              id: btnId,
              text: String(btn.text),
              url: btn.url || undefined
            });

            // Pass exact key for ResultifyApp click listener
            if (btn.url) {
              buttonUrlsData[`${btnId}_url`] = String(btn.url);
              buttonUrlsData[`btn_action_${index + 1}_url`] = String(btn.url);
            }
          }
        });
      }

      // Root URL handling:
      // Agar action buttons maujood hain, toh root url ko data.body_url me rakhenge taaki Android
      // ka native PendingIntent action button ke click ko override na kare!
      if (parsedBody.url) {
        buttonUrlsData["body_url"] = String(parsedBody.url);
      }

      // Base Payload
      const oneSignalPayload = {
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        headings: { en: String(titleText) },
        contents: { en: String(bodyText) },
        include_subscription_ids: targets,
        data: {
          ...(parsedBody.data || {}),
          ...buttonUrlsData
        }
      };

      // Top level url sirf tab bhejte hain jab buttons na hon
      // (Jab buttons hote hain toh ResultifyApp body tap hone par data.body_url se open karti hai)
      if (parsedBody.url && androidButtons.length === 0) {
        oneSignalPayload.url = String(parsedBody.url);
      }

      // Mode Configurations
      if (mode === "urgent") {
        oneSignalPayload.priority = 10;
        oneSignalPayload.existing_android_channel_id = "Result Alerts";
        oneSignalPayload.android_sound = "default";
        oneSignalPayload.android_visibility = 1;
        oneSignalPayload.android_accent_color = "FF047857";
      } else if (mode === "high") {
        oneSignalPayload.priority = 10;
        oneSignalPayload.android_sound = "default";
        oneSignalPayload.android_visibility = 1;
      } else {
        oneSignalPayload.priority = 5;
        oneSignalPayload.android_sound = null;
        oneSignalPayload.android_visibility = 0;
      }

      // Extras
      if (parsedBody.big_picture || parsedBody.imageUrl) oneSignalPayload.big_picture = String(parsedBody.big_picture || parsedBody.imageUrl);
      if (parsedBody.large_icon || parsedBody.largeIcon) oneSignalPayload.large_icon = String(parsedBody.large_icon || parsedBody.largeIcon);
      
      if (androidButtons.length > 0) {
        oneSignalPayload.buttons = androidButtons;
        oneSignalPayload.web_buttons = webButtons;
      }

      const response = await fetch("https://api.onesignal.com/notifications?c=push", {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(oneSignalPayload)
      });

      const resData = await response.json();
      const hasValidId = Boolean(resData.id && String(resData.id).trim() !== "");

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

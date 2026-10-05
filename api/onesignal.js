export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Exact credentials without any trim or regex replacement
  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return res.status(500).json({
      success: false,
      statusCode: 500,
      error: "Vercel Config Error: ONESIGNAL_APP_ID ya ONESIGNAL_REST_API_KEY missing hai."
    });
  }

  const authHeader = `Key ${ONESIGNAL_REST_API_KEY}`;

  const action = (req.query.action || "").toLowerCase().trim();
  const limit = req.query.limit || 50;
  const offset = req.query.offset || 0;

  // 1. Overview API
  if (req.method === "GET" && (!action || action === "overview")) {
    try {
      const response = await fetch(`https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}`, {
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

  // 2. Notifications History API
  if (req.method === "GET" && (action === "notifications" || action === "messages")) {
    try {
      const targetApiUrl = `https://api.onesignal.com/notifications?app_id=${ONESIGNAL_APP_ID}&limit=${limit}&offset=${offset}`;
      const response = await fetch(targetApiUrl, {
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
        total_count: data.total_count ?? (data.notifications ? data.notifications.length : 0),
        notifications: data.notifications ?? []
      });
    } catch (err) {
      return res.status(500).json({ success: false, statusCode: 500, error: err.message });
    }
  }

  // 3. Subscribers List API
  if (req.method === "GET" && (action === "subscribers" || action === "players")) {
    try {
      const response = await fetch(`https://api.onesignal.com/players?app_id=${ONESIGNAL_APP_ID}&limit=3000`, {
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

  // 4. Exact Official OneSignal v5: DELETE https://api.onesignal.com/apps/{app_id}/subscriptions/{subscription_id}
  if (req.method === "DELETE" || (req.method === "POST" && action === "delete_subscription")) {
    try {
      // Untouched subscription ID without any trim or regex alteration
      let subscriptionId = req.query.subscription_id || req.query.sub_id || req.query.id;
      if (!subscriptionId && req.body) {
        const parsed = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        subscriptionId = parsed.subscriptionId || parsed.sub_id || parsed.id;
      }

      if (!subscriptionId) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: "Subscription ID missing hai."
        });
      }

      // Exact raw endpoint match
      const targetUrl = `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/subscriptions/${subscriptionId}`;

      const response = await fetch(targetUrl, {
        method: "DELETE",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        }
      });

      let resData = {};
      const responseText = await response.text();
      try {
        resData = JSON.parse(responseText);
      } catch (ignored) {
        resData = { rawResponse: responseText };
      }

      if (response.ok) {
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: "Subscription successfully deleted.",
          data: resData
        });
      }

      const errorMsg = resData.errors?.[0] || resData.error || `HTTP ${response.status} Error`;
      return res.status(response.status).json({
        success: false,
        statusCode: response.status,
        error: errorMsg,
        data: resData
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        error: "Server Error: " + err.message
      });
    }
  }

  // 5. Official OneSignal Message Cancel / Delete API (NEW)
  if (req.method === "DELETE" || (req.method === "POST" && (action === "delete_notification" || action === "cancel_notification"))) {
    try {
      let notificationId = req.query.notification_id || req.query.id;
      if (!notificationId && req.body) {
        const parsed = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        notificationId = parsed.notificationId || parsed.id;
      }

      if (!notificationId) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: "Notification ID missing hai."
        });
      }

      const targetUrl = `https://api.onesignal.com/notifications/${notificationId}?app_id=${ONESIGNAL_APP_ID}`;

      const response = await fetch(targetUrl, {
        method: "DELETE",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        }
      });

      let resData = {};
      const responseText = await response.text();
      try {
        resData = JSON.parse(responseText);
      } catch (ignored) {
        resData = { rawResponse: responseText };
      }

      if (response.ok) {
        return res.status(200).json({
          success: true,
          statusCode: 200,
          data: resData
        });
      }

      const errorMsg = resData.errors?.[0] || resData.error || `HTTP ${response.status} Error`;
      return res.status(response.status).json({
        success: false,
        statusCode: response.status,
        error: errorMsg,
        errors: resData.errors || [errorMsg],
        data: resData
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        statusCode: 500,
        error: "Server Error: " + err.message
      });
    }
  }

  // 6. Send Push Notification API
  if (req.method === "POST") {
    try {
      const parsedBody = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      
      const titleText = parsedBody.headings?.en || parsedBody.title || "Notification";
      const bodyText = parsedBody.contents?.en || parsedBody.body || "";
      const rawSubIds = parsedBody.include_subscription_ids || parsedBody.subscription_ids || (parsedBody.target_device_id ? [parsedBody.target_device_id] : []);

      let targets = [];
      if (Array.isArray(rawSubIds) && rawSubIds.length > 0) {
        targets = rawSubIds;
      } else {
        try {
          const fetchPlayers = await fetch(`https://api.onesignal.com/players?app_id=${ONESIGNAL_APP_ID}&limit=3000`, {
            method: "GET",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json"
            }
          });
          const pData = await fetchPlayers.json();
          targets = (pData.players || [])
            .filter(p => !p.invalid_identifier)
            .map(p => p.id);
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
      const targetChannel = parsedBody.existing_android_channel_id || (mode === "urgent" ? "Urgent" : "Result Alerts");

      const buttonUrlsData = {};
      const androidButtons = [];
      const webButtons = [];

      if (parsedBody.buttons && Array.isArray(parsedBody.buttons)) {
        parsedBody.buttons.forEach((btn, index) => {
          if (btn.text) {
            const btnId = btn.id || `btn_action_${index + 1}`;
            
            androidButtons.push({
              id: btnId,
              text: String(btn.text)
            });

            webButtons.push({
              id: btnId,
              text: String(btn.text),
              url: btn.url || undefined
            });

            if (btn.url) {
              buttonUrlsData[`${btnId}_url`] = String(btn.url);
              buttonUrlsData[`btn_action_${index + 1}_url`] = String(btn.url);
            }
          }
        });
      }

      if (parsedBody.url) {
        buttonUrlsData["body_url"] = String(parsedBody.url);
      }

      const oneSignalPayload = {
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        headings: { en: String(titleText) },
        contents: { en: String(bodyText) },
        include_subscription_ids: targets,
        existing_android_channel_id: targetChannel,
        data: {
          ...(parsedBody.data || {}),
          ...buttonUrlsData
        }
      };

      if (parsedBody.url && androidButtons.length === 0) {
        oneSignalPayload.url = String(parsedBody.url);
      }

      if (mode === "urgent") {
        oneSignalPayload.priority = 10;
        oneSignalPayload.android_sound = "default";
        oneSignalPayload.android_visibility = 1;
        oneSignalPayload.android_accent_color = "FF047857";
      } else if (mode === "high") {
        oneSignalPayload.priority = 10;
        oneSignalPayload.android_sound = "default";
        oneSignalPayload.android_visibility = 1;
        oneSignalPayload.android_accent_color = "FFB45309";
      } else {
        oneSignalPayload.priority = 5;
        oneSignalPayload.android_sound = null;
        oneSignalPayload.android_visibility = 0;
      }

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

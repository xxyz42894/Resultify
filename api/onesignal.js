export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
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

  // 4. Message / Notification Delete API
  if (action === "delete_notification" || action === "delete_message" || action === "cancel_notification") {
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
          error: "Notification UUID missing hai."
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
          message: "Notification successfully deleted from OneSignal.",
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

  // 5. Subscription Delete API
  if (action === "delete_subscription") {
    try {
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

  // 6. Send Push Notification API
  if (req.method === "POST") {
    try {
      const parsedBody = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      
      const titleText = parsedBody.headings?.en || parsedBody.title || "Notification";
      const bodyText = parsedBody.contents?.en || parsedBody.body || "";
      const rawSubIds = parsedBody.include_subscription_ids || parsedBody.subscription_ids || (parsedBody.target_device_id ? [parsedBody.target_device_id] : []);
      const includedSegments = parsedBody.included_segments;

      let targets = [];
      if (Array.isArray(rawSubIds) && rawSubIds.length > 0) {
        targets = rawSubIds;
      } else if (!includedSegments || !Array.isArray(includedSegments) || includedSegments.length === 0) {
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

      if ((!targets || targets.length === 0) && (!includedSegments || includedSegments.length === 0)) {
        return res.status(400).json({
          success: false,
          statusCode: 400,
          error: "Target Error: Koi valid active Subscription ID ya Segment nahi mila."
        });
      }

      const mode = parsedBody.priority_mode || (Number(parsedBody.priority) === 5 ? "normal" : "urgent");
      const targetChannel = parsedBody.existing_android_channel_id || (mode === "urgent" ? "Urgent" : "Result Alerts");

      // Build a clean, allow-listed data object. Never let deprecated routing keys
      // (body_url / targetUrl) re-enter the OneSignal payload through data.
      const incomingData = (parsedBody.data && typeof parsedBody.data === "object")
        ? { ...parsedBody.data }
        : {};
      delete incomingData.body_url;
      delete incomingData.targetUrl;
      delete incomingData.bodyUrl;
      delete incomingData.bannerType;

      // Action Buttons & Web Buttons Processing. Native Android buttons intentionally
      // contain only id/text. URLs live in web_buttons and data.btn_action_X_url.
      const androidButtons = [];
      const webButtons = [];

      if (parsedBody.buttons && Array.isArray(parsedBody.buttons)) {
        parsedBody.buttons.forEach((btn, index) => {
          if (btn.text) {
            const btnId = btn.id || `btn_action_${index + 1}`;
            
            // 1. Android button: sirf id aur text
            androidButtons.push({
              id: btnId,
              text: String(btn.text)
            });

            // 2. Web button: id, text, aur direct url jo data ya button me ho
            const candidateUrl = btn.url || incomingData[`${btnId}_url`] || incomingData[`btn_action_${index + 1}_url`];
            const buttonUrl = typeof candidateUrl === "string" && /^https?:\/\//i.test(candidateUrl.trim())
              ? candidateUrl.trim()
              : "";
            const webBtnObj = {
              id: btnId,
              text: String(btn.text)
            };
            if (buttonUrl) {
              webBtnObj.url = buttonUrl;
              incomingData[`${btnId}_url`] = buttonUrl;
              incomingData[`btn_action_${index + 1}_url`] = buttonUrl;
            }
            webButtons.push(webBtnObj);
          }
        });
      }

      // Payload Construction: URLs stay in data/main url and web_buttons; native buttons contain only id/text.
      const oneSignalPayload = {
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        headings: { en: String(titleText) },
        contents: { en: String(bodyText) },
        existing_android_channel_id: targetChannel,
        data: incomingData
      };

      if (Array.isArray(includedSegments) && includedSegments.length > 0) {
        oneSignalPayload.included_segments = includedSegments;
      } else {
        oneSignalPayload.include_subscription_ids = targets;
      }

      if (typeof parsedBody.url === "string" && /^https?:\/\//i.test(parsedBody.url.trim())) {
        oneSignalPayload.url = parsedBody.url.trim();
        // Keep the canonical main URL available to the Android click router.
        oneSignalPayload.data.url = parsedBody.url.trim();
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

      if (parsedBody.big_picture || parsedBody.imageUrl) {
        oneSignalPayload.big_picture = String(parsedBody.big_picture || parsedBody.imageUrl);
      }
      if (parsedBody.large_icon || parsedBody.largeIcon) {
        oneSignalPayload.large_icon = String(parsedBody.large_icon || parsedBody.largeIcon);
      }
      
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
        recipients: resData.recipients ?? (hasValidId ? (targets.length || 1) : 0),
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

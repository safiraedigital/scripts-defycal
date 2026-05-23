module.exports = async function notify(request, response) {
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return response.status(204).end();
  }

  if (request.method !== "POST") {
    return response.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;
  const payload = {
    ...request.body,
    source: "defycal-scripts-panel",
    receivedAt: new Date().toISOString()
  };

  if (!webhookUrl) {
    return response.status(200).json({ ok: true, skipped: true, reason: "NOTIFY_WEBHOOK_URL not configured" });
  }

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!webhookResponse.ok) {
      return response.status(502).json({ ok: false, error: "Webhook request failed" });
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    return response.status(500).json({ ok: false, error: "Notification failed" });
  }
};

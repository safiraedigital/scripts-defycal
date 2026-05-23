const typeLabels = {
  status_change: "Status alterado",
  comment_created: "Comentário criado",
  comment_updated: "Comentário editado",
  status_review_created: "Alteração solicitada",
  status_review_updated: "Alteração editada",
  status_review_deleted: "Alteração excluída",
  status_review_completed: "Alteração concluída",
  status_review_reopened: "Alteração reaberta",
  test: "Teste"
};

function formatDate(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}

function normalizePayload(body) {
  const now = new Date().toISOString();
  const eventType = body.type || "evento";
  const eventDate = body.date || now;
  const tipo = body.typeLabel || typeLabels[eventType] || eventType;

  return {
    tipo,
    data: body.formattedDate || formatDate(eventDate),
    script: body.scriptTitle || (body.scriptNumber ? `Script ${body.scriptNumber}` : ""),
    numeroScript: body.scriptNumber || "",
    tema: body.scriptTheme || "",
    autor: body.author || "",
    comentario: body.text || "",
    statusAnterior: body.from || "",
    statusNovo: body.to || "",
    tipoTecnico: eventType,
    dataIso: eventDate,
    origem: "defycal-scripts-panel",
    recebidoEm: formatDate(now),
    recebidoEmIso: now
  };
}

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
  const payload = normalizePayload(request.body || {});

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

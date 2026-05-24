const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    authorization: `Bearer ${SUPABASE_KEY}`,
    "content-type": "application/json",
    ...extra
  };
}

async function supabaseFetch(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(`Supabase environment variables are not configured: SUPABASE_URL=${SUPABASE_URL ? "set" : "missing"}, SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_KEY ? "set" : "missing"}`);
  }
  const baseUrl = SUPABASE_URL.replace(/\/$/, "");
  const restUrl = baseUrl.endsWith("/rest/v1") ? baseUrl : `${baseUrl}/rest/v1`;

  const response = await fetch(`${restUrl}/${path}`, {
    ...options,
    headers: supabaseHeaders(options.headers)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "Supabase request failed");
  }

  if (response.status === 204) return null;
  return response.json();
}

async function getState(response) {
  const [statuses, comments, reviews] = await Promise.all([
    supabaseFetch("script_status?select=*"),
    supabaseFetch("script_comments?select=*&order=created_at.asc"),
    supabaseFetch("script_reviews?select=*&order=created_at.asc")
  ]);

  return response.status(200).json({ ok: true, statuses, comments, reviews });
}

async function saveStatus(body) {
  return supabaseFetch("script_status?on_conflict=script_number", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      script_number: body.scriptNumber,
      status: body.status,
      updated_at: new Date().toISOString()
    })
  });
}

async function createComment(body) {
  return supabaseFetch("script_comments", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      script_number: body.scriptNumber,
      author: body.author,
      comment: body.text
    })
  });
}

async function updateComment(body) {
  return supabaseFetch(`script_comments?id=eq.${encodeURIComponent(body.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      author: body.author,
      comment: body.text,
      updated_at: new Date().toISOString()
    })
  });
}

async function deleteComment(body) {
  return supabaseFetch(`script_comments?id=eq.${encodeURIComponent(body.id)}`, {
    method: "DELETE"
  });
}

async function createReview(body) {
  return supabaseFetch("script_reviews", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      script_number: body.scriptNumber,
      author: body.author,
      review: body.text,
      completed: false
    })
  });
}

async function updateReview(body) {
  return supabaseFetch(`script_reviews?id=eq.${encodeURIComponent(body.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      author: body.author,
      review: body.text,
      updated_at: new Date().toISOString()
    })
  });
}

async function deleteReview(body) {
  return supabaseFetch(`script_reviews?id=eq.${encodeURIComponent(body.id)}`, {
    method: "DELETE"
  });
}

async function completeReview(body) {
  return supabaseFetch(`script_reviews?id=eq.${encodeURIComponent(body.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      completed: Boolean(body.completed),
      updated_at: new Date().toISOString()
    })
  });
}

module.exports = async function state(request, response) {
  try {
    if (request.method === "GET") return await getState(response);

    if (request.method !== "POST") {
      return response.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const body = request.body || {};
    const actions = {
      status_save: saveStatus,
      comment_create: createComment,
      comment_update: updateComment,
      comment_delete: deleteComment,
      review_create: createReview,
      review_update: updateReview,
      review_delete: deleteReview,
      review_complete: completeReview
    };

    const action = actions[body.action];
    if (!action) return response.status(400).json({ ok: false, error: "Unknown action" });

    const data = await action(body);
    return response.status(200).json({ ok: true, data });
  } catch (error) {
    return response.status(500).json({ ok: false, error: error.message || "State request failed" });
  }
};

import { getStore } from "@netlify/blobs";

const STORE_NAME = "english-review";
const STATE_KEY = "review-state";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-review-key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS"
  };
}

function getSyncKey() {
  return globalThis.Netlify?.env?.get("REVIEW_SYNC_KEY") || "";
}

function isAuthorized(req) {
  const syncKey = getSyncKey();
  if (!syncKey) return true;
  return req.headers.get("x-review-key") === syncKey;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    const saved = await store.get(STATE_KEY, { type: "json" });
    return jsonResponse({
      reviewState: saved?.reviewState || {},
      updated_at: saved?.updated_at || null
    });
  }

  if (req.method === "POST" || req.method === "PUT") {
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    if (!isPlainObject(body.reviewState)) {
      return jsonResponse({ error: "reviewState must be an object" }, 400);
    }

    const payload = {
      reviewState: body.reviewState,
      updated_at: new Date().toISOString()
    };

    await store.setJSON(STATE_KEY, payload);
    return jsonResponse(payload);
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/review-state",
  method: ["GET", "POST", "PUT", "OPTIONS"]
};

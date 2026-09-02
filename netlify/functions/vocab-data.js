import { getStore } from "@netlify/blobs";

const STORE_NAME = "english-review";
const VOCAB_KEY = "vocab-data-v1";
const MAX_ITEMS = 10000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-review-key",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders()
    }
  });
}

function getSyncKey() {
  return globalThis.Netlify?.env?.get("REVIEW_SYNC_KEY") || "";
}

function isAuthorized(req) {
  const syncKey = getSyncKey();
  return !syncKey || req.headers.get("x-review-key") === syncKey;
}

function isValidVocab(items) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return false;

  const ids = new Set();
  return items.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    if (typeof item.id !== "string" || !item.id.trim() || ids.has(item.id)) return false;
    if (typeof item.expression !== "string" || !item.expression.trim()) return false;
    if (typeof item.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
    ids.add(item.id);
    return true;
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    const saved = await store.get(VOCAB_KEY, { type: "json" });
    return jsonResponse({
      vocab: Array.isArray(saved?.vocab) ? saved.vocab : null,
      deletedIds: Array.isArray(saved?.deletedIds) ? saved.deletedIds : [],
      updated_at: saved?.updated_at || null
    });
  }

  if (req.method === "PUT") {
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    if (!isValidVocab(body.vocab) || !Array.isArray(body.deletedIds) || !body.deletedIds.every((id) => typeof id === "string")) {
      return jsonResponse({ error: "Invalid vocab data" }, 400);
    }

    const payload = {
      vocab: body.vocab,
      deletedIds: [...new Set(body.deletedIds)].slice(0, MAX_ITEMS),
      updated_at: new Date().toISOString()
    };
    await store.setJSON(VOCAB_KEY, payload);
    return jsonResponse({ updated_at: payload.updated_at, count: payload.vocab.length });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/vocab-data",
  method: ["GET", "PUT", "OPTIONS"]
};

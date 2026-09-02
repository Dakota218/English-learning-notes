import { getStore } from "@netlify/blobs";

const STORE_NAME = "english-review-images";
const IMAGE_PREFIX = "card-image:";
const MAX_DATA_URL_LENGTH = 5_500_000;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-review-key",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS"
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

function getCardId(req) {
  const url = new URL(req.url);
  const id = decodeURIComponent(url.pathname.split("/").pop() || "").trim();
  return id && id.length <= 240 ? id : "";
}

function parseImage(dataUrl) {
  if (typeof dataUrl !== "string" || dataUrl.length > MAX_DATA_URL_LENGTH) return null;
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const cardId = getCardId(req);
  if (!cardId) return jsonResponse({ error: "Missing card id" }, 400);

  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const key = `${IMAGE_PREFIX}${cardId}`;

  if (req.method === "GET") {
    const saved = await store.get(key, { type: "json" });
    const image = parseImage(saved?.dataUrl);
    if (!image) return jsonResponse({ error: "Image not found" }, 404);

    const binary = atob(image.base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "public, max-age=300",
        ...corsHeaders()
      }
    });
  }

  if (!isAuthorized(req)) return jsonResponse({ error: "Unauthorized" }, 401);

  if (req.method === "PUT") {
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    if (!parseImage(body.dataUrl)) {
      return jsonResponse({ error: "Invalid or oversized image" }, 400);
    }

    await store.setJSON(key, { dataUrl: body.dataUrl, updated_at: new Date().toISOString() });
    return jsonResponse({ saved: true });
  }

  if (req.method === "DELETE") {
    await store.delete(key);
    return jsonResponse({ deleted: true });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
};

export const config = {
  path: "/api/vocab-image/:id",
  method: ["GET", "PUT", "DELETE", "OPTIONS"]
};

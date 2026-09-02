const CAMBRIDGE_BASE = "https://dictionary.cambridge.org/dictionary/english-chinese-traditional";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-review-key",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      ...corsHeaders()
    }
  });
}

function slugify(expression) {
  return expression
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractElement(html, className, tagName, startAt = 0) {
  const classIndex = html.indexOf(className, startAt);
  if (classIndex < 0) return null;
  const openStart = html.lastIndexOf(`<${tagName}`, classIndex);
  if (openStart < 0) return null;
  const openEnd = html.indexOf(">", classIndex);
  if (openEnd < 0) return null;

  const tokenPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  tokenPattern.lastIndex = openStart;
  let depth = 0;
  let token;
  while ((token = tokenPattern.exec(html))) {
    depth += token[0][1] === "/" ? -1 : 1;
    if (depth === 0) {
      return {
        content: html.slice(openEnd + 1, token.index),
        end: tokenPattern.lastIndex
      };
    }
  }
  return null;
}

function extractElements(html, className, tagName, startAt = 0, limit = 8) {
  const results = [];
  let cursor = startAt;
  while (results.length < limit) {
    const result = extractElement(html, className, tagName, cursor);
    if (!result) break;
    results.push(result);
    cursor = result.end;
  }
  return results;
}

function decodeHtml(value) {
  const entities = {
    amp: "&",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
    nbsp: " "
  };

  return String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
      if (entity[0] === "#") {
        const hex = entity[1]?.toLowerCase() === "x";
        const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(number) ? String.fromCodePoint(number) : match;
      }
      return entities[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?，。；：！？、）])/g, "$1")
    .replace(/([，。；：！？、])\s+/g, "$1")
    .replace(/\s+（/g, "（")
    .replace(/（\s+/g, "（")
    .trim();
}

function normalizeType(value, expression) {
  const type = value.toLowerCase();
  if (type.includes("phrasal verb")) return "phrasal verb";
  if (type.includes("adjective")) return "adjective";
  if (type.includes("adverb")) return "adverb";
  if (type.includes("noun")) return "noun";
  if (type.includes("verb")) return "verb";
  if (expression.trim().includes(" ")) return "phrase";
  return type || "expression";
}

function tagsFor(type, expression) {
  const tags = ["daily"];
  if (type === "phrasal verb" || expression.includes(" ")) tags.push("useful-expression");
  if (type === "phrasal verb") tags.push("conversation");
  return tags;
}

function parseCambridgePage(html, expression, sourceUrl) {
  const definition = extractElement(html, 'class="def ddef_d db', "div");
  if (!definition) return null;

  const translation = extractElement(html, 'class="trans dtrans dtrans-se', "span", definition.end);
  const examples = extractElements(html, 'class="eg deg', "span", definition.end)
    .map((entry) => decodeHtml(entry.content))
    .filter(Boolean);
  const example = examples.find((value) => /[.!?]$/.test(value) && value.split(/\s+/).length >= 4)
    || examples[0]
    || "";
  const partOfSpeech = extractElement(html, 'class="pos dpos', "span");
  const headword = extractElement(html, 'class="hw dhw', "span")
    || extractElement(html, 'class="headword tw-bw dhw', "h2");

  const meaningZh = decodeHtml(translation?.content);
  if (!meaningZh) return null;

  const type = normalizeType(decodeHtml(partOfSpeech?.content), expression);
  return {
    expression: decodeHtml(headword?.content) || expression,
    type,
    meaning_zh: meaningZh,
    example,
    note_zh: `Cambridge 定義：${decodeHtml(definition.content)}`,
    tags: tagsFor(type, expression),
    source: {
      name: "Cambridge Dictionary",
      url: sourceUrl
    }
  };
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const expression = new URL(req.url).searchParams.get("q")?.replace(/\s+/g, " ").trim() || "";
  if (!expression || expression.length > 120) return jsonResponse({ error: "Invalid expression" }, 400);

  const slug = slugify(expression);
  if (!slug) return jsonResponse({ error: "Invalid expression" }, 400);
  const sourceUrl = `${CAMBRIDGE_BASE}/${encodeURIComponent(slug)}`;

  try {
    const response = await fetch(sourceUrl, {
      redirect: "follow",
      headers: {
        "Accept-Language": "zh-TW,zh-Hant;q=0.9,en;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; EnglishReview/1.0)"
      }
    });
    if (!response.ok) return jsonResponse({ error: "Cambridge entry not found" }, 404);

    const result = parseCambridgePage(await response.text(), expression, response.url || sourceUrl);
    if (!result) return jsonResponse({ error: "Cambridge entry not found" }, 404);
    return jsonResponse({ result });
  } catch {
    return jsonResponse({ error: "Cambridge lookup unavailable" }, 502);
  }
};

export const config = {
  path: "/api/cambridge-lookup",
  method: ["GET", "OPTIONS"]
};

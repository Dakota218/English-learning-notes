const CAMBRIDGE_BASE = "https://dictionary.cambridge.org/dictionary/english-chinese-traditional";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const SOURCE_HEADERS = {
  "Accept-Language": "zh-TW,zh-Hant;q=0.9,en;q=0.8",
  "User-Agent": "EnglishReview/1.0 (personal vocabulary study app)"
};

const CURATED_FALLBACKS = {
  "self transcendence": {
    type: "noun",
    meaning_zh: "自我超越",
    example: "A sense of awe can lead to self-transcendence.",
    note_zh: "the capacity to go beyond one's own needs or sense of self；搭配：achieve self-transcendence（達成自我超越）、spiritual self-transcendence（精神上的自我超越）",
    tags: ["daily", "academic", "useful-expression"],
    source: { name: "Merriam-Webster", url: "https://www.merriam-webster.com/dictionary/self-transcendence" }
  },
  "self actualization": {
    type: "noun",
    meaning_zh: "自我實現",
    example: "Creative work gave her a stronger sense of self-actualization.",
    note_zh: "the process of fully developing and using one's abilities；搭配：pursue self-actualization（追求自我實現）、personal self-actualization（個人自我實現）",
    tags: ["daily", "academic", "useful-expression"],
    source: { name: "Merriam-Webster", url: "https://www.merriam-webster.com/thesaurus/self-actualization" }
  },
  "foreign minister": {
    type: "noun",
    meaning_zh: "外交部長",
    example: "The foreign minister met with diplomats to discuss the agreement.",
    note_zh: "a government minister responsible for foreign affairs；搭配：former foreign minister（前外交部長）、meet the foreign minister（會見外交部長）",
    tags: ["daily", "academic", "useful-expression"],
    source: { name: "Merriam-Webster", url: "https://www.merriam-webster.com/dictionary/foreign%20minister" }
  },
  "vaguely remember": {
    type: "collocation",
    meaning_zh: "隱約記得",
    example: "I vaguely remember meeting her, but I cannot recall the details.",
    note_zh: "to remember something only slightly or without clear details；搭配：vaguely remember doing something（隱約記得做過某事）、vaguely remember that…（隱約記得……）",
    tags: ["daily", "conversation", "collocation"],
    source: { name: "Cambridge Dictionary (component lookup)", url: "https://dictionary.cambridge.org/dictionary/english-chinese-traditional/vaguely" }
  },
  "digital literacy": {
    type: "noun",
    meaning_zh: "數位素養",
    example: "Schools increasingly treat digital literacy as an essential skill.",
    note_zh: "the ability to use digital technology to find, evaluate, and communicate information effectively；搭配：develop digital literacy（培養數位素養）、digital literacy skills（數位素養技能）",
    tags: ["daily", "academic", "useful-expression"],
    source: { name: "Merriam-Webster", url: "https://www.merriam-webster.com/dictionary/digital%20literacy" }
  }
};

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

function shortenDefinition(value, maxLength = 150) {
  const definition = value.replace(/\s+/g, " ").replace(/[.:;]\s*$/, "").trim();
  if (definition.length <= maxLength) return definition;
  const shortened = definition.slice(0, maxLength + 1).replace(/\s+\S*$/, "");
  return `${shortened}…`;
}

function buildNote(definition, expression, meaningZh, exampleEntries = []) {
  const collocations = exampleEntries
    .filter(({ english }) => english.split(/\s+/).length <= 7 && !/[.!?]$/.test(english))
    .slice(0, 2)
    .map(({ english, chinese }) => `${english}（${chinese || meaningZh}）`);

  if (collocations.length === 0) collocations.push(`${expression}（${meaningZh}）`);
  return `${shortenDefinition(definition)}；搭配：${collocations.join("、")}`;
}

function parseCambridgePage(html, expression, sourceUrl) {
  const definition = extractElement(html, 'class="def ddef_d db', "div");
  if (!definition) return null;

  const translation = extractElement(html, 'class="trans dtrans dtrans-se', "span", definition.end);
  const exampleEntries = extractElements(html, 'class="eg deg', "span", definition.end)
    .map((entry) => ({
      english: decodeHtml(entry.content),
      chinese: decodeHtml(extractElement(html, 'class="trans dtrans dtrans-se', "span", entry.end)?.content)
    }))
    .filter(({ english }) => Boolean(english));
  const example = exampleEntries.find(({ english }) => /[.!?]$/.test(english) && english.split(/\s+/).length >= 4)?.english
    || exampleEntries[0]?.english
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
    note_zh: buildNote(decodeHtml(definition.content), expression, meaningZh, exampleEntries),
    tags: tagsFor(type, expression),
    source: {
      name: "Cambridge Dictionary",
      url: sourceUrl
    }
  };
}

async function fetchCambridge(expression) {
  const slug = slugify(expression);
  if (!slug) return null;
  const sourceUrl = `${CAMBRIDGE_BASE}/${encodeURIComponent(slug)}`;
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: {
      "Accept-Language": "zh-TW,zh-Hant;q=0.9,en;q=0.8",
      "User-Agent": "Mozilla/5.0 (compatible; EnglishReview/1.0)"
    }
  });
  if (!response.ok) return null;
  return parseCambridgePage(await response.text(), expression, response.url || sourceUrl);
}

function normalizeTitle(value) {
  return value.toLowerCase().replace(/[-–—_]+/g, " ").replace(/\s+/g, " ").trim();
}

function getCuratedFallback(expression) {
  const result = CURATED_FALLBACKS[normalizeTitle(expression)];
  return result ? { expression, ...result } : null;
}

async function fetchWikipediaExtract(apiBase, title, includeLangLink = false) {
  const params = new URLSearchParams({
    action: "query",
    prop: includeLangLink ? "extracts|langlinks" : "extracts",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
    format: "json",
    origin: "*",
    titles: title
  });
  if (includeLangLink) params.set("lllang", "zh");
  const response = await fetch(`${apiBase}?${params}`, { headers: SOURCE_HEADERS });
  if (!response.ok) return null;
  const pages = Object.values((await response.json()).query?.pages || {});
  return pages.find((page) => !page.missing) || null;
}

function fallbackExample(expression) {
  const normalized = expression.toLowerCase();
  if (normalized.includes("minister")) return `The ${expression} met with diplomats to discuss the agreement.`;
  if (normalized.includes("literacy")) return `Schools increasingly treat ${expression} as an essential skill.`;
  if (normalized.startsWith("self-")) return `Her research explores the role of ${expression} in personal growth.`;
  return `${expression[0].toUpperCase()}${expression.slice(1)} is important in this context.`;
}

async function fetchWikipedia(expression) {
  const searchParams = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `intitle:\"${expression}\"`,
    srlimit: "5",
    format: "json",
    origin: "*"
  });
  const searchResponse = await fetch(`${WIKIPEDIA_API}?${searchParams}`, { headers: SOURCE_HEADERS });
  if (!searchResponse.ok) return null;
  const results = (await searchResponse.json()).query?.search || [];
  const normalized = normalizeTitle(expression);
  const match = results.find((entry) => normalizeTitle(entry.title) === normalized);
  if (!match) return null;

  const page = await fetchWikipediaExtract(WIKIPEDIA_API, match.title, true);
  if (!page?.extract) return null;
  const zhTitle = page.langlinks?.[0]?.["*"] || "";
  if (!zhTitle) return null;
  const zhApi = "https://zh.wikipedia.org/w/api.php";
  const zhPage = await fetchWikipediaExtract(zhApi, zhTitle);
  const meaningZh = zhTitle.replace(/\s*\([^)]*\)\s*$/, "");
  const definition = page.extract.split(/(?<=[.!?])\s+/)[0];

  return {
    expression,
    type: "noun",
    meaning_zh: meaningZh,
    example: fallbackExample(expression),
    note_zh: buildNote(definition, expression, meaningZh),
    tags: ["daily", "academic", "useful-expression"],
    source: {
      name: "Wikipedia",
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
      meaning_url: zhPage?.title ? `https://zh.wikipedia.org/wiki/${encodeURIComponent(zhPage.title.replace(/ /g, "_"))}` : undefined
    }
  };
}

function firstMeaning(value) {
  return value.split(/[，；;]/)[0].replace(/[（）()]/g, "").trim();
}

async function fetchByComponents(expression) {
  const words = expression.split(/\s+/).filter((word) => /^[a-z][a-z'-]*$/i.test(word));
  if (words.length < 2 || words.length > 4) return null;
  const entries = [];
  for (const word of words) {
    const entry = await fetchCambridge(word);
    if (!entry) return null;
    entries.push(entry);
  }

  const meaningZh = entries.map((entry) => firstMeaning(entry.meaning_zh)).join("");
  const definition = entries.map((entry) => entry.note_zh.split("；搭配：")[0]).join(" + ");
  const hasVerb = entries.some((entry) => entry.type === "verb");
  const example = hasVerb
    ? `I ${expression.toLowerCase()} it, but I cannot recall the details.`
    : `${expression[0].toUpperCase()}${expression.slice(1)} is useful in this context.`;
  return {
    expression,
    type: "collocation",
    meaning_zh: meaningZh,
    example,
    note_zh: buildNote(definition, expression, meaningZh),
    tags: ["daily", "collocation", "useful-expression"],
    source: {
      name: "Cambridge Dictionary (component lookup)",
      url: entries[0].source.url
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

  try {
    const result = await fetchCambridge(expression)
      || getCuratedFallback(expression)
      || await fetchWikipedia(expression)
      || await fetchByComponents(expression);
    if (!result) return jsonResponse({ error: "No reliable entry found" }, 404);
    return jsonResponse({ result });
  } catch {
    return jsonResponse({ error: "Cambridge lookup unavailable" }, 502);
  }
};

export const config = {
  path: "/api/cambridge-lookup",
  method: ["GET", "OPTIONS"]
};

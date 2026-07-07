const DATA_URL = "data/vocab.json";
const REVIEW_API_URL = getReviewApiUrl();
const STORAGE_KEY = "english-review-state-v1";
const SYNC_KEY_STORAGE_KEY = "english-review-sync-key";
const DAY_MS = 24 * 60 * 60 * 1000;
const REVIEW_INTERVALS = {
  1: 3,
  2: 7,
  3: 14,
  4: 30,
  5: 60
};

let vocab = [];
let reviewState = loadReviewState();
let reviewedThisSession = new Set();
let reviewMode = localStorage.getItem("english-review-mode") || "card";

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  totalCount: document.querySelector("#totalCount"),
  todayCount: document.querySelector("#todayCount"),
  dueCount: document.querySelector("#dueCount"),
  hardCount: document.querySelector("#hardCount"),
  masteredCount: document.querySelector("#masteredCount"),
  totalBar: document.querySelector("#totalBar"),
  todayBar: document.querySelector("#todayBar"),
  dueBar: document.querySelector("#dueBar"),
  hardBar: document.querySelector("#hardBar"),
  masteredBar: document.querySelector("#masteredBar"),
  calendarMonth: document.querySelector("#calendarMonth"),
  addedDaysCount: document.querySelector("#addedDaysCount"),
  reviewDaysCount: document.querySelector("#reviewDaysCount"),
  activeDaysCount: document.querySelector("#activeDaysCount"),
  calendarGrid: document.querySelector("#calendarGrid"),
  duePill: document.querySelector("#duePill"),
  newPill: document.querySelector("#newPill"),
  hardPill: document.querySelector("#hardPill"),
  libraryPill: document.querySelector("#libraryPill"),
  dueList: document.querySelector("#dueList"),
  todayList: document.querySelector("#todayList"),
  hardList: document.querySelector("#hardList"),
  libraryList: document.querySelector("#libraryList"),
  searchInput: document.querySelector("#searchInput"),
  filterSelect: document.querySelector("#filterSelect"),
  syncStatus: document.querySelector("#syncStatus"),
  tagStats: document.querySelector("#tagStats"),
  forgetList: document.querySelector("#forgetList"),
  template: document.querySelector("#wordCardTemplate"),
  libraryTemplate: document.querySelector("#libraryItemTemplate")
};

document.addEventListener("DOMContentLoaded", init);
els.searchInput.addEventListener("input", render);
els.filterSelect.addEventListener("change", render);

async function init() {
  els.todayLabel.textContent = todayISO();
  setSyncStatus("本機儲存", "offline");

  const modeCardBtn = document.querySelector("#modeCardBtn");
  const modeClozeBtn = document.querySelector("#modeClozeBtn");

  if (modeCardBtn && modeClozeBtn) {
    if (reviewMode === "cloze") {
      modeClozeBtn.classList.add("active");
      modeCardBtn.classList.remove("active");
    } else {
      modeCardBtn.classList.add("active");
      modeClozeBtn.classList.remove("active");
    }

    modeCardBtn.addEventListener("click", () => {
      reviewMode = "card";
      localStorage.setItem("english-review-mode", "card");
      modeCardBtn.classList.add("active");
      modeClozeBtn.classList.remove("active");
      render();
    });

    modeClozeBtn.addEventListener("click", () => {
      reviewMode = "cloze";
      localStorage.setItem("english-review-mode", "cloze");
      modeClozeBtn.classList.add("active");
      modeCardBtn.classList.remove("active");
      render();
    });
  }

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const loadedVocab = await response.json();
    if (!Array.isArray(loadedVocab)) throw new Error("vocab.json must be an array");
    vocab = shuffleItems(loadedVocab);
    await syncInitialReviewState();
    render();
  } catch (error) {
    renderError(error);
  }
}

function render() {
  const items = vocab.map(mergeReview);
  const today = todayISO();
  const due = items.filter((item) => isDue(item, today) && !reviewedThisSession.has(item.id));
  const todayItems = items.filter((item) => item.date === today);
  const hard = items.filter((item) => item.review?.difficulty === "hard");
  const mastered = items.filter((item) => item.review?.difficulty === "mastered");
  const libraryItems = applyLibraryFilters(items, today);

  els.totalCount.textContent = items.length;
  els.todayCount.textContent = todayItems.length;
  els.dueCount.textContent = due.length;
  els.hardCount.textContent = hard.length;
  els.masteredCount.textContent = mastered.length;

  els.duePill.textContent = `${due.length} 筆`;
  els.newPill.textContent = `${todayItems.length} 筆`;
  els.hardPill.textContent = `${hard.length} 筆`;
  els.libraryPill.textContent = `${libraryItems.length} 筆`;
  updateStatsChart({
    total: items.length,
    today: todayItems.length,
    due: due.length,
    hard: hard.length,
    mastered: mastered.length
  });

  renderDueDeck(due);
  renderCards(els.todayList, todayItems, "今天尚未新增詞彙。");
  renderCards(els.hardList, hard, "目前沒有標記為容易忘記的詞彙。");
  renderLibrary(els.libraryList, libraryItems, "找不到符合條件的詞彙。");
  renderTagStats(items);
  renderForgetList(items);
  renderCalendar(items, today);
}

function updateStatsChart(values) {
  const maxValue = Math.max(...Object.values(values), 1);

  setBar(els.totalBar, values.total, maxValue);
  setBar(els.todayBar, values.today, maxValue);
  setBar(els.dueBar, values.due, maxValue);
  setBar(els.hardBar, values.hard, maxValue);
  setBar(els.masteredBar, values.mastered, maxValue);
}

function setBar(element, value, maxValue) {
  element.style.width = `${Math.max((value / maxValue) * 100, value > 0 ? 4 : 0)}%`;
}

function renderDueDeck(items) {
  els.dueList.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "今天沒有需要複習的詞彙。";
    els.dueList.append(empty);
    return;
  }

  if (reviewMode === "cloze") {
    els.dueList.append(createClozeReviewCard(items[0], 1, items.length));
  } else {
    els.dueList.append(createReviewCard(items[0], 1, items.length));
  }
}

function renderCards(container, items, emptyText) {
  container.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  for (const item of items) {
    container.append(createCard(item, { includeActions: false }));
  }
}

function renderLibrary(container, items, emptyText) {
  container.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  for (const item of items) {
    container.append(createLibraryItem(item));
  }
}

function createCard(item, options = {}) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const review = item.review || {};

  node.querySelector(".word-type").textContent = item.type || "expression";
  node.querySelector(".difficulty").textContent = difficultyLabel(review.difficulty);
  node.querySelector(".difficulty").classList.add(review.difficulty || "new");
  node.querySelector(".expression").textContent = item.expression || "";
  node.querySelector(".meaning").textContent = item.meaning_zh || "";
  appendHighlightedExample(node.querySelector(".example"), item.example || "", item.expression || "");
  node.querySelector(".note").textContent = item.note_zh || "";
  node.querySelector(".stage").textContent = review.stage ?? 0;
  node.querySelector(".next-review").textContent = review.next_review || "未排程";

  const tags = node.querySelector(".tags");
  for (const tag of item.tags || []) {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    tags.append(chip);
  }

  const actions = node.querySelector(".review-actions");
  if (options.includeActions) {
    for (const button of node.querySelectorAll("[data-review-result]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        updateReview(item, button.dataset.reviewResult);
        render();
      });
    }
  } else {
    actions.remove();
  }

  return node;
}

function createReviewCard(item, position, total) {
  const review = item.review || {};
  const card = document.createElement("article");
  card.className = "review-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", "翻開複習卡片");

  const front = document.createElement("div");
  front.className = "review-face review-front";

  const progress = document.createElement("p");
  progress.className = "review-progress";
  progress.textContent = `${position} / ${total}`;

  const expression = document.createElement("h3");
  expression.textContent = item.expression || "";

  front.append(progress, expression);

  const back = document.createElement("div");
  back.className = "review-face review-back";

  const meaning = document.createElement("p");
  meaning.className = "review-meaning";
  meaning.textContent = item.meaning_zh || "";

  const example = document.createElement("blockquote");
  example.className = "example";
  appendHighlightedExample(example, item.example || "", item.expression || "");

  const note = document.createElement("p");
  note.className = "note";
  note.textContent = item.note_zh || "";

  const meta = document.createElement("p");
  meta.className = "review-card-meta";
  meta.textContent = `階段 ${review.stage ?? 0} · 下次複習 ${review.next_review || "未排程"}`;

  const actions = document.createElement("div");
  actions.className = "review-actions";
  actions.append(
    createReviewButton("忘記了", "forgot", item),
    createReviewButton("有點模糊", "blurry", item),
    createReviewButton("記得", "remembered", item)
  );

  back.append(meaning, example, note, meta, actions);
  card.append(front, back);

  card.addEventListener("click", () => flipReviewCard(card));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      flipReviewCard(card);
    }
  });

  return card;
}

function createReviewButton(label, result, item) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.reviewResult = result;
  button.className = `review-${result}`;
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    updateReview(item, result);
    reviewedThisSession.add(item.id);
    render();
  });
  return button;
}

function flipReviewCard(card) {
  if (card.classList.contains("is-flipped")) return;

  card.classList.add("is-flipped");
  card.setAttribute("aria-label", "複習卡片背面");
}

function createLibraryItem(item) {
  const node = els.libraryTemplate.content.firstElementChild.cloneNode(true);
  const review = item.review || {};

  // 1. 填入 Summary 資訊
  node.querySelector(".library-expression").textContent = item.expression || "";
  node.querySelector(".library-meaning").textContent = item.meaning_zh || "";
  node.querySelector(".library-difficulty").textContent = difficultyLabel(review.difficulty);
  node.querySelector(".library-difficulty").classList.add(review.difficulty || "new");
  node.querySelector(".library-next-review").textContent = review.next_review ? `下次 ${review.next_review}` : "未排程";

  // 2. 填入 Detail 資訊
  const detail = node.querySelector(".library-detail");
  const exampleContainer = node.querySelector(".library-example");
  const noteContainer = node.querySelector(".library-note");
  const tagsContainer = node.querySelector(".library-tags");

  // 處理例句（使用高亮）
  if (item.example) {
    appendHighlightedExample(exampleContainer, item.example, item.expression);
  } else {
    exampleContainer.remove();
  }

  // 處理補充
  if (item.note_zh) {
    noteContainer.textContent = item.note_zh;
  } else {
    noteContainer.remove();
  }

  // 處理標籤
  if (item.tags && item.tags.length > 0) {
    tagsContainer.replaceChildren();
    for (const tag of item.tags) {
      const chip = document.createElement("span");
      chip.className = "tag";
      chip.textContent = tag;
      tagsContainer.append(chip);
    }
  } else {
    tagsContainer.remove();
  }

  // 3. 點選事件控制展開與折疊
  node.addEventListener("click", () => {
    // 隱藏其他所有已展開的項目 (手風琴效果)
    const allDetails = els.libraryList.querySelectorAll(".library-detail");
    allDetails.forEach((d) => {
      if (d !== detail) {
        d.classList.add("is-hidden");
      }
    });

    detail.classList.toggle("is-hidden");
  });

  // 阻止細節區塊內部的點擊事件冒泡，避免選取或點選細節文字時導致折疊
  detail.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  return node;
}

function appendHighlightedExample(container, example, expression) {
  container.replaceChildren();

  if (!example || !expression) {
    container.textContent = example;
    return;
  }

  const exactPattern = new RegExp(escapeRegExp(expression), "i");
  const flexiblePattern = buildFlexibleExpressionPattern(expression);
  const match = example.match(exactPattern) || example.match(flexiblePattern);

  if (!match || match.index === undefined) {
    container.textContent = example;
    return;
  }

  const before = example.slice(0, match.index);
  const highlighted = example.slice(match.index, match.index + match[0].length);
  const after = example.slice(match.index + match[0].length);
  const mark = document.createElement("strong");

  mark.className = "highlight-term";
  mark.textContent = highlighted;

  container.append(before, mark, after);
}

function buildFlexibleExpressionPattern(expression) {
  let pattern = expression.trim();
  
  // 1. 轉義正則特殊字元（保留空格用於後續切分）
  pattern = escapeRegExp(pattern);
  
  // 2. 將 "someone" 和 "something" 替換成對應的名詞短語正則
  pattern = pattern.replace(/\bsomeone\b/ig, "(?:[a-zA-Z0-9'\\s]{1,30})");
  pattern = pattern.replace(/\bsomething\b/ig, "(?:[a-zA-Z0-9'\\s]{1,30})");
  
  // 3. 切分單字以處理時態和形容詞插入
  const words = pattern.split(/\s+/);
  if (words.length === 0) return /$^/;
  
  const processedWords = words.map((word, idx) => {
    // 如果是第一個單字且是常見動詞，我們做特定時態匹配
    if (idx === 0) {
      const lowerWord = word.toLowerCase();
      if (lowerWord === "walk") return "walk(?:s|ed|ing)?";
      if (lowerWord === "have") return "(?:have|has|had|having)";
      if (lowerWord === "go") return "(?:go|goes|went|going)";
      if (lowerWord === "do") return "(?:do|does|did|doing)";
      if (lowerWord === "take") return "(?:take|takes|took|taking|taken)";
      if (lowerWord === "make") return "(?:make|makes|made|making)";
      if (lowerWord === "get") return "(?:get|gets|got|getting|gotten)";
      if (lowerWord === "find") return "(?:find|finds|found|finding)";
      if (lowerWord === "be") return "(?:be|is|am|are|was|were|been|being)";
      
      // 其他一般動詞變化
      return `${word}(?:s|es|d|ed|ing)?`;
    }
    
    // 如果中間有冠詞 "a" 或 "an"，允許後面加一個可選單字（形容詞）
    if (word.toLowerCase() === "a" || word.toLowerCase() === "an") {
      return `${word}(?:\\s+\\w+)?`;
    }
    
    return word;
  });
  
  const finalPattern = processedWords.join("\\s+");
  return new RegExp(finalPattern, "i");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function updateReview(item, result) {
  const current = structuredClone(item.review || {});
  const now = todayISO();
  const history = Array.isArray(current.history) ? current.history : [];
  let nextStage = Number(current.stage || 0);
  let difficulty = current.difficulty || "new";
  let nextReview = addDays(now, 1);

  if (result === "remembered") {
    nextStage += 1;
    nextReview = addDays(now, REVIEW_INTERVALS[nextStage] || 90);
    difficulty = nextStage >= 5 ? "mastered" : "familiar";
  }

  if (result === "blurry") {
    difficulty = "learning";
  }

  if (result === "forgot") {
    nextStage = Math.max(0, nextStage - 1);
    difficulty = "hard";
  }

  reviewState[item.id] = {
    ...current,
    stage: nextStage,
    last_reviewed: now,
    next_review: nextReview,
    review_count: Number(current.review_count || 0) + 1,
    difficulty,
    history: [
      ...history,
      {
        date: now,
        result
      }
    ]
  };

  saveReviewState();
  saveRemoteReviewState();
}

function applyLibraryFilters(items, today) {
  const query = els.searchInput.value.trim().toLowerCase();
  const filter = els.filterSelect.value;

  return items.filter((item) => {
    const review = item.review || {};
    const tags = item.tags || [];
    const haystack = [
      item.expression,
      item.meaning_zh,
      item.example,
      item.note_zh,
      item.type,
      ...tags
    ].join(" ").toLowerCase();

    const matchesQuery = !query || haystack.includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "today" && item.date === today) ||
      (filter === "due" && isDue(item, today)) ||
      (filter === "hard" && review.difficulty === "hard") ||
      (filter === "familiar" && review.difficulty === "familiar") ||
      (filter === "mastered" && review.difficulty === "mastered") ||
      (filter === "academic" && (tags.includes("academic") || tags.includes("writing"))) ||
      (filter === "daily" && (tags.includes("daily") || tags.includes("conversation"))) ||
      (filter === "email" && (tags.includes("email") || tags.includes("formal"))) ||
      tags.includes(filter);

    return matchesQuery && matchesFilter;
  });
}

function renderTagStats(items) {
  const counts = new Map();
  for (const item of items) {
    for (const tag of item.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  els.tagStats.replaceChildren();
  for (const [tag, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const chip = document.createElement("span");
    chip.className = "tag-stat";
    chip.textContent = `${tag} ${count}`;
    els.tagStats.append(chip);
  }
}

function renderForgetList(items) {
  const sorted = [...items]
    .map((item) => {
      const history = item.review?.history || [];
      const forgetCount = history.filter((entry) => entry.result === "forgot").length;
      return { item, forgetCount };
    })
    .filter(({ item, forgetCount }) => forgetCount > 0 || item.review?.difficulty === "hard")
    .sort((a, b) => b.forgetCount - a.forgetCount)
    .slice(0, 5);

  els.forgetList.replaceChildren();

  if (sorted.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "目前沒有忘記紀錄。";
    els.forgetList.append(empty);
    return;
  }

  for (const { item, forgetCount } of sorted) {
    const row = document.createElement("li");
    row.textContent = `${item.expression}（${forgetCount} 次）`;
    els.forgetList.append(row);
  }
}

function renderCalendar(items, today) {
  const activity = getActivitySets(items);
  const activeDays = new Set([...activity.addedDays, ...activity.reviewedDays]);
  const current = parseLocalDate(today);
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const monthNumber = String(month + 1).padStart(2, "0");

  els.calendarMonth.textContent = `${year} 年 ${monthNumber} 月`;
  els.addedDaysCount.textContent = activity.addedDays.size;
  els.reviewDaysCount.textContent = activity.reviewedDays.size;
  els.activeDaysCount.textContent = activeDays.size;
  els.calendarGrid.replaceChildren();

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    const blank = document.createElement("span");
    blank.className = "calendar-day is-blank";
    els.calendarGrid.append(blank);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const dateString = formatDate(new Date(year, month, day));
    const hasAdded = activity.addedDays.has(dateString);
    const hasReviewed = activity.reviewedDays.has(dateString);
    const cell = document.createElement("span");

    cell.className = "calendar-day";
    cell.textContent = day;
    cell.title = getCalendarTitle(dateString, hasAdded, hasReviewed);

    if (dateString === today) cell.classList.add("is-today");
    if (hasAdded) cell.classList.add("has-added");
    if (hasReviewed) cell.classList.add("has-reviewed");
    if (hasAdded && hasReviewed) cell.classList.add("has-both");

    els.calendarGrid.append(cell);
  }
}

function getActivitySets(items) {
  const addedDays = new Set();
  const reviewedDays = new Set();

  for (const item of items) {
    if (item.date) addedDays.add(item.date);

    const review = item.review || {};
    if (review.last_reviewed) reviewedDays.add(review.last_reviewed);

    for (const entry of review.history || []) {
      if (entry.date) reviewedDays.add(entry.date);
    }
  }

  return { addedDays, reviewedDays };
}

function getCalendarTitle(dateString, hasAdded, hasReviewed) {
  if (hasAdded && hasReviewed) return `${dateString} 新增與複習`;
  if (hasAdded) return `${dateString} 新增`;
  if (hasReviewed) return `${dateString} 複習`;
  return dateString;
}

function mergeReview(item) {
  const saved = reviewState[item.id];
  return saved ? { ...item, review: saved } : item;
}

function isDue(item, today) {
  const nextReview = item.review?.next_review;
  return Boolean(nextReview && nextReview <= today);
}

function loadReviewState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveReviewState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviewState));
}

async function syncInitialReviewState() {
  if (!canUseRemoteSync()) {
    setSyncStatus("本機儲存", "offline");
    return;
  }

  setSyncStatus("同步中...", "syncing");

  try {
    const remoteState = await fetchRemoteReviewState();
    const mergedState = mergeReviewStates(remoteState, reviewState);
    const changed = JSON.stringify(mergedState) !== JSON.stringify(remoteState);

    reviewState = mergedState;
    saveReviewState();

    if (changed) {
      await saveRemoteReviewState({ silent: true });
    }

    setSyncStatus("雲端同步完成", "synced");
  } catch (error) {
    setSyncStatus("雲端同步失敗，暫存本機", "error");
  }
}

async function fetchRemoteReviewState() {
  const response = await fetch(REVIEW_API_URL, {
    headers: getSyncHeaders()
  });

  if (response.status === 401) {
    const syncKey = prompt("請輸入複習同步密碼");
    if (!syncKey) throw new Error("Missing sync key");
    localStorage.setItem(SYNC_KEY_STORAGE_KEY, syncKey);
    return fetchRemoteReviewState();
  }

  if (!response.ok) throw new Error(`Sync HTTP ${response.status}`);

  const payload = await response.json();
  return payload.reviewState || {};
}

async function saveRemoteReviewState(options = {}) {
  if (!canUseRemoteSync()) return;

  if (!options.silent) setSyncStatus("同步中...", "syncing");

  try {
    const response = await fetch(REVIEW_API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...getSyncHeaders()
      },
      body: JSON.stringify({ reviewState })
    });

    if (response.status === 401) {
      localStorage.removeItem(SYNC_KEY_STORAGE_KEY);
      const syncKey = prompt("請輸入複習同步密碼");
      if (!syncKey) throw new Error("Missing sync key");
      localStorage.setItem(SYNC_KEY_STORAGE_KEY, syncKey);
      return saveRemoteReviewState(options);
    }

    if (!response.ok) throw new Error(`Sync HTTP ${response.status}`);

    setSyncStatus("雲端同步完成", "synced");
  } catch (error) {
    setSyncStatus("同步失敗，已暫存本機", "error");
  }
}

function getSyncHeaders() {
  const syncKey = localStorage.getItem(SYNC_KEY_STORAGE_KEY);
  return syncKey ? { "x-review-key": syncKey } : {};
}

function canUseRemoteSync() {
  return Boolean(REVIEW_API_URL);
}

function getReviewApiUrl() {
  if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
    return "https://dakota-english-learning-notes.netlify.app/api/review-state";
  }

  return "/api/review-state";
}

function mergeReviewStates(remoteState, localState) {
  const merged = { ...remoteState };

  for (const [id, localReview] of Object.entries(localState || {})) {
    const remoteReview = merged[id];
    merged[id] = chooseNewestReview(remoteReview, localReview);
  }

  return merged;
}

function chooseNewestReview(a, b) {
  if (!a) return b;
  if (!b) return a;

  const aReviewed = a.last_reviewed || "";
  const bReviewed = b.last_reviewed || "";
  if (bReviewed > aReviewed) return b;
  if (aReviewed > bReviewed) return a;

  const aCount = Number(a.review_count || 0);
  const bCount = Number(b.review_count || 0);
  if (bCount > aCount) return b;
  if (aCount > bCount) return a;

  const aHistory = Array.isArray(a.history) ? a.history.length : 0;
  const bHistory = Array.isArray(b.history) ? b.history.length : 0;
  return bHistory > aHistory ? b : a;
}

function setSyncStatus(text, state) {
  if (!els.syncStatus) return;
  els.syncStatus.textContent = text;
  els.syncStatus.className = `sync-status is-${state}`;
}

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function difficultyLabel(value) {
  const labels = {
    new: "新詞",
    learning: "學習中",
    hard: "容易忘記",
    familiar: "已熟悉",
    mastered: "已精熟"
  };

  return labels[value] || "新詞";
}

function renderError(error) {
  for (const list of [els.dueList, els.todayList, els.hardList, els.libraryList]) {
    list.replaceChildren();
  }

  const empty = document.createElement("p");
  empty.className = "empty";
  empty.textContent = `讀取 data/vocab.json 失敗：${error.message}`;
  els.libraryList.append(empty);
}

function shuffleItems(items) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function createClozeReviewCard(item, position, total) {
  const review = item.review || {};
  const card = document.createElement("article");
  card.className = "review-card cloze-review-card";

  const front = document.createElement("div");
  front.className = "review-face review-front";

  const progress = document.createElement("p");
  progress.className = "review-progress";
  progress.textContent = `${position} / ${total} (拼寫模式)`;

  const typeLabel = document.createElement("span");
  typeLabel.className = "word-type";
  typeLabel.textContent = item.type || "expression";
  typeLabel.style.marginBottom = "10px";

  const meaningQ = document.createElement("h3");
  meaningQ.textContent = item.meaning_zh || "";
  meaningQ.style.fontSize = "1.8rem";
  meaningQ.style.marginBottom = "16px";

  const exampleQ = document.createElement("blockquote");
  exampleQ.className = "example";
  exampleQ.style.width = "100%";
  exampleQ.style.textAlign = "left";
  appendClozeExample(exampleQ, item.example || "", item.expression || "");

  const inputContainer = document.createElement("div");
  inputContainer.className = "cloze-input-container";

  const inputEl = document.createElement("input");
  inputEl.type = "text";
  inputEl.className = "cloze-input-field";
  inputEl.placeholder = "請輸入英文單字/片語...";
  inputEl.autocomplete = "off";

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "cloze-submit-btn";
  submitBtn.textContent = "檢查";
  submitBtn.style.minHeight = "auto";
  submitBtn.style.padding = "8px 16px";
  submitBtn.style.background = "var(--accent)";
  submitBtn.style.color = "var(--surface)";
  submitBtn.style.border = "none";
  submitBtn.style.borderRadius = "8px";
  submitBtn.style.cursor = "pointer";
  submitBtn.style.fontWeight = "bold";

  inputContainer.append(inputEl, submitBtn);
  front.append(progress, typeLabel, meaningQ, exampleQ, inputContainer);

  const back = document.createElement("div");
  back.className = "review-face review-back";

  const originalExp = document.createElement("h3");
  originalExp.style.fontSize = "2.2rem";
  originalExp.style.marginBottom = "8px";
  originalExp.style.textAlign = "center";
  originalExp.textContent = item.expression;

  const originalMeaning = document.createElement("p");
  originalMeaning.className = "review-meaning";
  originalMeaning.style.textAlign = "center";
  originalMeaning.style.marginBottom = "14px";
  originalMeaning.textContent = item.meaning_zh;

  const exampleBack = document.createElement("blockquote");
  exampleBack.className = "example";
  appendHighlightedExample(exampleBack, item.example || "", item.expression || "");

  const note = document.createElement("p");
  note.className = "note";
  note.textContent = item.note_zh || "";

  const meta = document.createElement("p");
  meta.className = "review-card-meta";
  meta.textContent = `階段 ${review.stage ?? 0} · 下次複習 ${review.next_review || "未排程"}`;

  const actionContainer = document.createElement("div");
  actionContainer.style.marginTop = "auto";
  actionContainer.style.paddingTop = "12px";

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.className = "cloze-continue-btn";
  continueBtn.style.width = "100%";
  continueBtn.style.minHeight = "44px";
  continueBtn.style.borderRadius = "8px";
  continueBtn.style.border = "none";
  continueBtn.style.cursor = "pointer";
  continueBtn.style.fontWeight = "bold";
  continueBtn.style.fontSize = "1rem";

  actionContainer.append(continueBtn);
  back.append(originalExp, originalMeaning, exampleBack, note, meta, actionContainer);
  card.append(front, back);

  setTimeout(() => {
    inputEl.focus();
  }, 100);

  const handleCheck = () => {
    const userAns = inputEl.value;
    const isCorrect = checkSpellingAnswer(userAns, item.expression);

    if (isCorrect) {
      continueBtn.style.background = "#dcfce7";
      continueBtn.style.color = "#166534";
      continueBtn.textContent = "OK";
      continueBtn.onclick = (e) => {
        e.stopPropagation();
        updateReview(item, "remembered");
        reviewedThisSession.add(item.id);
        render();
      };
    } else {
      continueBtn.style.background = "#fee2e2";
      continueBtn.style.color = "#991b1b";
      continueBtn.textContent = "OK";
      continueBtn.onclick = (e) => {
        e.stopPropagation();
        updateReview(item, "forgot");
        reviewedThisSession.add(item.id);
        render();
      };
    }

    card.classList.add("is-flipped");
  };

  submitBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleCheck();
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      handleCheck();
    }
  });

  return card;
}

function appendClozeExample(container, example, expression) {
  container.replaceChildren();

  if (!example || !expression) {
    container.textContent = example || "（無例句）";
    return;
  }

  const exactPattern = new RegExp(escapeRegExp(expression), "i");
  const flexiblePattern = buildFlexibleExpressionPattern(expression);
  const match = example.match(exactPattern) || example.match(flexiblePattern);

  if (!match || match.index === undefined) {
    const text = document.createElement("span");
    text.textContent = example;
    const blank = document.createElement("strong");
    blank.className = "cloze-blank";
    blank.textContent = " [__________] ";
    container.append(text, document.createElement("br"), blank);
    return;
  }

  const before = example.slice(0, match.index);
  const after = example.slice(match.index + match[0].length);

  const blank = document.createElement("strong");
  blank.className = "cloze-blank";
  
  const blankText = expression.split(/\s+/).map(word => "_".repeat(word.length)).join(" ");
  blank.textContent = ` [ ${blankText} ] `;

  container.append(before, blank, after);
}

function checkSpellingAnswer(userAns, expression) {
  const normUser = normalizeSpelling(userAns);
  const normExpr = normalizeSpelling(expression);
  return normUser === normExpr && normUser.length > 0;
}

function normalizeSpelling(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[.,\/#!$%\^&\*;:{}=`~()?'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

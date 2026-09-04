const DATA_URL = "data/vocab.json";
const REVIEW_API_URL = getReviewApiUrl();
const VOCAB_API_URL = getApiUrl("vocab-data");
const VOCAB_IMAGE_API_URL = getApiUrl("vocab-image");
const CAMBRIDGE_API_URL = getApiUrl("cambridge-lookup");
const STORAGE_KEY = "english-review-state-v1";
const VOCAB_STORAGE_KEY = "english-vocab-data-v1";
const DELETED_VOCAB_STORAGE_KEY = "english-vocab-deleted-ids-v1";
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
let pendingImageDataUrl = null;
let removePendingImage = false;
let deletedVocabIds = loadDeletedVocabIds();

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
  libraryTemplate: document.querySelector("#libraryItemTemplate"),
  addWordsForm: document.querySelector("#addWordsForm"),
  addWordsInput: document.querySelector("#addWordsInput"),
  addWordsSubmit: document.querySelector("#addWordsSubmit"),
  addWordsStatus: document.querySelector("#addWordsStatus"),
  editDialog: document.querySelector("#editDialog"),
  editForm: document.querySelector("#editForm"),
  editId: document.querySelector("#editId"),
  editExpression: document.querySelector("#editExpression"),
  editType: document.querySelector("#editType"),
  editMeaning: document.querySelector("#editMeaning"),
  editExample: document.querySelector("#editExample"),
  editNote: document.querySelector("#editNote"),
  editTags: document.querySelector("#editTags"),
  editStatus: document.querySelector("#editStatus"),
  imagePasteArea: document.querySelector("#imagePasteArea"),
  imagePreview: document.querySelector("#imagePreview"),
  removeImageBtn: document.querySelector("#removeImageBtn"),
  closeEditBtn: document.querySelector("#closeEditBtn"),
  cancelEditBtn: document.querySelector("#cancelEditBtn")
};

document.addEventListener("DOMContentLoaded", init);
els.searchInput.addEventListener("input", render);
els.filterSelect.addEventListener("change", render);
els.addWordsForm.addEventListener("submit", addDailyWords);
els.editForm.addEventListener("submit", saveCardEdits);
els.imagePasteArea.addEventListener("paste", handleImagePaste);
els.removeImageBtn.addEventListener("click", markImageForRemoval);
els.closeEditBtn.addEventListener("click", closeEditDialog);
els.cancelEditBtn.addEventListener("click", closeEditDialog);
els.editDialog.addEventListener("click", (event) => {
  if (event.target === els.editDialog) closeEditDialog();
});

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
    vocab = await loadVocabData(loadedVocab);
    await syncInitialReviewState();
    render();
    refreshLegacyDictionaryNotes();
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

  node.prepend(createCardActions(item.id));
  node.addEventListener("click", () => openEditDialog(item.id));

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

  const reviewImage = item.image ? document.createElement("img") : null;
  if (reviewImage) {
    reviewImage.className = "review-image";
    reviewImage.src = `${getImageUrl(item.id)}?v=${encodeURIComponent(item.image_updated_at || "1")}`;
    reviewImage.alt = `${item.expression || "詞彙"} 的複習圖片`;
  }

  front.append(progress, expression);
  if (reviewImage) front.append(reviewImage);

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

  back.append(meaning, example, note);
  back.append(meta, actions);
  card.append(front, back, createCardActions(item.id));

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

function createCardActions(itemId) {
  const actions = document.createElement("div");
  actions.className = "card-quick-actions";
  actions.append(
    createIconButton("edit", "編輯字卡", () => openEditDialog(itemId)),
    createIconButton("delete", "刪除字卡", () => deleteCard(itemId))
  );
  return actions;
}

function createIconButton(type, label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `card-icon-btn card-icon-${type}`;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = type === "edit"
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>';
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    action();
  });
  return button;
}

function flipReviewCard(card) {
  const isFlipped = card.classList.toggle("is-flipped");
  card.setAttribute("aria-label", isFlipped ? "複習卡片背面；點擊返回正面" : "翻開複習卡片");
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

  node.prepend(createCardActions(item.id));

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

async function loadVocabData(staticVocab) {
  const localVocab = loadLocalVocab();

  try {
    const response = await fetchWithSyncKey(VOCAB_API_URL);
    if (!response.ok) throw new Error(`Vocab HTTP ${response.status}`);
    const payload = await response.json();

    if (Array.isArray(payload.vocab)) {
      deletedVocabIds = Array.isArray(payload.deletedIds) ? payload.deletedIds : [];
      saveDeletedVocabIds();
      const remoteIds = new Set(payload.vocab.map((item) => item.id));
      const deletedIds = new Set(deletedVocabIds);
      const staticAdditions = staticVocab.filter((item) => !remoteIds.has(item.id) && !deletedIds.has(item.id));
      const mergedVocab = [...payload.vocab, ...staticAdditions];
      vocab = mergedVocab;
      saveLocalVocab(mergedVocab);
      if (staticAdditions.length) await saveVocabData({ silent: true });
      return shuffleItems(mergedVocab);
    }

    const initialVocab = Array.isArray(localVocab) ? localVocab : staticVocab;
    vocab = initialVocab;
    await saveVocabData({ silent: true });
    return shuffleItems(initialVocab);
  } catch {
    return shuffleItems(Array.isArray(localVocab) ? localVocab : staticVocab);
  }
}

function loadLocalVocab() {
  try {
    const saved = JSON.parse(localStorage.getItem(VOCAB_STORAGE_KEY));
    return Array.isArray(saved) ? saved : null;
  } catch {
    return null;
  }
}

function loadDeletedVocabIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(DELETED_VOCAB_STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveDeletedVocabIds() {
  localStorage.setItem(DELETED_VOCAB_STORAGE_KEY, JSON.stringify(deletedVocabIds));
}

function saveLocalVocab(items = vocab) {
  try {
    localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(items));
  } catch {
    setSyncStatus("圖片或資料較大，無法暫存本機", "error");
  }
}

async function saveVocabData(options = {}) {
  saveLocalVocab();
  if (!options.silent) setSyncStatus("同步中...", "syncing");

  try {
    const response = await fetchWithSyncKey(VOCAB_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vocab, deletedIds: deletedVocabIds })
    });
    if (!response.ok) throw new Error(`Vocab HTTP ${response.status}`);
    if (!options.silent) setSyncStatus("雲端同步完成", "synced");
    return true;
  } catch {
    if (!options.silent) setSyncStatus("同步失敗，已暫存本機", "error");
    return false;
  }
}

async function fetchWithSyncKey(url, options = {}, retry = true) {
  const headers = {
    ...options.headers,
    ...getSyncHeaders()
  };
  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && retry) {
    localStorage.removeItem(SYNC_KEY_STORAGE_KEY);
    const syncKey = prompt("請輸入同步密碼");
    if (!syncKey) return response;
    localStorage.setItem(SYNC_KEY_STORAGE_KEY, syncKey);
    return fetchWithSyncKey(url, options, false);
  }

  return response;
}

async function addDailyWords(event) {
  event.preventDefault();
  const expressions = parseExpressionLines(els.addWordsInput.value);
  const today = todayISO();
  const existing = new Set(
    vocab
      .map((item) => normalizeExpression(item.expression))
  );
  const uniqueInput = [];

  for (const expression of expressions) {
    const normalized = normalizeExpression(expression);
    if (normalized && !existing.has(normalized)) {
      existing.add(normalized);
      uniqueInput.push(expression);
    }
  }

  if (uniqueInput.length === 0) {
    els.addWordsStatus.textContent = expressions.length ? "詞庫裡已經有相同的單字或片語。" : "請至少輸入一個單字或片語。";
    return;
  }

  els.addWordsStatus.textContent = `正在查詢可靠詞典（0 / ${uniqueInput.length}）…`;
  els.addWordsSubmit.disabled = true;
  const newItems = [];
  const failed = [];
  for (const [index, expression] of uniqueInput.entries()) {
    els.addWordsStatus.textContent = `正在查詢可靠詞典（${index + 1} / ${uniqueInput.length}）：${expression}`;
    const details = await lookupCambridge(expression);
    if (details) {
      newItems.push(createNewVocabItem(expression, today, details));
    } else {
      failed.push(expression);
    }
  }

  if (newItems.length === 0) {
    els.addWordsStatus.textContent = `找不到可靠來源：${failed.join("、")}。請檢查拼字後再試一次。`;
    els.addWordsSubmit.disabled = false;
    return;
  }
  vocab = [...newItems, ...vocab];
  render();
  els.addWordsStatus.textContent = "正在儲存…";
  const synced = await saveVocabData();
  els.addWordsInput.value = "";
  const skipped = expressions.length - uniqueInput.length;
  const messages = [`已查證並新增 ${newItems.length} 筆`];
  if (skipped) messages.push(`略過 ${skipped} 筆重複內容`);
  if (failed.length) messages.push(`查不到：${failed.join("、")}`);
  els.addWordsStatus.textContent = `${messages.join("；")}${synced ? "。" : "；目前先保存在這台裝置。"}`;
  els.addWordsSubmit.disabled = false;
}

async function lookupCambridge(expression) {
  try {
    const response = await fetch(`${CAMBRIDGE_API_URL}?q=${encodeURIComponent(expression)}`);
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.result || null;
  } catch {
    return null;
  }
}

async function refreshLegacyDictionaryNotes() {
  const legacyItems = vocab.filter((item) =>
    item.source?.name?.startsWith("Cambridge Dictionary")
    && /^Cambridge\s*定義[：:]/.test(item.note_zh || "")
  );
  if (legacyItems.length === 0) return;

  let changed = false;
  for (const item of legacyItems) {
    const details = await lookupCambridge(item.expression);
    if (!details?.note_zh) continue;
    const index = vocab.findIndex((entry) => entry.id === item.id);
    if (index < 0) continue;
    vocab[index] = { ...vocab[index], note_zh: details.note_zh, source: details.source || vocab[index].source };
    changed = true;
  }

  if (changed) {
    await saveVocabData({ silent: true });
    render();
  }
}

function parseExpressionLines(value) {
  return value
    .replace(/\u2028|\u2029/g, "\n")
    .replace(/&(?:#x20|#32|nbsp);/gi, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeExpression(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "");
}

function createNewVocabItem(expression, date, details) {
  return {
    id: createUniqueId(date, expression),
    date,
    expression,
    type: details.type || "expression",
    meaning_zh: details.meaning_zh || "",
    example: details.example || "",
    note_zh: details.note_zh || "",
    tags: Array.isArray(details.tags) ? details.tags : ["daily"],
    source: details.source,
    review: {
      stage: 0,
      first_seen: date,
      last_reviewed: null,
      next_review: addDays(date, 1),
      review_count: 0,
      difficulty: "new",
      history: []
    }
  };
}

function createUniqueId(date, expression) {
  const baseSlug = expression
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "expression";
  const base = `${date}-${baseSlug}`;
  const ids = new Set(vocab.map((item) => item.id));
  let candidate = base;
  let suffix = 2;
  while (ids.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function openEditDialog(itemId) {
  const item = vocab.find((entry) => entry.id === itemId);
  if (!item) return;

  pendingImageDataUrl = null;
  removePendingImage = false;
  els.editId.value = item.id;
  els.editExpression.value = item.expression || "";
  els.editType.value = item.type || "";
  els.editMeaning.value = item.meaning_zh || "";
  els.editExample.value = item.example || "";
  els.editNote.value = item.note_zh || "";
  els.editTags.value = (item.tags || []).join(", ");
  els.editStatus.textContent = "";
  updateImagePreview(item.image ? `${getImageUrl(item.id)}?v=${Date.now()}` : "");
  els.editDialog.showModal();
}

function closeEditDialog() {
  pendingImageDataUrl = null;
  removePendingImage = false;
  els.editDialog.close();
}

async function saveCardEdits(event) {
  event.preventDefault();
  const itemId = els.editId.value;
  const index = vocab.findIndex((item) => item.id === itemId);
  if (index < 0) return;

  const expression = els.editExpression.value.replace(/\s+/g, " ").trim();
  if (!expression) {
    els.editStatus.textContent = "單字或片語不能留白。";
    return;
  }

  els.editStatus.textContent = "正在儲存…";
  const updated = {
    ...vocab[index],
    expression,
    type: els.editType.value.trim() || "expression",
    meaning_zh: els.editMeaning.value.trim(),
    example: els.editExample.value.trim(),
    note_zh: els.editNote.value.trim(),
    tags: parseTags(els.editTags.value)
  };

  try {
    if (pendingImageDataUrl) {
      await saveCardImage(itemId, pendingImageDataUrl);
      updated.image = true;
      updated.image_updated_at = new Date().toISOString();
    } else if (removePendingImage) {
      await removeCardImage(itemId);
      delete updated.image;
      delete updated.image_updated_at;
    }

    vocab[index] = updated;
    const synced = await saveVocabData();
    render();
    closeEditDialog();
    if (!synced) setSyncStatus("同步失敗，已暫存本機", "error");
  } catch (error) {
    els.editStatus.textContent = error.message || "圖片或字卡儲存失敗，請再試一次。";
  }
}

function parseTags(value) {
  return [...new Set(
    value
      .split(/[,，]/)
      .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
      .filter(Boolean)
  )];
}

async function deleteCard(itemId) {
  const item = vocab.find((entry) => entry.id === itemId);
  if (!item || !confirm(`確定要刪除「${item.expression}」嗎？這個動作無法復原。`)) return;
  try {
    if (item.image) await removeCardImage(itemId);
    vocab = vocab.filter((entry) => entry.id !== itemId);
    deletedVocabIds = [...new Set([...deletedVocabIds, itemId])];
    saveDeletedVocabIds();
    delete reviewState[itemId];
    saveReviewState();
    await Promise.all([saveVocabData(), saveRemoteReviewState({ silent: true })]);
    reviewedThisSession.delete(itemId);
    render();
  } catch (error) {
    setSyncStatus(error.message || "刪除失敗，請再試一次", "error");
  }
}

async function handleImagePaste(event) {
  const imageFile = [...event.clipboardData.items]
    .find((item) => item.type.startsWith("image/"))
    ?.getAsFile();
  if (!imageFile) {
    els.editStatus.textContent = "剪貼簿裡沒有可用的圖片。";
    return;
  }

  event.preventDefault();
  els.editStatus.textContent = "正在處理圖片…";
  try {
    pendingImageDataUrl = await resizeImage(imageFile);
    removePendingImage = false;
    updateImagePreview(pendingImageDataUrl);
    els.editStatus.textContent = "圖片已貼上，請按「儲存變更」。";
  } catch {
    els.editStatus.textContent = "無法讀取這張圖片，請改用 PNG、JPG、WebP 或 GIF。";
  }
}

function resizeImage(file) {
  if (file.type === "image/gif") return readFileAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function markImageForRemoval() {
  pendingImageDataUrl = null;
  removePendingImage = true;
  updateImagePreview("");
  els.editStatus.textContent = "圖片將在儲存後移除。";
}

function updateImagePreview(src) {
  if (src) {
    els.imagePreview.src = src;
    els.imagePreview.classList.remove("is-hidden");
    els.removeImageBtn.classList.remove("is-hidden");
  } else {
    els.imagePreview.removeAttribute("src");
    els.imagePreview.classList.add("is-hidden");
    els.removeImageBtn.classList.add("is-hidden");
  }
}

async function saveCardImage(itemId, dataUrl) {
  const response = await fetchWithSyncKey(getImageUrl(itemId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl })
  });
  if (!response.ok) throw new Error("圖片儲存失敗，請確認圖片大小後再試一次。");
}

async function removeCardImage(itemId) {
  const response = await fetchWithSyncKey(getImageUrl(itemId), { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error("圖片移除失敗，請再試一次。");
}

function getImageUrl(itemId) {
  return `${VOCAB_IMAGE_API_URL}/${encodeURIComponent(itemId)}`;
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
  return getApiUrl("review-state");
}

function getApiUrl(endpoint) {
  if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
    return `https://dakota-english-learning-notes.netlify.app/api/${endpoint}`;
  }

  return `/api/${endpoint}`;
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

  const reviewImage = item.image ? document.createElement("img") : null;
  if (reviewImage) {
    reviewImage.className = "review-image";
    reviewImage.src = `${getImageUrl(item.id)}?v=${encodeURIComponent(item.image_updated_at || "1")}`;
    reviewImage.alt = `${item.expression || "詞彙"} 的複習圖片`;
  }

  front.append(progress, typeLabel, meaningQ, exampleQ);
  if (reviewImage) front.append(reviewImage);
  front.append(inputContainer);

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
  back.append(originalExp, originalMeaning, exampleBack, note);
  back.append(meta, actionContainer);
  card.append(front, back, createCardActions(item.id));

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

  card.addEventListener("click", () => {
    if (card.classList.contains("is-flipped")) flipReviewCard(card);
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

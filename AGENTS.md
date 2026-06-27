# 英文學習網站專案指令

這個專案是用來整理我每天新學到的英文單字、片語、慣用語、搭配詞、例句與寫作用語，並將內容同步到 Word 筆記與 Netlify 靜態網站。

本專案的核心目標不是單純建立單字列表，而是建立一個可以長期複習的英文學習系統。網站應該根據 spaced repetition 的概念，搭配簡化版 Ebbinghaus 遺忘曲線，提醒我每天該複習哪些詞彙。

---

## 專案根目錄

本專案位於：

```text
~/Desktop/英文
```

請在執行任何修改前，先確認目前所在資料夾是否為此專案目錄。

---

## 專案目標

本專案需要同時維護三個部分：

1. Word 筆記
2. JSON 資料庫
3. Netlify 靜態網站

其中：

* Word 筆記是給我自己閱讀、複習、列印和長期整理用。
* JSON 是網站讀取資料的主要來源。
* 網站是每天快速複習與查看進度的介面。

請不要只更新 Word 而忘記 JSON，也不要只更新網站而讓 Word 筆記不同步。

---

## 主要檔案與資料夾

### `English_Learning_Notes.docx`

這是主要的英文學習 Word 筆記。

用途：

* 給我自己閱讀與複習。
* 內容按日期整理。
* 使用繁體中文解釋。
* 英文單字、片語和例句保留英文。
* 格式要清楚、整齊，方便之後繼續新增。

重要規則：

* 不要刪除舊筆記。
* 不要覆蓋整份 Word，除非確定所有舊內容都有保留。
* 若今天日期已經存在，請把新內容加入當天區塊，不要重複建立相同日期標題。
* 修改前若方便，先建立備份檔，例如 `backups/English_Learning_Notes_YYYY-MM-DD_HHMM.docx`。

---

### `data/vocab.json`

這是網站使用的主要資料來源。

用途：

* 儲存所有英文詞彙、片語、例句與複習狀態。
* 網站會根據這份資料顯示今日新增、今日待複習、全部詞彙與統計資訊。

重要規則：

* 修改後必須確認 JSON 格式正確。
* 不要任意改變既有欄位名稱。
* 如果現有 JSON 格式已經存在，優先沿用原本格式。
* 避免重複新增同一天完全相同的 expression。
* `data/vocab.json` 是主要資料來源。
* 如果網站需要讀取 `site/data/vocab.json`，請在更新後同步複製一份過去。

---

### `site/`

這是 Netlify 靜態網站資料夾。

網站應該簡潔、好讀，適合每天複習英文。

建議包含：

* `site/index.html`
* `site/style.css`
* `site/script.js`
* `site/data/vocab.json`

網站不要做得太複雜。第一版優先使用 HTML、CSS、JavaScript，不要使用大型前端框架，除非我明確要求。

---

### `.agents/skills/english-vocab-updater/SKILL.md`

這是每天更新英文筆記和網站用的 Codex skill。

當我提供今天學到的英文內容時，請使用這個 skill 的流程。

---

## 每日更新流程

當我提供今天新學到的英文內容時，請依照以下流程處理：

1. 先檢查目前專案檔案。
2. 閱讀現有 Word、JSON 與網站格式。
3. 整理我提供的英文內容。
4. 修正明顯拼字、文法或用法錯誤。
5. 將零散內容改寫成清楚的學習筆記。
6. 更新 `English_Learning_Notes.docx`。
7. 更新 `data/vocab.json`。
8. 若網站使用 `site/data/vocab.json`，同步更新該檔案。
9. 若網站結構需要小幅調整，更新 `site/` 裡的檔案。
10. 檢查 JSON 是否有效。
11. 最後用繁體中文回報修改結果。

---

## 每個英文項目應包含的內容

每個詞彙或片語盡量包含：

* `expression`：英文單字、片語、慣用語或句型
* `type`：詞性或用法類型，例如 noun、verb、adjective、phrase、idiom、collocation、sentence pattern
* `meaning_zh`：繁體中文意思
* `example`：自然英文例句
* `note_zh`：繁體中文補充說明
* `tags`：分類標籤
* `review`：複習狀態

如果我沒有提供例句，請補一個自然、實用的英文例句。

例句不要太像課本，要適合日常、學術、TOEFL、email 或正式寫作情境。

---

## Word 筆記格式

Word 筆記請依日期整理。

建議格式如下：

```markdown
## YYYY-MM-DD

### 1. expression

- 中文意思：
- 類型：
- 例句：
- 用法補充：
- 標籤：

### 2. expression

- 中文意思：
- 類型：
- 例句：
- 用法補充：
- 標籤：
```

如果同一天有很多相關詞彙，可以依主題分組，例如：

```markdown
## YYYY-MM-DD

### Academic Writing

### Daily Conversation

### TOEFL Speaking

### Email / Formal Writing

### Useful Collocations
```

---

## JSON 資料格式

`data/vocab.json` 建議維持為陣列格式。

每個項目建議使用以下結構：

```json
{
  "id": "2026-06-24-in-the-long-run",
  "date": "2026-06-24",
  "expression": "in the long run",
  "type": "phrase",
  "meaning_zh": "長遠來看",
  "example": "In the long run, building good study habits is more important than memorizing every word.",
  "note_zh": "常用來討論長期結果或長期影響。",
  "tags": ["daily", "academic"],
  "review": {
    "stage": 0,
    "first_seen": "2026-06-24",
    "last_reviewed": null,
    "next_review": "2026-06-25",
    "review_count": 0,
    "difficulty": "new",
    "history": []
  }
}
```

如果既有 JSON 已經使用不同格式，請優先沿用既有格式，不要任意大改。

---

## ID 命名規則

若需要新增 `id`，請使用：

```text
YYYY-MM-DD-expression-slug
```

例如：

```text
2026-06-24-in-the-long-run
```

規則：

* 全部小寫。
* 空格改成 `-`。
* 移除逗號、句點、驚嘆號、問號等標點。
* 避免與既有 id 重複。

---

## 複習系統設計

網站應採用 spaced repetition 的概念，根據簡化版 Ebbinghaus 遺忘曲線安排複習。

每個詞彙項目應包含 `review` 欄位。

### review 欄位

```json
{
  "stage": 0,
  "first_seen": "YYYY-MM-DD",
  "last_reviewed": null,
  "next_review": "YYYY-MM-DD",
  "review_count": 0,
  "difficulty": "new",
  "history": []
}
```

欄位說明：

* `stage`：目前複習階段，從 0 開始。
* `first_seen`：第一次學到的日期。
* `last_reviewed`：上次複習日期，尚未複習則為 null。
* `next_review`：下次應複習日期。
* `review_count`：已複習次數。
* `difficulty`：可為 `new`、`learning`、`hard`、`familiar`、`mastered`。
* `history`：複習紀錄，可記錄每次複習日期與結果。

---

## 預設複習間隔

使用以下簡化版排程：

```text
stage 0：隔天複習
stage 1：3 天後複習
stage 2：7 天後複習
stage 3：14 天後複習
stage 4：30 天後複習
stage 5：60 天後複習
stage 6 以上：90 天後複習
```

第一次新增詞彙時：

* `stage` 設為 0
* `first_seen` 設為今天日期
* `last_reviewed` 設為 null
* `next_review` 設為明天日期
* `review_count` 設為 0
* `difficulty` 設為 `new`
* `history` 設為空陣列

---

## 複習按鈕邏輯

網站應支援三種複習結果：

### 記得

代表我已經熟悉這個詞彙。

邏輯：

* `stage = stage + 1`
* `review_count = review_count + 1`
* `last_reviewed = today`
* `next_review = today + 下一階段間隔`
* 若 `stage >= 5`，`difficulty = mastered`
* 否則 `difficulty = familiar`

### 有點模糊

代表我大概知道，但還不穩。

邏輯：

* `stage` 不變
* `review_count = review_count + 1`
* `last_reviewed = today`
* `next_review = tomorrow`
* `difficulty = learning`

### 忘記了

代表我需要重新記。

邏輯：

* `stage = max(0, stage - 1)` 或直接回到 0
* `review_count = review_count + 1`
* `last_reviewed = today`
* `next_review = tomorrow`
* `difficulty = hard`

---

## 網站首頁設計

首頁應優先顯示：

1. 今日待複習
2. 今日新增
3. 容易忘記的詞彙
4. 全部詞彙搜尋
5. 學習統計

首頁不要一開始就顯示所有單字，避免資訊太多。

---

## 今日待複習

網站應根據以下條件判斷今日待複習：

```text
review.next_review <= today
```

今日待複習區塊應顯示：

* expression
* 中文意思
* 例句
* 用法補充
* 複習階段
* 難度
* 三個按鈕：

  * 忘記了
  * 有點模糊
  * 記得

---

## 今日新增

今日新增區塊應顯示今天加入的內容。

條件：

```text
date == today
```

每張卡片顯示：

* expression
* 中文意思
* 例句
* 用法補充
* tags

---

## 全部詞彙庫

全部詞彙庫應支援搜尋與篩選。

建議篩選條件：

* 全部
* 今日新增
* 今日待複習
* 容易忘記
* 已熟悉
* 已精熟
* TOEFL
* Academic Writing
* Daily Conversation
* Email / Formal Writing
* Collocation
* Idiom

---

## 學習統計

網站可以顯示簡單統計：

* 累積詞彙數
* 今日新增數量
* 今日待複習數量
* 已精熟數量
* 容易忘記數量
* 各 tag 的數量
* 目前最常忘記的詞彙

不要為了統計而讓網站變複雜。第一版保持簡潔。

---

## 網站資料儲存策略

第一版建議使用靜態 JSON：

* `data/vocab.json` 是主資料。
* `site/data/vocab.json` 是網站讀取用副本。

如果網站有複習按鈕，可以先用瀏覽器 `localStorage` 儲存複習狀態。

注意：

* `localStorage` 只存在目前瀏覽器。
* 換電腦或清除瀏覽器資料可能會遺失。
* 不要假裝它已經同步回 Word 或 JSON。

未來若我要求跨裝置同步，再考慮 Netlify Functions 或資料庫。

---

## Git 同步與 Netlify 部署原則

本專案網站部署到 Netlify，並使用 GitHub 進行版本控制。

原則：

* 每次每日更新英文筆記和 JSON 資料後，**必須自動執行 Git 同步與網站部署**。
* 自動執行的步驟：
  1. 將所有變更加入暫存 (`git add .`)
  2. 提交變更 (`git commit -m "Update vocabulary: YYYY-MM-DD"`)，其中 YYYY-MM-DD 為今天日期
  3. 推送到 GitHub 遠端倉庫 (`git push origin main`)
  4. 部署網站至 Netlify 生產環境 (`npx netlify deploy --prod`)，確保本機與線上同步。
* 自動執行前**不需**再徵求使用者確認，請直接執行指令完成。
* 部署前請確認 `site/` 裡的網站可以正常讀取資料。

---

## 寫作風格

請遵守以下風格：

* 使用繁體中文解釋。
* 英文例句要自然，不要太像教科書。
* 解釋要實用，適合學生複習。
* 不要寫得太像 AI 生成內容。
* 不要過度延伸，除非該詞彙真的需要補充。
* 如果我提供的內容有錯，請修正並簡短說明原因。
* 如果某個詞有正式與口語用法差異，請簡短標出。

---

## Tags 建議

可使用以下 tags：

```text
daily
academic
toefl
speaking
writing
email
conversation
collocation
idiom
formal
informal
grammar
useful-expression
hard
```

請不要建立過多相近的 tags。

例如：

* 不要同時建立 `TOEFL`、`toefl-speaking`、`TOEFL Speaking`、`toefl_speaking`。
* 優先使用小寫英文 tag。
* 多字 tag 使用 `-`。

---

## 修改前檢查

每次修改前，請先檢查：

* 目前有哪些檔案。
* Word 是否存在。
* JSON 是否存在。
* 網站是否已建立。
* JSON 目前格式為何。
* 今天日期是否已經有資料。

---

## 修改後檢查

每次修改後，請檢查：

* Word 是否成功更新。
* JSON 是否可被解析。
* 是否有重複項目。
* `data/vocab.json` 和 `site/data/vocab.json` 是否同步。
* 網站是否仍能讀取資料。
* 是否有明顯拼字或用法錯誤。

---

## 回報格式

完成後，請用繁體中文回報：

```markdown
完成更新。

今天新增：
- expression 1：中文意思
- expression 2：中文意思

修改檔案：
- English_Learning_Notes.docx
- data/vocab.json
- site/data/vocab.json
- site/...

檢查結果：
- Word 更新：完成 / 未完成
- JSON 格式：通過 / 有問題
- 網站資料同步：完成 / 未完成
- 是否需要部署 Netlify：需要 / 不需要
- 備註：
```

---

## 重要安全規則

* 不要刪除舊資料。
* 不要覆蓋整份 Word，除非已確認內容保留。
* 不要破壞 JSON 格式。
* 不要把 API key、token 或帳號密碼寫進專案。
* 不要自動安裝大型套件，除非有必要。
* 每次更新應自動進行 Git commit、push 並部署到 Netlify 生產環境。
* 如果要使用會改動大量檔案的指令，先說明原因。

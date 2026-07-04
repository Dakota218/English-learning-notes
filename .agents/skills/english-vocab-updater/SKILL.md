---
name: english-vocab-updater
description: "Use when the user provides daily English vocabulary, phrases, idioms, collocations, TOEFL wording, email/formal writing phrases, example sentences, or writing notes and wants Codex to update this English learning project: the Word notes, data/vocab.json, the site data copy, and the simple Netlify static review website with spaced repetition scheduling."
---

# English Vocab Updater

Use this skill to turn scattered English learning notes into synchronized study materials for the project at `~/Desktop/英文`.

The project has three synchronized surfaces:
- `English_Learning_Notes.docx`: human-readable notes, organized by date, in Traditional Chinese with English examples kept in English.
- `data/vocab.json`: the primary structured data source.
- `site/`: the static Netlify review site, usually reading `site/data/vocab.json`.

## Workflow

1. Confirm the current directory is `~/Desktop/英文`; switch there if needed.
2. Inspect existing files before editing: Word notes, `data/vocab.json`, `site/`, and `site/data/vocab.json`.
3. Read the existing JSON shape and preserve it. Prefer the existing field names and array/object structure.
4. Parse the user's English input into clean learning items. Correct obvious spelling, grammar, or usage mistakes and mention important corrections in the final report.
5. Add missing `meaning_zh`, `type`, `example`, `note_zh`, and `tags` when the user did not provide them. The vocabulary details MUST be retrieved from the Cambridge Dictionary (via web search) or directly from the user prompt. Avoid pure LLM hallucinations.
6. Before changing Word or JSON, create backups when the files already exist and the change is not trivial:
   - `backups/English_Learning_Notes_YYYY-MM-DD_HHMM.docx`
   - `backups/vocab_YYYY-MM-DD_HHMM.json`
7. Update `English_Learning_Notes.docx` by appending to today's date section if it exists; otherwise create one. Do not delete old notes.
8. Update `data/vocab.json`, avoiding duplicate entries with the same date and normalized expression.
9. If `site/data/vocab.json` exists or the website reads from it, synchronize it from `data/vocab.json`.
10. Make only small site changes unless the user explicitly asks for a redesign.
11. Validate JSON parsing and check that the data copies match.
12. Automatically perform Git commit/push (with message 'Update vocabulary: YYYY-MM-DD') and Netlify production deployment (`npx netlify deploy --prod`).
13. Reply in Traditional Chinese using the report format below.

## Learning Item Shape

When creating new JSON entries, use the existing format if one exists. If the file is new or already uses the recommended array format, use:

```json
{
  "id": "2026-06-24-in-the-long-run",
  "date": "2026-06-24",
  "expression": "in the long run",
  "type": "phrase",
  "meaning_zh": "長遠來看",
  "example": "In the long run, building good study habits is more important than memorizing every word.",
  "note_zh": "常用來討論長期結果或長期影響，適合用在學術寫作或正式討論。",
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

Use today's system date unless the user specifies another date. Store dates as `YYYY-MM-DD`.

## Normalization Rules

Generate `id` as `YYYY-MM-DD-expression-slug`:
- Lowercase.
- Replace whitespace with `-`.
- Remove punctuation and special symbols.
- If the id already exists, append `-2`, `-3`, and so on.

Treat an entry as a duplicate when it has the same date and the same normalized expression:
- Lowercase.
- Trim leading/trailing whitespace.
- Collapse repeated spaces.
- Ignore sentence-final punctuation.

Prefer these `type` values when applicable:
`noun`, `verb`, `adjective`, `adverb`, `phrase`, `idiom`, `collocation`, `sentence pattern`, `phrasal verb`, `transition`, `formal expression`, `spoken expression`.

Prefer these tags:
`daily`, `academic`, `toefl`, `speaking`, `writing`, `email`, `conversation`, `collocation`, `idiom`, `formal`, `informal`, `grammar`, `useful-expression`, `hard`.

Keep tags lowercase and use hyphens for multi-word tags. Do not create near-duplicates such as `TOEFL`, `toefl-speaking`, and `TOEFL Speaking`.

## Example And Explanation Style

Write explanations in Traditional Chinese. Keep them practical and concise.

Examples should be natural, not textbook-stiff. Prefer daily, academic, TOEFL, email, or formal writing contexts. Avoid overly long or artificially complex examples.

If a phrase differs between formal and spoken use, note that briefly.

## Word Notes Format

Organize the Word document by date:

```markdown
## YYYY-MM-DD

### 1. expression

- 中文意思：
- 類型：
- 例句：
- 用法補充：
- 標籤：
```

If many entries share a theme, group them under headings such as `Academic Writing`, `Daily Conversation`, `TOEFL Speaking`, `Email / Formal Writing`, or `Useful Collocations`.

## Review Scheduling

For newly added items:

```json
{
  "stage": 0,
  "first_seen": "YYYY-MM-DD",
  "last_reviewed": null,
  "next_review": "tomorrow",
  "review_count": 0,
  "difficulty": "new",
  "history": []
}
```

Use these review intervals:
- stage 0: 1 day
- stage 1: 3 days
- stage 2: 7 days
- stage 3: 14 days
- stage 4: 30 days
- stage 5: 60 days
- stage 6+: 90 days

Website review button logic:
- `記得`: increment `stage` and `review_count`, set `last_reviewed` to today, set `next_review` using the next-stage interval, set `difficulty` to `familiar` or `mastered` when stage is at least 5.
- `有點模糊`: keep `stage`, increment `review_count`, set `last_reviewed` to today, set `next_review` to tomorrow, set `difficulty` to `learning`.
- `忘記了`: set `stage` to `max(0, stage - 1)` or 0, increment `review_count`, set `last_reviewed` to today, set `next_review` to tomorrow, set `difficulty` to `hard`.

Static sites may store review-button changes in `localStorage`, but do not imply this syncs back to Word or JSON.

## Website Expectations

Keep the site simple and useful for daily review. The home page should prioritize:
1. 今日待複習: `review.next_review <= today`
2. 今日新增: `date == today`
3. 容易忘記: `review.difficulty == "hard"` or many forget history records
4. 全部詞彙搜尋
5. 學習統計

Useful filters include: 全部, 今日新增, 今日待複習, 容易忘記, 已熟悉, 已精熟, TOEFL, Academic, Daily Conversation, Email Writing, Idiom, Collocation.

Always automatically stage all changes, commit with message "Update vocabulary: YYYY-MM-DD" (using today's date), push to GitHub, and deploy to Netlify using `npx netlify deploy --prod`.

## Validation

After edits:
- Confirm Word was updated or clearly report why it was not.
- Parse `data/vocab.json`.
- Parse `site/data/vocab.json` when present.
- Confirm `data/vocab.json` and `site/data/vocab.json` are synchronized when both are intended to exist.
- Check for duplicate same-date same-expression entries.
- Do not deploy if JSON parsing fails or the site cannot read its data.

For JSON checks, use a parser such as:

```bash
python -m json.tool data/vocab.json > /tmp/vocab_check.json
python -m json.tool site/data/vocab.json > /tmp/site_vocab_check.json
```

## Final Report

Reply in Traditional Chinese:

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

## Safety

Never delete old notes or old JSON data. Never overwrite the whole Word document unless old content has been preserved. Never store API keys, tokens, passwords, or private credentials in the project. Keep unrelated website refactors out of daily vocabulary updates.

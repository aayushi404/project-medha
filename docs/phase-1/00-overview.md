# Phase 1 — Overview & Cross-Cutting Rules

Phase 1 turns the placeholder dashboard into the **core text-based teaching
assistant**. A teacher picks a class / subject / chapter context, asks *"how do
I teach this?"*, and gets back — streamed, in Hindi — structured explanation
strategies, a quiz, and a low-tech classroom activity. Each answer is saved as a
**Module** the teacher can revisit and rate.

This doc is the entry point for the `docs/phase-1/` set. Read it first; each
numbered doc that follows covers one build-order step from
[`../phase-1.md`](../phase-1.md) §7, trimmed to the scope locked below.

---

## 1. Locked decisions

### 1.1 Full rename: kit → module

`../phase-1.md` was written with "kit" naming. Phase 1 uses **module**
everywhere — no code named "kit" is written.

| `../phase-1.md` term | Phase 1 term |
|---|---|
| `lesson_kits` table | `modules` |
| `kit_artifacts` table | `module_artifacts` |
| `kit_feedback` table | `module_feedback` |
| `GET /kits`, `/kits/{id}`, `/kits/{id}/feedback` | `/modules`, `/modules/{id}`, `/modules/{id}/feedback` |
| `LessonKitService`, `kit_library_service` | `ModuleService` (`modules/service.py`), `ChatService` (`chat/service.py`) |
| "My Kits" screen | "My Modules" (`/modules`) |

`../phase-1.md` and `../phase-0.md` themselves are left as-is (historical); this
folder is the source of truth for Phase 1.

### 1.2 Backend layout: extend the current feature-module structure

Keep the shipped convention — one folder per feature with `router.py`,
`service.py`, `schemas.py` — as used by `auth/`, `onboarding/`, `reference/`.
**No** `repositories/` / `domain/` / `infrastructure/` restructure.

New backend modules:

```
backend/src/backend/
  core/
    config.py          # -> pydantic-settings Settings (doc 01)
    logging.py         # NEW: dictConfig + request-id formatter (doc 01)
    ownership.py        # NEW: assert_owned() guard (this doc, §2.1)
    errors.py          # NEW: error shape + exception handlers (doc 01)
  curriculum/          # NEW: /curriculum/* (doc 03)
    router.py service.py schemas.py
  profile/             # NEW: /profile (doc 03)
    router.py service.py schemas.py
  chat/                # NEW: /chat/* SSE loop (docs 05, 06)
    router.py service.py schemas.py
  modules/             # NEW: /modules/* library + feedback (doc 06)
    router.py service.py schemas.py
  llm/                 # NEW: LLM client behind an interface (doc 04)
    client.py claude.py
    prompts/explanation.py prompts/quiz.py prompts/activity.py prompts/title.py
  retrieval/           # NEW: embeddings + pgvector search (doc 04)
    embedder.py retriever.py
  db/models/
    chat.py module.py  # NEW (doc 02), registered in db/models/__init__.py
```

### 1.3 Scope: text-only core

**In Phase 1:** chat SSE loop, `ExplanationGen`, `QuizGen`, `ActivityGen`,
`/modules` library, feedback, pgvector retriever, Claude adapter,
`/curriculum/*`, `/profile`.

**Deferred to Phase 2** (tracked in §5): PPT (`python-pptx`), mindmap builder,
PDF export, `/modules/{id}/download`, Redis caching layer, RQ job queue +
workers, `generation_jobs` table, `/jobs/{id}`, full textbook ingestion
pipeline, `Translator` adapter. Voice is Phase 3.

Consequence: **all generation in Phase 1 is synchronous and streamed over SSE**.
There is no async job. `module_artifacts.file_url` exists in the schema but is
never written in Phase 1.

---

## 2. Cross-cutting rules for every new endpoint

### 2.1 Auth + ownership

- Every new route depends on `get_current_teacher`
  (`backend/auth/dependencies.py`) — already implemented, returns a `Teacher`
  from the bearer access token.
- **Ownership is enforced in the service layer, not just the router**, so it
  can't be forgotten on a future endpoint. Add:

  ```python
  # backend/src/backend/core/ownership.py
  from fastapi import HTTPException, status

  def assert_owned(teacher_id, row, attr: str = "teacher_id") -> None:
      """404 (not 403) if the row is missing or not this teacher's —
      don't reveal that someone else's id exists."""
      if row is None or getattr(row, attr) != teacher_id:
          raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found.")
  ```

- Every `chat_sessions` / `modules` / `module_*` read and write goes through a
  service function that calls `assert_owned` before returning or mutating.

### 2.2 Per-teacher chat rate limiting

- LLM cost control. A dependency `chat_rate_limit` (in `chat/router.py` or
  `core/`) counts `chat_messages` rows with `role='teacher'` for the current
  teacher (join through `chat_sessions.teacher_id`) in two trailing windows:
  - last 60 s  → `CHAT_RATE_LIMIT_PER_MIN` (default 6)
  - last 24 h  → `CHAT_RATE_LIMIT_PER_DAY` (default 200)
- Over either → `429` with a clear message.
- This DB-count approach is deliberately simple and single-process-friendly.
  The Redis token-bucket version is Phase 2 (same config keys).
- `/auth/otp/request` already has DB-windowed per-phone limiting — unchanged.

### 2.3 Cost / observability

- Persist `chat_messages.token_count` (output tokens of the assistant message)
  from Claude's `usage`.
- One structured log line per LLM call:
  `llm_call model=<> latency_ms=<> input_tokens=<> output_tokens=<> cache_hit=false request_id=<>`.
- `cache_hit` is always `false` in Phase 1 (no cache); the field is there so
  Phase 2's Redis layer only flips a value.

### 2.4 Error shape

Global handlers (doc 01) return:

```json
{ "error": { "code": "not_found", "message": "Not found.", "request_id": "…" } }
```

for `HTTPException`, `RequestValidationError` (422, `code: "validation_error"`,
plus `details`), and any uncaught `Exception` (500, `code: "internal_error"`,
generic message — **never** a traceback).

Note: the frontend's `extractErrorMessage` (`lib/api.ts`) currently reads
`data.detail`. Doc 01 keeps `detail` populated alongside `error` for
backward-compat, or doc 07 updates `extractErrorMessage` — see doc 01 §4.

### 2.5 Language

- Generate **directly** in `teacher.preferred_language` (default
  `hi-BiharBoli`). Prompts instruct Claude to answer in simple Bihari-inflected
  Hindi. No machine translation; the `Translator` interface is not built in
  Phase 1.
- UI chrome strings live in the frontend (`lib/copy.ts`, doc 07), not the API.

---

## 3. New environment variables

All read through the Pydantic `Settings` object (doc 01). Add to
`backend/.env.example`:

```bash
# LLM — provider is swappable behind backend.llm.LLMClient
LLM_PROVIDER=gemini            # gemini | claude
GEMINI_API_KEY=...             # current: free-tier Gemini
GEMINI_MODEL=gemini-flash-lite-latest
ANTHROPIC_API_KEY=sk-ant-...   # unused while LLM_PROVIDER=gemini
LLM_MODEL=claude-sonnet-5

# Embeddings (retrieval grounding) — see doc 04 for provider choice
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=voyage-3
EMBEDDING_DIM=1024

# Chat rate limits
CHAT_RATE_LIMIT_PER_MIN=6
CHAT_RATE_LIMIT_PER_DAY=200
```

Frontend (`shiksha_sathi/.env.local.example`) is unchanged — still just
`NEXT_PUBLIC_API_URL`.

**Implementation notes (differ from the original doc text):**
- **LLM provider:** Phase 1 ships on **Gemini** (`gemini-flash-lite-latest`,
  free tier) because no Anthropic subscription is available yet. The
  `LLMClient` interface is provider-neutral; `ClaudeClient` stays in the tree
  for a later `LLM_PROVIDER=claude` swap. Where docs say "Claude", read "the
  configured LLM provider".
- **Retrieval:** no embeddings exist yet, so `Retriever.top_k` short-circuits
  to `[]` while `EMBEDDING_API_KEY` is unset — every generation currently runs
  ungrounded. Set the key + run `scripts/embed_chunks.py` to enable grounding.

---

## 4. New dependencies

**Backend** (`backend/pyproject.toml`):
`pydantic-settings`, `anthropic`, `voyageai` (embeddings; `openai` is the
documented alternative), `sse-starlette`.

**Frontend** (`shiksha_sathi/package.json`):
`react-markdown`, `remark-gfm` (render streamed explanation text). Select /
Popover / Dialog primitives come from `@base-ui/react`, already installed.

---

## 5. Out of scope — Phase 2+ backlog

| Item | Phase | Notes |
|---|---|---|
| PPT generation (`python-pptx`) | 2 | from `module_artifacts.content_json` |
| Mindmap builder | 2 | server-side SVG/Mermaid |
| PDF export of a module | 2 | `/modules/{id}/download?format=pdf` |
| Redis cache keyed by `(topic_id, artifact_type, normalized_query)` | 2 | biggest LLM-cost lever |
| RQ job queue + `workers/`, `generation_jobs` table, `GET /jobs/{id}` | 2 | needed once renders are slow/async |
| Full textbook ingestion (`scripts/ingest_textbook.py`, chunker) | 2 | Phase 1 ships a manual `embed_chunks.py` backfill only |
| `Translator` interface + adapter | 2+ | only if internal cross-language search is needed |
| Voice (STT / TTS, Bihari accent) | 3 | see `../phase-0.md` §6 |

---

## 6. Build order (see each doc for detail)

| # | Doc | `../phase-1.md` §7 step |
|---|---|---|
| 01 | `01-skeleton-hardening.md` | 1 (skeleton) |
| 02 | `02-phase1-schema.md` | 5 (migration) |
| 03 | `03-curriculum-and-profile-api.md` | 4 (reference/profile routers) |
| 04 | `04-llm-client-and-retrieval.md` | 6 (LLMClient + retriever) |
| 05 | `05-chat-loop-and-explanation.md` | 7 (ExplanationGen + /chat, streamed) |
| 06 | `06-quiz-activity-and-modules-library.md` | 8 (quiz/activity generators; no queue) |
| 07 | `07-frontend-app-shell.md` | — (presentation) |
| 08 | `08-frontend-dashboard-chat.md` | — (presentation) |
| 09 | `09-frontend-my-modules.md` | — (presentation) |

Steps 2–3 (repositories, auth) from `../phase-1.md` §7 are already done in
Phase 0 (models exist; auth shipped). Phase 1 keeps the "services call
`db.query` directly" convention rather than adding a repository layer.

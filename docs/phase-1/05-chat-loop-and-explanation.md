# 05 — Chat Loop & ExplanationGen (streamed)

**`../phase-1.md` §7 step 7** — "`ExplanationGen` and the `/chat` loop, streamed
— the thinnest complete generation path." Steps 1–5 plus this get a working
product.

## Purpose

End-to-end: teacher creates a session scoped to a curriculum context, sends a
free-form message, and receives a token-streamed explanation over SSE that is
persisted and saved as a **Module** with an `explanation` artifact.

## Files

| File | Change |
|---|---|
| `backend/src/backend/chat/__init__.py` | **new** |
| `backend/src/backend/chat/router.py` | **new** — `/chat/*` |
| `backend/src/backend/chat/schemas.py` | **new** |
| `backend/src/backend/chat/service.py` | **new** — `ChatService` orchestration |
| `backend/src/backend/chat/rate_limit.py` | **new** — `chat_rate_limit` dependency |
| `backend/src/backend/app.py` | `include_router(chat_router)` |

`ExplanationGen` is a function in `chat/service.py` for now (promote to
`llm/generators/explanation.py` only if it grows). Doc 06 adds the quiz/activity
generators and `/generate`.

## The pipeline (mirrors `../phase-1.md` §3)

For `POST /chat/sessions/{id}/messages`:

1. **Resolve context** — load `ChatSession` (ownership-checked), its
   `grade`/`subject`/`chapter`/`topic` labels, and the teacher's
   `preferred_language` + primary subject.
2. **Persist teacher message** — insert `chat_messages(role='teacher',
   content=...)` immediately (so a dropped connection still records the ask).
3. **Rate-limit** — `chat_rate_limit` dependency (doc 00 §2.2); 429 before any
   LLM spend.
4. **Retrieve grounding** — `Retriever.top_k(db, topic_id=session.topic_id,
   query=content, k=5)` if `topic_id` is set, else `[]`.
5. **Plan** — rule-based: a `/messages` call always routes to `ExplanationGen`.
   (Quick-action buttons hit `/generate` instead — doc 06. No LLM planner in
   Phase 1.)
6. **Generate + stream** — build the explanation prompt (doc 04
   `prompts/explanation.py`) with history (prior messages in the session),
   `LLMClient.stream(...)`; forward each `TokenDelta.text` as an SSE
   `event: token`.
7. **Persist on completion** — insert `chat_messages(role='assistant',
   content=<full text>, token_count=<usage.output_tokens>,
   retrieved_chunk_ids=<chunk ids>)`; bump `session.updated_at`; derive
   `session.title` if still null (see §title); **upsert the Module** (§module);
   insert/replace the `explanation` `module_artifact`.
8. **Emit `event: done`** — `{ "module_id": "…", "artifact_id": "…",
   "message_id": "…" }`, then close the stream.

On an `LLMError` mid-stream: emit `event: error {message}` and close; the
teacher message stays persisted, no assistant row is written.

## API

All routes: `Depends(get_current_teacher)`. Ownership via
`assert_owned(teacher.id, session)` (doc 00 §2.1).

### `POST /chat/sessions`

```json
// request
{ "grade_id": "…", "subject_id": "…", "chapter_id": "…|null", "topic_id": "…|null" }
// response 201
{ "id": "…", "grade_id": "…", "subject_id": "…", "chapter_id": "…",
  "topic_id": "…", "title": null, "created_at": "…", "updated_at": "…" }
```

- Validate `grade_id`/`subject_id` exist; if `chapter_id` given, validate it
  matches grade+subject; if `topic_id` given, validate it belongs to
  `chapter_id`. 400 otherwise.

### `GET /chat/sessions`

Recent sessions for the teacher, `order_by(updated_at.desc())`, `limit 20` —
`[{ id, title, grade_id, subject_id, topic_id, updated_at }]`. Powers an
optional "recent topics" list in the sidebar (doc 07 may defer showing it).

### `GET /chat/sessions/{id}`

```json
{ "id": "…", "title": "…", "grade_id": "…", "subject_id": "…",
  "chapter_id": "…", "topic_id": "…",
  "messages": [ { "id": "…", "role": "teacher", "content": "…",
                  "created_at": "…" },
                { "id": "…", "role": "assistant", "content": "…",
                  "created_at": "…" } ],
  "module_id": "…|null" }
```

`messages` ordered by `created_at`.

### `POST /chat/sessions/{id}/messages`  → **SSE**

Request: `{ "content": "Photosynthesis kaise samjhaun taaki bachche bore na hon?" }`

Response: `text/event-stream` via `sse_starlette.EventSourceResponse`:

```
event: token
data: {"text": "Namaste"}

event: token
data: {"text": " ji,"}

event: done
data: {"module_id":"…","artifact_id":"…","message_id":"…"}
```

Error frame: `event: error` / `data: {"message":"…"}`.

Headers: `Cache-Control: no-cache`, `X-Accel-Buffering: no` (disable proxy
buffering so tokens actually flush on slow links).

## Session title (§title)

On the first teacher message only: `LLMClient.complete(prompts/title.build(...))`
→ trimmed to ≤60 chars. On any failure, fall back to
`content[:60].rstrip() + ("…" if len(content) > 60 else "")`. Store on
`chat_sessions.title` and copy to `modules.title`.

## Module upsert (§module)

- One Module per session. On the first assistant completion, insert
  `modules(teacher_id, session_id, grade_id, subject_id, topic_id, title)`.
- On later completions in the same session, reuse it and bump `updated_at`.
- The `explanation` artifact: keep the **latest** explanation — either replace
  the existing `artifact_type='explanation'` row's `content_json` (store
  `{ "text": <full markdown> }`) or insert a new one and let the library show
  the newest. Phase 1: **replace** (one explanation per module); quiz/activity
  (doc 06) can accumulate.

## `chat/rate_limit.py`

```python
def chat_rate_limit(teacher = Depends(get_current_teacher),
                    db: Session = Depends(get_db)) -> None:
    now = datetime.now(timezone.utc)
    def count_since(delta):
        return (db.query(func.count(ChatMessage.id))
                  .join(ChatSession, ChatMessage.session_id == ChatSession.id)
                  .filter(ChatSession.teacher_id == teacher.id,
                          ChatMessage.role == "teacher",
                          ChatMessage.created_at >= now - delta)
                  .scalar())
    if count_since(timedelta(minutes=1)) >= settings.chat_rate_limit_per_min:
        raise HTTPException(429, "You're sending messages too quickly. Wait a moment.")
    if count_since(timedelta(days=1)) >= settings.chat_rate_limit_per_day:
        raise HTTPException(429, "Daily limit reached. Try again tomorrow.")
```

Applied to `/messages` and (doc 06) `/generate`.

## Key decisions

- **Teacher message persisted before generation** — provenance survives a
  dropped stream on a 2G connection.
- **`EventSourceResponse` from `sse-starlette`** — cleaner than hand-rolling
  `StreamingResponse`; handles keep-alive comments and client-disconnect.
- **Auth stays bearer-token** — the frontend consumes the stream with `fetch` +
  `ReadableStream` (doc 07 `lib/sse.ts`), not `EventSource`, so the
  `Authorization` header works. No cookie/query-token scheme needed.
- **Rule-based routing** — `/messages` ⇒ explanation, `/generate` ⇒ named
  generator. An LLM planner is explicitly deferred (`../phase-1.md` §3).
- **One Module per session, explanation replaced in place** — keeps "My
  Modules" a list of topics, not a list of every regeneration.
- **Sync DB `Session` inside an async route** — acceptable at Phase 1 scale;
  flagged for Phase 2 (`asyncpg` + `AsyncSession`).

## How to test

1. Docs 01–04 done; `ANTHROPIC_API_KEY` set; `embed_chunks.py` run.
2. Auth as `+919000000001`. Grab Class 8 `grade_id`, Science `subject_id`,
   photosynthesis `chapter_id` + `topic_id` from doc 03 endpoints.
3. `POST /chat/sessions` with those → session id, `title: null`.
4. `curl -N -H "Authorization: Bearer …" -H 'Content-Type: application/json' \
     -d '{"content":"Photosynthesis kaise samjhaun?"}' \
     localhost:8000/chat/sessions/<id>/messages`
   → `event: token` frames stream in, then one `event: done` with a
   `module_id`.
5. `GET /chat/sessions/<id>` → two messages; assistant row has `token_count`
   set and `retrieved_chunk_ids` containing the photosynthesis chunk id;
   `title` now a short Hindi phrase; `module_id` populated.
6. Send a second message in the same session → same `module_id` in `done`;
   `session.updated_at` advanced.
7. Fire 7 messages in <60 s → the 7th returns `429`.
8. Session with `topic_id: null` → still streams (ungrounded);
   `retrieved_chunk_ids` is null/empty.

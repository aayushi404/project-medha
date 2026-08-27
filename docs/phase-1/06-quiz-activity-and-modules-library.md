# 06 — Quiz & Activity Generators + Modules Library

**`../phase-1.md` §7 step 8** — the text generators only (quiz, activity).
PPT / mindmap / job queue stay in Phase 2 (doc 00 §5). This step completes the
backend: quick-action generation and the "My Modules" API (list, detail,
delete, feedback).

## Purpose

- `POST /chat/sessions/{id}/generate` — run one named generator (`quiz` or
  `activity`) directly, streamed, and save it as a `module_artifact`.
- `/modules` — the read/manage API behind the "My Modules" screen.
- `/modules/{id}/feedback` — thumbs up/down + comment (the product's core
  feedback loop, `../phase-0.md` §5).

## Files

| File | Change |
|---|---|
| `backend/src/backend/chat/router.py` | add `POST /chat/sessions/{id}/generate` |
| `backend/src/backend/chat/service.py` | add `QuizGen`, `ActivityGen`, `run_generator(...)` |
| `backend/src/backend/chat/schemas.py` | add `GenerateIn` |
| `backend/src/backend/modules/__init__.py` | **new** |
| `backend/src/backend/modules/router.py` | **new** — `/modules/*` |
| `backend/src/backend/modules/schemas.py` | **new** |
| `backend/src/backend/modules/service.py` | **new** — `ModuleService` |
| `backend/src/backend/app.py` | `include_router(modules_router)` |

## `POST /chat/sessions/{id}/generate`  → **SSE**

Request: `{ "artifact_type": "quiz" | "activity" }`
(`explanation` is not valid here — that's `/messages`.)

Flow (reuses doc 05 machinery):

1. Ownership-check the session; `chat_rate_limit` dependency.
2. Retrieve grounding for `session.topic_id` (query = the session's last
   teacher message, or the topic title if none).
3. Build the quiz / activity prompt (doc 04). `LLMClient.stream(...)`.
4. Stream `event: token` frames (raw model output — the frontend shows a
   "generating…" state; final JSON is parsed on `done`).
5. On completion: parse the JSON body (tolerant: strip ``` fences, find the
   first `{`/last `}`). On parse failure → `event: error`, persist nothing.
6. Insert a `module_artifacts` row: `artifact_type`, `content_json` = parsed
   object + `{"_prompt_version": VERSION}`. **Quiz and activity artifacts
   accumulate** (unlike explanation which is replaced) — but de-dup: if an
   artifact of that type already exists for the module, replace it (Phase 1
   keeps one of each type per module; revisit if teachers want variants).
7. Also append an `assistant` `chat_message` with a short human line
   ("Quiz taiyaar hai — 6 sawaal.") so the conversation stays coherent; the
   structured data lives on the artifact.
8. `event: done` → `{ "module_id": "…", "artifact_id": "…",
   "artifact_type": "quiz" }`.

If the session has no Module yet (teacher hit a quick action before ever
sending a free-form message), create the Module here (same upsert as doc 05).

### `content_json` shapes

**quiz**
```json
{
  "questions": [
    { "q": "Patti hara rang kis vajah se hoti hai?",
      "type": "mcq",                       // mcq | short | truefalse
      "options": ["Chlorophyll", "Paani", "Mitti", "Hawa"],
      "answer": "Chlorophyll",
      "difficulty": "easy" }
  ]
}
```
5–10 questions; `options` omitted for `short`; `answer` is `"true"`/`"false"`
for `truefalse`.

**activity**
```json
{
  "title": "Patta chaap – photosynthesis observation",
  "materials": ["none"],                    // or ["chalk","paper"] etc.
  "group_size": 4,
  "duration_min": 20,
  "steps": ["Class ko 4-4 ke group me baanto.", "..."],
  "variation": "Agar dhoop na ho to ..."
}
```

## `/modules` API

All routes `Depends(get_current_teacher)`; every access via `ModuleService`
which calls `assert_owned` (doc 00 §2.1).

### `GET /modules?grade_id=&subject_id=`

Both filters optional. Current teacher's modules, `order_by(updated_at.desc())`.

```json
[
  { "id": "…", "title": "Photosynthesis", "grade_id": "…",
    "grade_label": "Class 8", "subject_id": "…", "subject_name": "Science",
    "topic_id": "…", "artifact_types": ["explanation", "quiz", "activity"],
    "updated_at": "…" }
]
```

`grade_label` / `subject_name` joined so the frontend can group by
"CLASS 8 · SCIENCE" without extra calls. `artifact_types` = distinct types
present, in canonical order.

### `GET /modules/{id}`

```json
{
  "id": "…", "title": "Photosynthesis",
  "grade_label": "Class 8", "subject_name": "Science",
  "topic_title": "Photosynthesis: How Green Plants Prepare Food",
  "session_id": "…|null",
  "created_at": "…", "updated_at": "…",
  "artifacts": [
    { "id": "…", "artifact_type": "explanation",
      "content_json": { "text": "..." }, "created_at": "…" },
    { "id": "…", "artifact_type": "quiz", "content_json": { "questions": [ … ] },
      "created_at": "…" }
  ],
  "feedback": { "rating": 1, "comment": "Bahut accha", "created_at": "…" } | null
}
```

`feedback` = the current teacher's own row (unique per `(module_id,
teacher_id)`).

### `DELETE /modules/{id}` → `204`

Cascades to `module_artifacts` and `module_feedback` (FK `ON DELETE CASCADE`).
`chat_sessions.module`… n/a (`modules.session_id` is `SET NULL` the other
way; the session itself is untouched).

### `POST /modules/{id}/feedback` → `200`

```json
// request
{ "rating": 1, "comment": "Analogy accha tha" }   // rating: 1 | -1 ; comment optional
// response
{ "rating": 1, "comment": "Analogy accha tha", "created_at": "…" }
```

Upsert on `unique(module_id, teacher_id)` — `INSERT … ON CONFLICT
(module_id, teacher_id) DO UPDATE`. `rating` constrained to `{1, -1}` (422
otherwise). Re-POSTing overwrites (lets a teacher flip the rating or edit the
comment).

## Key decisions

- **`/generate` is a sibling of `/messages`, not a mode of it** — quick actions
  skip planning entirely (`../phase-1.md` §3); one endpoint, one generator arg.
- **Structured data on the artifact, a one-line note in the chat** — the thread
  stays readable; the frontend renders the artifact from `content_json`, not
  from parsing chat text.
- **Tolerant JSON parsing, fail closed** — a malformed generation persists
  nothing and tells the teacher to retry, rather than saving garbage.
- **One artifact per type per module in Phase 1** — keeps the detail screen
  simple; multiple variants is a later enhancement.
- **Feedback is per teacher per module, upsertable** — matches the `unique`
  constraint from doc 02 and `../phase-1.md`.
- **`grade_label` / `subject_name` denormalised into responses** — the "My
  Modules" grouping needs them; avoids N+1 on the client.

## Reuse

- doc 05's `ChatService` streaming helper, `chat_rate_limit`, Module upsert,
  `Retriever`.
- `reference/router.py::search_schools` — the multi-join + response-mapping
  pattern for `GET /modules`.
- `onboarding/schemas.py` — validator style for `rating` / `artifact_type`
  enums (use `Literal[...]` in the Pydantic models).

## How to test

1. Doc 05 verified; have a session with an explanation + Module.
2. `curl -N … -d '{"artifact_type":"quiz"}'
   localhost:8000/chat/sessions/<id>/generate` → tokens stream, `done` carries
   an `artifact_id`.
3. `GET /modules` → one row, `artifact_types` contains `["explanation","quiz"]`,
   `grade_label` "Class 8".
4. `POST .../generate {"artifact_type":"activity"}` → `GET /modules/<id>` now
   has 3 artifacts; `activity.content_json.materials` is `["none"]` or a short
   list; `quiz.content_json.questions` length 5–10.
5. `POST /modules/<id>/feedback {"rating":1,"comment":"good"}` → 200; re-POST
   `{"rating":-1}` → `GET /modules/<id>` shows `feedback.rating == -1`.
6. `POST .../feedback {"rating":2}` → 422.
7. `DELETE /modules/<id>` → 204; `GET /modules/<id>` → 404; the underlying
   `chat_session` still resolves via `GET /chat/sessions/<sid>` with
   `module_id: null`.
8. Second teacher can't see or delete the first teacher's module (→ 404).

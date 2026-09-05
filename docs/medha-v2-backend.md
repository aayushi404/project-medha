# Medha v2 — Backend Architecture Plan

**Status:** design, not yet implemented
**Companion docs:** `medha-v2-schema.md` (tables), `medha-v2-frontend.md` (UI)

Goal: cleanly separate **Ask Medha** (conversation) from **Content Generation**
(durable artifacts), on the current FastAPI + SQLAlchemy + Alembic stack, with
additive migrations only.

---

## 1. Package layout

```
backend/src/backend/
  ask/                      ← was `chat/`, renamed + narrowed to conversation
    router.py                 /ask/sessions* (SSE messages, no artifact side-effects)
    service.py                stream_message() — pure conversation now
    rate_limit.py             (unchanged)
    schemas.py
  speech/                   ← unchanged. /speech/transcribe, /synthesize, /converse
  generation/              ← NEW domain
    router.py                 /generate/{type}, /generations*, /library
    service.py                the generation pipeline (§4)
    pipeline.py               retrieval → prompt → LLM stream → parse → persist
    cache.py                  cache_key compute + probe/copy (§8)
    render.py                 export registry: pptx (existing), pdf, docx-later
    schemas/                  Pydantic content_json models, one per type (§3)
      __init__.py             TYPE_MODELS registry {type: Model}
      lesson_plan.py
      presentation.py         re-exports backend.ppt.schema.Deck
      question_paper.py
      notes.py
      quiz.py
  llm/prompts/generation/   ← NEW versioned builders, one per type (§3)
      lesson_plan.py  presentation.py  question_paper.py  notes.py  quiz.py
  modules/                  ← kept read-only during transition, thinned after 0012
  ppt/                      ← unchanged renderer; `render.py` calls into it
  library/                  ← folded into generation/router.py; package removed at 0012
```

`chat/` → `ask/` is a rename for clarity (the domain is "Ask Medha", and
`chat_*` tables keep their names). Do it as one mechanical commit: move the
package, update `app.py`'s import, keep the router `prefix="/ask"` **with a
compatibility `prefix="/chat"` alias mounted** for one release so the deployed
frontend doesn't break mid-rollout.

---

## 2. Router map

### Ask Medha — `/ask` (was `/chat`)

| Method + path | Purpose | Notes |
|---|---|---|
| `POST /ask/sessions` | start a conversation (grade + subject, optional chapter/topic) | unchanged from `create_session` |
| `GET /ask/sessions` | recent conversations for the sidebar | unchanged |
| `GET /ask/sessions/{id}` | full thread | `messages[]` now carry optional `generation_id` |
| `POST /ask/sessions/{id}/messages` | SSE: `token*` → `done` | **no longer** upserts Module/artifact. If the model's reply is a generation request, see §5. |
| `DELETE /ask/sessions/{id}` | delete a conversation | new; `generations.session_id` is `SET NULL` so artifacts survive |

`/speech/*` is untouched — voice already lives in its own domain and writes
`voice_turns`, not messages.

### Content Generation — `/generate` + `/generations`

| Method + path | Purpose |
|---|---|
| `POST /generate/{type}` | **SSE**. Body = curriculum scope + `input_params`. Streams `token*` (or `progress` for non-text types) → `done {generation_id, type, cached}`. Rate-limited. |
| `GET /generations` | History list. Query: `?type=&favorite=&q=&limit=&cursor=`. No `type` = the "All" tab. |
| `GET /generations/{id}` | one artifact: `type`, `title`, `content_json`, `input_params`, `status`, `feedback`, `exports[]` |
| `POST /generations/{id}/regenerate` | new row, `source='regenerate'`, `parent_generation_id=id`. Body may override `input_params` ("make it simpler", "8 questions not 5"). SSE, same contract as `/generate`. |
| `PATCH /generations/{id}` | `{ is_favorite?, title? }` — the only user-editable fields for now |
| `DELETE /generations/{id}` | hard delete; cascades exports + feedback |
| `POST /generations/{id}/feedback` | `{ rating, comment? }` → upsert `generation_feedback` |
| `GET /generations/{id}/export/{format}` | render-on-demand → file bytes (`pptx` today; `pdf` next). Streams `Content-Disposition: attachment`. |
| `GET /library` | curated browse. Query: `?type=&grade_id=&subject_id=&chapter_id=`. Reads `generations WHERE visibility='library' AND published`. |
| `POST /library/{id}/clone` | copy a curated row into the teacher's History (`source='curated'`, `parent_generation_id`) so they can edit/export it |

All under `Depends(get_current_teacher)`. `/generate/*` also under
`Depends(generation_rate_limit)`.

---

## 3. Prompt + content-schema system

Each type has **two** paired modules, mirroring the existing `llm/prompts/`
convention (`VERSION` + `build()`):

```
llm/prompts/generation/quiz.py       VERSION="quiz-v2";  build(ctx, input_params) -> (system, messages)
generation/schemas/quiz.py           class QuizContent(BaseModel): ...
```

`build()` signature extends the shared one with `input_params`:

```python
def build(*, grade_label, subject_name, topic_title, topic_description,
          language, chunks, input_params: dict, history=None) -> tuple[str, list[Message]]:
```

- Reuse `llm.prompts.format_chunks` and `language_instruction` verbatim.
- `input_params` is type-specific and its own small Pydantic model
  (`QuizParams`, `LessonPlanParams`, …) validated on the way **in** from the
  request body, then passed to `build()`.
- `generation/schemas/__init__.py` exposes
  `CONTENT_MODELS: dict[str, type[BaseModel]]` and
  `PARAM_MODELS: dict[str, type[BaseModel]]` so the router/pipeline stay generic
  — no per-type branching in `router.py`.

`presentation` reuses everything that exists: `llm/prompts/ppt.py` becomes
`generation/presentation.py` (same text), and `generation/schemas/presentation.py`
just re-exports `backend.ppt.schema.Deck` / `parse_deck`.

---

## 4. The generation pipeline

`generation/pipeline.py::run(db, teacher, type, scope, input_params)` — an async
generator yielding SSE frames, structured like the existing
`chat/service.run_generator` but generalised:

```
1. validate            PARAM_MODELS[type](**input_params)           → 422 on bad input
2. resolve scope       load Grade/Subject/Chapter/Topic rows        → 400 on mismatch
3. cache probe         cache.probe(db, type, scope, params, lang)
                         hit  → copy row, emit `done {cached:true}`, RETURN   (no LLM)
                         miss → continue
4. insert stub         Generation(status='running', input_params=…, cache_key=…, source=…)
                       db.commit()  — a dropped connection still records the attempt
5. retrieval grounding Retriever().top_k(topic_id, query)  when topic set; never fatal
6. build prompt        prompts.generation[type].build(ctx, input_params)
7. stream LLM          client.stream(system, messages, max_tokens=CAPS[type])
                         → yield `token` frames (text types)
                         → yield `progress` frames (presentation: "slide 3/8")
8. parse + validate    CONTENT_MODELS[type].model_validate(extract_json(buffer))
                         fail → row.status='failed', error_message=…, emit `error`, RETURN
9. persist             row.content_json = parsed.model_dump()
                       row.status='completed'; completed_at, model, prompt_version,
                       tokens_in/out, generation_ms
                       db.commit()
10. done               emit `done {generation_id, type, cached:false}`
```

**SSE contract** — reuses the frontend's existing `lib/sse.ts` dispatcher
unchanged (`token` / `done` / `error`), plus one optional new frame:

| event | data | when |
|---|---|---|
| `token` | `{text}` | text-heavy types (lesson_plan, notes, question_paper, quiz) stream live |
| `progress` | `{stage, done, total}` | presentation / worksheet — model returns a big JSON blob, so stream structural progress not tokens |
| `done` | `{generation_id, type, cached}` | success |
| `error` | `{message, fallback}` | `fallback: "retry" \| "type_instead"` |

`max_tokens` caps per type live in config (`generation_max_tokens_*`), matching
the voice-assistant pattern.

---

## 5. Ask Medha: chat stops making artifacts

`ask/service.stream_message` today calls `_upsert_module`,
`_replace_explanation_artifact`, `_derive_title`. v2:

- **Drop** `_upsert_module` + `_replace_explanation_artifact` + the `Module`
  import. A chat turn writes exactly one `chat_messages` row (assistant) and
  bumps `session.updated_at`. `_derive_title` stays (session titles).
- **Generation-from-chat** (SAVRA screenshot 4): when the teacher's message is a
  generation ask ("make a quiz on this", "lesson plan for this chapter"), the
  reply path is:
  1. a light intent classifier (few-shot, cheap model call — or a leading
     `/quiz`, `/lesson` slash affordance in the composer to skip it entirely)
  2. call `generation.pipeline.run(...)` with `source='chat'`, `session_id=…`,
     scope taken from the session
  3. write the assistant `chat_messages` row with `generation_id` set and
     `content` = a one-line ack ("Quiz ready — 6 questions.")
  4. stream the pipeline's frames through the same SSE response
- The chat UI renders the inline document card from `message.generation_id`
  (frontend doc §4).

Phase this: ship the split first with **no** chat-generation path (teacher uses
the quick actions), add the slash affordance next, add the classifier last.

---

## 6. Rendering & exports

`generation/render.py` — a registry keyed by `(type, format)`:

```python
RENDERERS = {
    ("presentation", "pptx"): _render_deck_pptx,   # wraps backend.ppt.render_pptx
    ("lesson_plan",  "pdf"):  _render_html_pdf,
    ("question_paper","pdf"): _render_html_pdf,
    ("notes",        "pdf"):  _render_html_pdf,
    ("quiz",         "pdf"):  _render_html_pdf,
}
```

- **`pptx`**: unchanged path. `GET /generations/{id}/export/pptx` parses
  `content_json` with `parse_deck`, calls `render_pptx`, returns bytes. No DB
  row, no storage — exactly today's behavior.
- **`pdf`**: new. Server-side HTML → PDF. Recommend `weasyprint` (pure-Python,
  already have `lxml`) rendering a Jinja template per type; the lesson-plan
  template is the columnar table from screenshot 6. Synchronous, in-memory,
  same as pptx.
- **`generation_exports` rows** are written only once `ppt_storage_*` points at
  a real R2 bucket: then renders go to object storage, `file_key` is saved, and
  the endpoint 302s to a freshly-signed URL. Until then the table stays empty
  and every export is on-demand. This is the same "Tier 2" boundary already
  documented in `core/config.py`.
- **`docx`**: deferred.

---

## 7. Transition compat layer (between `0010` and `0012`)

`GET /generations` must show a teacher's **old** `module_artifacts` rows until
`0011` backfills them. Thin adapter in `generation/service.py`:

```
list_history(teacher, filters):
    new = query generations (the real path)
    if not settings.generation_legacy_read:  return new
    legacy = query module_artifacts JOIN modules  (mapped to the same DTO shape)
    return merge_sorted(new, legacy, key=created_at desc)
```

`generation_legacy_read` defaults **on** at `0010`, is flipped **off** in the
deploy that runs `0011`, and the adapter code is deleted in `0012`. Same trick
for `GET /library` reading `library_presentations` until its backfill.

---

## 8. Caching (`generation/cache.py`)

```python
def compute_key(type, scope, params, language, prompt_version) -> str:
    payload = {
        "type": type,
        "scope": scope.chapter_id or f"{scope.grade_id}:{scope.subject_id}",
        "params": _canonical(params),          # sorted keys, defaults filled, casefold strings
        "language": language,
        "pv": prompt_version,
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()

def probe(db, key) -> Generation | None:
    return (db.query(Generation)
              .filter(Generation.cache_key == key,
                      Generation.status == "completed",
                      Generation.visibility.in_(("private", "library")))
              .order_by(Generation.created_at.desc())
              .first())

def copy_for(db, teacher, src) -> Generation:
    # new owned row, source='cache', parent_generation_id=src.id, content copied
```

- Guarded by `settings.generation_cache_enabled` (default true).
- The copy is a full independent row — the teacher can edit/favourite/delete it
  without touching the source.
- Cross-teacher reuse is intentional and safe: generated curriculum content is
  not personal data. (If a teacher's `input_params` ever carries free-text that
  shouldn't leak, exclude that field from `_canonical` — currently none do.)

---

## 9. Config additions (`core/config.py`)

```python
    # --- Content generation ---
    generation_rate_limit_per_min: int = 4
    generation_rate_limit_per_day: int = 120
    generation_cache_enabled: bool = True
    generation_legacy_read: bool = True          # flip off when 0011 runs; remove at 0012
    generation_max_tokens_lesson_plan: int = 2200
    generation_max_tokens_question_paper: int = 2600
    generation_max_tokens_notes: int = 1800
    generation_max_tokens_quiz: int = 1400
    generation_max_tokens_presentation: int = 2400
    generation_enabled: bool = True              # kill switch, hides FE quick actions
```

---

## 10. Rollout phases

| Phase | Ships | Reversible? |
|---|---|---|
| **A** | `chat/`→`ask/` rename + `/chat` alias. No behavior change. | yes |
| **B** | Migration `0010`. `generation/` package, pipeline, `POST /generate/{type}` for the 5 named types, `GET /generations` (+ legacy-read adapter), feedback, favourite, delete, `export/pptx`. Chat **stops** writing modules. FE quick actions go live. | `0010` down-migrates cleanly |
| **C** | `export/pdf` via weasyprint. `/library` on the new table (legacy-read adapter). `regenerate`. | yes |
| **D** | Migration `0011` backfill; flip `generation_legacy_read=false`. Verify History parity. | backfill down is lossy — snapshot prod first |
| **E** | Migration `0012`: drop `module_artifacts`, `module_feedback`, `library_presentations`; delete their models, the `library/` package, dead `modules/` + `ppt` glue, the compat adapter. | recreate-empty only |
| **F** (later) | chat-generation path (§5), `worksheet` + `notice` types, R2 exports, quiz assessment domain. | — |

Each phase is independently deployable and leaves the app working.

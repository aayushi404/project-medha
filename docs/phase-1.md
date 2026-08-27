# Medha — Backend Architecture

## Name of the project is changed to Medha.

FastAPI backend for the AI teaching assistant serving Bihar government school teachers.
Stack: FastAPI + SQLAlchemy + Alembic + Postgres/pgvector + Redis + S3.

---

## 1. Folder structure

```
backend/
  app/
    main.py                  # FastAPI app factory, middleware, router registration
    config.py                # Pydantic Settings — all env vars in one typed place
    dependencies.py          # get_db, get_current_teacher, rate limiters

    api/
      routers/
        auth.py              # /auth/*
        onboarding.py        # /onboarding/*
        curriculum.py        # /reference/*, /curriculum/*
        chat.py              # /chat/*  (the core generation loop)
        kits.py              # /kits/*  (history, export, download)
        health.py            # /health  (for uptime checks on Render/Railway)
      schemas/               # Pydantic request/response models, per domain
        auth.py
        onboarding.py
        curriculum.py
        chat.py
        kits.py

    services/                # Use cases. Orchestration lives here, not in routers.
      auth_service.py
      onboarding_service.py
      lesson_kit_service.py  # the agent orchestrator: plan -> retrieve -> generate
      kit_library_service.py

    domain/                  # Pure logic + interfaces. No FastAPI, no SQLAlchemy.
      interfaces/
        llm_client.py        # abstract LLMClient
        sms_provider.py      # abstract SMSProvider
        storage.py           # abstract ObjectStorage
        translator.py        # abstract Translator
      generators/
        explanation.py
        quiz.py
        activity.py
        ppt_builder.py       # python-pptx
        mindmap_builder.py
        pdf_exporter.py
      retrieval/
        retriever.py         # embed query -> pgvector similarity search
        chunker.py           # textbook ingestion chunking logic
      prompts/
        explanation.py       # prompt templates, versioned
        quiz.py
        activity.py

    repositories/            # All DB access. Services never touch SQLAlchemy directly.
      teacher_repo.py
      curriculum_repo.py
      lesson_kit_repo.py
      session_repo.py

    infrastructure/          # Concrete adapters implementing domain/interfaces
      db.py                  # engine, session factory
      models.py              # SQLAlchemy ORM models
      claude_client.py       # implements LLMClient
      mock_sms.py            # implements SMSProvider (dev)
      msg91_sms.py           # implements SMSProvider (prod)
      s3_storage.py          # implements ObjectStorage
      translator_impl.py     # implements Translator
      cache.py               # Redis
      queue.py               # RQ job queue

    workers/
      tasks.py               # background jobs: PPT render, PDF export, embedding

  migrations/                # Alembic
  scripts/
    seed_curriculum.py
    ingest_textbook.py       # chunk + embed textbook content
  tests/
  pyproject.toml
```

**The rule that keeps this clean:** dependencies point inward only. `api` knows `services`; `services` know `domain` and `repositories`; `domain` knows nothing about FastAPI, SQLAlchemy, Claude, or S3 — only its own interfaces. This is what makes the LLM vendor, SMS provider, and storage backend swappable without touching business logic.

---

## 2. API surface

### Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/otp/request` | Send OTP to phone |
| POST | `/auth/otp/verify` | Verify OTP, issue access token + refresh cookie |
| POST | `/auth/refresh` | Rotate refresh token, issue new access token |
| POST | `/auth/logout` | Revoke current session |
| GET | `/auth/me` | Current teacher + onboarding status |

### Onboarding & profile
| Method | Path | Purpose |
|---|---|---|
| POST | `/onboarding/complete` | Set name, school, subject/grade pairs |
| GET | `/profile` | Teacher profile |
| PATCH | `/profile` | Edit name / subjects / language preference |

### Reference & curriculum
| Method | Path | Purpose |
|---|---|---|
| GET | `/reference/grades` | Class 6–10 |
| GET | `/reference/subjects` | Subjects for the board |
| GET | `/schools/search?q=` | Typeahead school lookup |
| GET | `/curriculum/chapters?grade_id=&subject_id=` | Chapters for the selected class+subject |
| GET | `/curriculum/topics?chapter_id=` | Topics within a chapter |

### Chat / generation (the core loop)
| Method | Path | Purpose |
|---|---|---|
| POST | `/chat/sessions` | Start a session scoped to grade+subject+chapter |
| POST | `/chat/sessions/{id}/messages` | Send teacher message; **streams** response (SSE) |
| GET | `/chat/sessions/{id}` | Full conversation history |
| POST | `/chat/sessions/{id}/generate` | Trigger an artifact: `ppt` / `mindmap` / `quiz` / `activity` |
| GET | `/jobs/{job_id}` | Poll status of an async generation job |

### Kits
| Method | Path | Purpose |
|---|---|---|
| GET | `/kits?grade_id=&subject_id=` | Saved kits, filterable (powers My Kits) |
| GET | `/kits/{id}` | Single kit with all artifacts |
| GET | `/kits/{id}/download?format=pdf\|pptx` | Signed download URL |
| DELETE | `/kits/{id}` | Remove a kit |
| POST | `/kits/{id}/feedback` | Thumbs up/down + comment |

---

## 3. The generation pipeline (LessonKitService)

This is the heart of the product. Sequence for "How do I teach photosynthesis engagingly?":

1. **Resolve context** — grade, subject, chapter, topic from the session; teacher's `is_primary` subject and past preferences from their profile.
2. **Retrieve grounding** — embed the teacher's query, run a pgvector cosine similarity search against `textbook_content_chunks` filtered to the selected topic, take top-k chunks. This is what keeps generated content anchored to actual BSEB textbook material rather than the model's general knowledge.
3. **Plan** — a lightweight LLM call (or rule-based routing at first — don't over-engineer) decides which generators to invoke. A free-form "how do I teach this?" invokes ExplanationGen; an explicit quick-action button skips planning entirely and calls one generator directly.
4. **Generate** — the selected generator builds its prompt from `domain/prompts/`, injects retrieved chunks + grade level + language preference, calls `LLMClient`, and parses the structured response.
5. **Persist** — append to conversation history, create/update the lesson kit row, enqueue any heavy artifact rendering (PPT, PDF) as a background job.
6. **Stream back** — text responses stream token-by-token over SSE so the teacher sees output immediately on a slow connection rather than staring at a spinner.

**Sync vs async split:** text generation is synchronous and streamed. PPT rendering, PDF export, and embedding ingestion go to the RQ job queue and are polled via `/jobs/{id}` — they're too slow to block a request, and on a patchy rural connection a long-held HTTP request is a dropped request.

---

## 4. Language handling (Hindi/English)

Since you're using a translator rather than mixing languages, keep this in one place:

- `teachers.preferred_language` already exists in your schema — treat it as the single source of truth.
- **Generate directly in the teacher's language where possible.** Claude handles Hindi natively; prompting it to respond in Hindi produces better output than generating English and machine-translating, which tends to mangle pedagogical phrasing and subject terminology.
- Reserve the `Translator` interface for the cases where direct generation isn't enough — e.g. your textbook content is in Hindi but you want English-language internal search, or vice versa. Keeping it behind an interface means you can swap providers or drop it entirely without touching the generators.
- UI strings live in the frontend's i18n files, not the backend. The backend returns content, not chrome.

---

## 5. Phase 1 schema additions

Your Phase 0 schema covers auth, schools, teachers, and curriculum. The generation loop needs these new tables:

```sql
-- A conversation, scoped to a curriculum context
create table chat_sessions (
    id              uuid primary key default uuid_generate_v4(),
    teacher_id      uuid not null references teachers(id) on delete cascade,
    grade_id        uuid not null references grades(id),
    subject_id      uuid not null references subjects(id),
    chapter_id      uuid references curriculum_chapters(id),
    topic_id        uuid references curriculum_topics(id),
    title           text,                       -- auto-derived from first message
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_sessions_teacher on chat_sessions(teacher_id, updated_at desc);

create table chat_messages (
    id              uuid primary key default uuid_generate_v4(),
    session_id      uuid not null references chat_sessions(id) on delete cascade,
    role            text not null,              -- 'teacher' | 'assistant'
    content         text not null,
    retrieved_chunk_ids uuid[],                 -- provenance: what grounded this answer
    token_count     int,                        -- for cost tracking
    created_at      timestamptz not null default now()
);

create index idx_messages_session on chat_messages(session_id, created_at);

-- A saved lesson kit (what "My Kits" lists)
create table lesson_kits (
    id              uuid primary key default uuid_generate_v4(),
    teacher_id      uuid not null references teachers(id) on delete cascade,
    session_id      uuid references chat_sessions(id) on delete set null,
    grade_id        uuid not null references grades(id),
    subject_id      uuid not null references subjects(id),
    topic_id        uuid references curriculum_topics(id),
    title           text not null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index idx_kits_teacher on lesson_kits(teacher_id, updated_at desc);

-- One row per generated artifact within a kit
create table kit_artifacts (
    id              uuid primary key default uuid_generate_v4(),
    kit_id          uuid not null references lesson_kits(id) on delete cascade,
    artifact_type   text not null,              -- explanation | ppt | mindmap | quiz | activity
    content_json    jsonb,                      -- structured content (quiz questions, activity steps)
    file_url        text,                       -- S3 url for ppt/pdf/mindmap image
    created_at      timestamptz not null default now()
);

create index idx_artifacts_kit on kit_artifacts(kit_id);

-- Async job tracking for slow renders
create table generation_jobs (
    id              uuid primary key default uuid_generate_v4(),
    teacher_id      uuid not null references teachers(id) on delete cascade,
    kit_id          uuid references lesson_kits(id) on delete cascade,
    job_type        text not null,              -- ppt_render | pdf_export | embed_ingest
    status          text not null default 'queued',  -- queued|running|done|failed
    error_message   text,
    output_url      text,
    created_at      timestamptz not null default now(),
    completed_at    timestamptz
);

-- Teacher feedback — your most valuable data for improving prompts
create table kit_feedback (
    id              uuid primary key default uuid_generate_v4(),
    kit_id          uuid not null references lesson_kits(id) on delete cascade,
    teacher_id      uuid not null references teachers(id) on delete cascade,
    rating          smallint,                   -- 1 = up, -1 = down
    comment         text,
    created_at      timestamptz not null default now(),
    unique (kit_id, teacher_id)
);
```

---

## 6. Cross-cutting concerns

- **Auth**: `get_current_teacher()` dependency on every protected route. Teachers can only read/write their own sessions and kits — enforce ownership in the repository layer, not just the router, so it can't be forgotten on a new endpoint.
- **Caching (Redis)**: cache generation results keyed by `(topic_id, artifact_type, normalized_query)`. Many teachers across Bihar will ask near-identical questions about the same Class 8 chapters — this is your single biggest lever on LLM cost.
- **Rate limiting**: per-teacher limits on `/chat` (LLM cost control) and per-phone limits on `/auth/otp/request` (abuse control).
- **Cost tracking**: log `token_count` per message. At state scale you need to know your per-teacher monthly cost before it surprises you.
- **Error handling**: a global exception handler returning consistent JSON error shapes; never leak stack traces to the client.
- **Observability**: structured logging with a request ID; log every LLM call's latency, token count, and cache-hit status. When a teacher says "it gave me a bad answer," you need to reconstruct what happened.
- **Config**: everything in `config.py` via Pydantic Settings, read from env. No hardcoded URLs, keys, or model names.

---

## 7. Build order

1. Wire `main.py`, `config.py`, `db.py`, `dependencies.py` — the skeleton.
2. Repositories + SQLAlchemy models for existing Phase 0 tables.
3. Auth router + service (already planned).
4. Onboarding + reference routers.
5. Phase 1 migration for the tables above.
6. `LLMClient` interface + Claude adapter, plus retriever against pgvector.
7. `ExplanationGen` and the `/chat` loop, streamed — the thinnest complete generation path.
8. Only then: quiz, activity, PPT, mindmap generators and the job queue.

Steps 1–7 get you a working product. Everything after is enrichment.



-- =====================================================================
-- Medha — Phase 0 schema
-- Scope: auth + teacher/school onboarding + curriculum ingestion
-- (Lesson kits, generation jobs, feedback are Phase 1+ — not here yet)
-- Postgres 15+, pgvector extension required for embeddings
-- =====================================================================

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ---------------------------------------------------------------------
-- 1. Organizational hierarchy: district -> block -> school
-- ---------------------------------------------------------------------

create table districts (
    id              uuid primary key default uuid_generate_v4(),
    name            text not null,
    state           text not null default 'Bihar',
    created_at      timestamptz not null default now(),
    unique (name, state)
);

create table blocks (
    id              uuid primary key default uuid_generate_v4(),
    district_id     uuid not null references districts(id) on delete cascade,
    name            text not null,
    created_at      timestamptz not null default now(),
    unique (district_id, name)
);

create table schools (
    id                      uuid primary key default uuid_generate_v4(),
    udise_code              text unique,            -- official govt school code, nullable until verified
    name                    text not null,
    district_id             uuid not null references districts(id),
    block_id                uuid references blocks(id),
    medium_of_instruction   text not null default 'Hindi',   -- Hindi / Urdu / English
    school_type             text,                    -- primary / middle / secondary / senior_secondary
    created_at              timestamptz not null default now()
);

create index idx_schools_district on schools(district_id);

-- ---------------------------------------------------------------------
-- 2. Teachers & auth
--    Phone-first auth (OTP) is the realistic path for this user base;
--    email/password kept optional for admin/district accounts.
-- ---------------------------------------------------------------------

create table teachers (
    id                      uuid primary key default uuid_generate_v4(),
    school_id               uuid not null references schools(id),
    full_name               text not null,
    phone_number            text not null unique,
    email                   text unique,
    password_hash           text,                    -- nullable: OTP-only accounts won't have one
    preferred_language      text not null default 'hi-BiharBoli', -- BCP-47-ish tag for UI/voice locale
    role                    text not null default 'teacher',       -- teacher / school_admin / district_admin
    is_active               boolean not null default true,
    onboarded_at            timestamptz,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create index idx_teachers_school on teachers(school_id);
create index idx_teachers_phone on teachers(phone_number);

-- OTP verification for phone login
create table otp_verifications (
    id              uuid primary key default uuid_generate_v4(),
    phone_number    text not null,
    otp_hash        text not null,
    purpose         text not null default 'login',    -- login / phone_change
    attempts        int not null default 0,
    expires_at      timestamptz not null,
    verified_at     timestamptz,
    created_at      timestamptz not null default now()
);

create index idx_otp_phone on otp_verifications(phone_number, expires_at);

-- Active sessions / refresh tokens
create table auth_sessions (
    id              uuid primary key default uuid_generate_v4(),
    teacher_id      uuid not null references teachers(id) on delete cascade,
    refresh_token_hash  text not null,
    device_info     text,                              -- user-agent / app version, for support debugging
    issued_at       timestamptz not null default now(),
    expires_at      timestamptz not null,
    revoked_at      timestamptz
);

create index idx_sessions_teacher on auth_sessions(teacher_id);

-- ---------------------------------------------------------------------
-- 3. Curriculum reference data
--    grades and subjects are lookup tables; chapters/topics carry the
--    actual BSEB syllabus structure; content_chunks hold the grounding
--    text + embeddings used for retrieval during generation (Phase 1+
--    consumes this, but ingestion belongs in Phase 0).
-- ---------------------------------------------------------------------

create table grades (
    id              uuid primary key default uuid_generate_v4(),
    label           text not null unique,             -- 'Class 6', 'Class 7', ...
    numeric_level   int not null unique                -- 6, 7, ... for sorting/filtering
);

create table subjects (
    id              uuid primary key default uuid_generate_v4(),
    name            text not null,                     -- 'Science', 'Social Science', 'Mathematics'
    board           text not null default 'BSEB',
    unique (name, board)
);

-- What each teacher teaches: many-to-many across subject + grade
-- (placed here, not with the teachers table above, because it depends
-- on subjects/grades which are defined in this section)
create table teacher_subjects (
    id              uuid primary key default uuid_generate_v4(),
    teacher_id      uuid not null references teachers(id) on delete cascade,
    subject_id      uuid not null references subjects(id),
    grade_id        uuid not null references grades(id),
    is_primary      boolean not null default false,   -- teacher's main subject vs additional
    created_at      timestamptz not null default now(),
    unique (teacher_id, subject_id, grade_id)
);

create table curriculum_chapters (
    id              uuid primary key default uuid_generate_v4(),
    subject_id      uuid not null references subjects(id),
    grade_id        uuid not null references grades(id),
    chapter_number  int not null,
    title           text not null,
    created_at      timestamptz not null default now(),
    unique (subject_id, grade_id, chapter_number)
);

create table curriculum_topics (
    id              uuid primary key default uuid_generate_v4(),
    chapter_id      uuid not null references curriculum_chapters(id) on delete cascade,
    title           text not null,
    description     text,
    sequence_order  int not null default 0,
    created_at      timestamptz not null default now()
);

create index idx_topics_chapter on curriculum_topics(chapter_id);

-- Textbook passages, chunked for RAG grounding. One topic can have
-- several chunks (a page, a paragraph, a diagram caption, etc).
create table textbook_content_chunks (
    id              uuid primary key default uuid_generate_v4(),
    topic_id        uuid not null references curriculum_topics(id) on delete cascade,
    content_text    text not null,
    source_page     int,
    embedding       vector(1024),                      -- Phase 1: Voyage voyage-3 (see docs/phase-1/04)
    created_at      timestamptz not null default now()
);

create index idx_chunks_topic on textbook_content_chunks(topic_id);
-- ANN index for retrieval — build after initial bulk ingestion, not before
-- create index idx_chunks_embedding on textbook_content_chunks
--     using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------
-- 4. Housekeeping
-- ---------------------------------------------------------------------

create or replace function set_updated_at() returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_teachers_updated_at
    before update on teachers
    for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Phase 1: chat sessions + saved teaching modules
--    (created by alembic migration 0003_phase1; kit -> module rename,
--     no generation_jobs -- async jobs are Phase 2. See docs/phase-1/.)
--    updated_at is bumped in the service layer, not by a trigger.
-- ---------------------------------------------------------------------

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

create index idx_chat_sessions_teacher on chat_sessions(teacher_id, updated_at desc);

create table chat_messages (
    id                  uuid primary key default uuid_generate_v4(),
    session_id          uuid not null references chat_sessions(id) on delete cascade,
    role                text not null,          -- 'teacher' | 'assistant'
    content             text not null,
    retrieved_chunk_ids uuid[],                 -- provenance: what grounded this answer
    token_count         int,                    -- output tokens, for cost tracking
    created_at          timestamptz not null default now()
);

create index idx_messages_session on chat_messages(session_id, created_at);

-- A saved teaching module (what "My Modules" lists)
create table modules (
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

create index idx_modules_teacher on modules(teacher_id, updated_at desc);

-- One row per generated artifact within a module
create table module_artifacts (
    id              uuid primary key default uuid_generate_v4(),
    module_id       uuid not null references modules(id) on delete cascade,
    artifact_type   text not null,              -- explanation | quiz | activity
    content_json    jsonb,                      -- structured content
    file_url        text,                       -- unused in Phase 1 (Phase 2: ppt/pdf)
    created_at      timestamptz not null default now()
);

create index idx_artifacts_module on module_artifacts(module_id);

-- Teacher feedback -- the core loop for improving prompts
create table module_feedback (
    id              uuid primary key default uuid_generate_v4(),
    module_id       uuid not null references modules(id) on delete cascade,
    teacher_id      uuid not null references teachers(id) on delete cascade,
    rating          smallint,                   -- 1 = up, -1 = down
    comment         text,
    created_at      timestamptz not null default now(),
    unique (module_id, teacher_id)
);
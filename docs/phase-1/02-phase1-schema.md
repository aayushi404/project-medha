# 02 — Phase 1 Schema (chat + modules)

**`../phase-1.md` §7 step 5** — "Phase 1 migration for the tables above."

Adds the five tables the generation loop needs, using **module** naming
(doc 00 §1.1) and dropping `generation_jobs` (async jobs are Phase 2).

## Purpose

Persist conversations (`chat_sessions`, `chat_messages`), the saved outputs
(`modules`, `module_artifacts`), and teacher ratings (`module_feedback`).

## Files

| File | Change |
|---|---|
| `backend/src/backend/db/models/chat.py` | **new** — `ChatSession`, `ChatMessage` |
| `backend/src/backend/db/models/module.py` | **new** — `Module`, `ModuleArtifact`, `ModuleFeedback` |
| `backend/src/backend/db/models/__init__.py` | export the 5 new models |
| `backend/alembic/versions/0003_phase1_chat_and_modules.py` | **new** migration |
| `backend/scripts/seed_curriculum.py` | **new** — extra chapters/topics (see §4) |
| `ddl.sql` (repo root) | append the new tables for reference parity |

## Models

Follow the existing style in `db/models/curriculum.py`: `UUID(as_uuid=True)`
PKs with `server_default=text("uuid_generate_v4()")`, `datetime` mapped to
`TIMESTAMP(timezone=True)` by `db/base.py`, `server_default=text("now()")`.

### `db/models/chat.py`

```python
class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = (Index("idx_sessions_teacher", "teacher_id", text("updated_at desc")),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
        server_default=text("uuid_generate_v4()"))
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    grade_id:   Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_chapters.id"))
    topic_id:   Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_topics.id"))
    title: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (Index("idx_messages_session", "session_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
        server_default=text("uuid_generate_v4()"))
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"))
    role: Mapped[str]                       # 'teacher' | 'assistant'
    content: Mapped[str]
    retrieved_chunk_ids: Mapped[list[uuid.UUID] | None] = mapped_column(
        ARRAY(UUID(as_uuid=True)))
    token_count: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
```

### `db/models/module.py`

```python
class Module(Base):
    __tablename__ = "modules"
    __table_args__ = (Index("idx_modules_teacher", "teacher_id", text("updated_at desc")),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
        server_default=text("uuid_generate_v4()"))
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="SET NULL"))
    grade_id:   Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    topic_id:   Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_topics.id"))
    title: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class ModuleArtifact(Base):
    __tablename__ = "module_artifacts"
    __table_args__ = (Index("idx_artifacts_module", "module_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
        server_default=text("uuid_generate_v4()"))
    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"))
    artifact_type: Mapped[str]             # 'explanation' | 'quiz' | 'activity'
    content_json: Mapped[dict | None] = mapped_column(JSONB)
    file_url: Mapped[str | None]           # unused in Phase 1 (Phase 2: ppt/pdf)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class ModuleFeedback(Base):
    __tablename__ = "module_feedback"
    __table_args__ = (UniqueConstraint("module_id", "teacher_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
        server_default=text("uuid_generate_v4()"))
    module_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"))
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    rating: Mapped[int | None]             # 1 = up, -1 = down (smallint)
    comment: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
```

Imports: `from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB`.
`rating` as `smallint`: `mapped_column(SmallInteger)`.

## Migration — `0003_phase1_chat_and_modules.py`

- `down_revision = "3e15203d0344"` (the current head — the "teachers.school_id
  nullable" migration).
- `upgrade()` creates the five tables + indexes above. Match the hand-written
  style of `43cb…` (explicit `sa.Column`, `server_default=sa.text(...)`).
- `retrieved_chunk_ids`: `sa.Column("retrieved_chunk_ids",
  postgresql.ARRAY(sa.UUID()), nullable=True)`.
- `content_json`: `postgresql.JSONB`.
- **Embedding dimension:** doc 04 selects Voyage `voyage-3` (1024-dim), but the
  existing `textbook_content_chunks.embedding` column is `Vector(1536)`. This
  migration also does:
  ```python
  op.execute("ALTER TABLE textbook_content_chunks ALTER COLUMN embedding TYPE vector(1024)")
  ```
  and doc 04 updates the model's `Vector(1536)` → `Vector(settings.embedding_dim)`
  (or a literal `1024`). If the team instead picks OpenAI `text-embedding-3-small`
  (1536), **skip this ALTER** and set `EMBEDDING_DIM=1536`. The seed chunk has
  no embedding yet, so no data migration is needed either way.
- `downgrade()` drops the five tables; the embedding `ALTER` back to
  `vector(1536)` is optional (note it).

## 4. Seed additions — `scripts/seed_curriculum.py`

`seed_phase0.py` only seeds one chapter/topic. The dashboard's Chapter/Topic
pickers need more than one row to be worth showing. New idempotent script
(reuse `get_or_create` — copy the helper or import it) adding ~4–6 rows, e.g.:

| Grade | Subject | Chapter | Topic(s) |
|---|---|---|---|
| Class 8 | Science | Force and Pressure | Contact & non-contact forces; Pressure in fluids |
| Class 8 | Science | Friction | Friction: factors & effects |
| Class 7 | Science | Nutrition in Plants | Autotrophic nutrition; Parasitic plants |
| Class 7 | Science | Heat | Conduction, convection, radiation |
| Class 6 | Social Science | Diversity | Diversity in India |

No content chunks required for these (retrieval degrades gracefully, doc 04).
Keep `seed_phase0.py` as-is; run both.

## Key decisions

- **No `generation_jobs`** — nothing async in Phase 1 (doc 00 §1.3).
- **`file_url` column kept but unused** — avoids a second migration when Phase 2
  adds PPT/PDF.
- **`modules.session_id` is `SET NULL` on delete** — deleting a chat shouldn't
  delete the saved module; matches `../phase-1.md`.
- **No SQLAlchemy `relationship()`s** — the codebase uses explicit
  `db.query(...).join(...)`; stay consistent (see `reference/router.py`).
- **`updated_at` bumps are done in the service** (`row.updated_at =
  func.now()` on write) — no DB trigger, matching the rest of the schema.

## How to test

1. `docker compose up -d postgres`
2. `cd backend && uv run alembic upgrade head` → succeeds; `alembic current`
   shows `0003…`.
3. `uv run python scripts/seed_phase0.py && uv run python scripts/seed_curriculum.py`
   → idempotent, safe to re-run.
4. In Adminer (`localhost:8080`) confirm the five tables + indexes exist and
   `\d textbook_content_chunks` shows `vector(1024)` (if the ALTER path was
   taken).
5. `uv run alembic downgrade -1` then `upgrade head` round-trips cleanly.

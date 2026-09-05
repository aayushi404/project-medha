import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    SmallInteger,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base

# Keep in sync with the CHECK constraints below and with the Pydantic
# CONTENT_MODELS / PARAM_MODELS registries (backend.generation.schemas).
GENERATION_TYPES = (
    "lesson_plan",
    "presentation",
    "question_paper",
    "notes",
    "quiz",
    "worksheet",
    "notice",
)
GENERATION_STATUSES = ("queued", "running", "completed", "failed")
GENERATION_VISIBILITIES = ("private", "school", "library")
EXPORT_FORMATS = ("pdf", "pptx", "docx")


def _in_list(column: str, values: tuple[str, ...]) -> str:
    joined = ",".join(f"'{v}'" for v in values)
    return f"{column} IN ({joined})"


class Generation(Base):
    """Any AI-generated teaching artifact -- one row per lesson plan, deck,
    question paper, notes doc, or quiz. Teacher-owned, or unowned + curated
    (`visibility='library'`). Content shape varies by `type` and is validated
    in Pydantic, not the DB. See docs/medha-v2-schema.md."""

    __tablename__ = "generations"
    __table_args__ = (
        # History "All" tab
        Index("idx_gen_teacher_recent", "teacher_id", text("created_at DESC")),
        # History type tabs
        Index("idx_gen_teacher_type", "teacher_id", "type", text("created_at DESC")),
        # Curriculum browse + "earlier for this chapter"
        Index("idx_gen_curriculum", "grade_id", "subject_id", "chapter_id"),
        # Cache probe before an LLM call
        Index("idx_gen_cache_key", "cache_key"),
        # Published library content, per type -- partial, stays tiny as the table grows
        Index(
            "idx_gen_library",
            "type",
            "grade_id",
            "subject_id",
            postgresql_where=text("visibility = 'library' AND published"),
        ),
        # Favourites view -- partial
        Index(
            "idx_gen_favorites",
            "teacher_id",
            text("created_at DESC"),
            postgresql_where=text("is_favorite"),
        ),
        CheckConstraint(_in_list("type", GENERATION_TYPES), name="chk_gen_type"),
        CheckConstraint(_in_list("status", GENERATION_STATUSES), name="chk_gen_status"),
        CheckConstraint(
            _in_list("visibility", GENERATION_VISIBILITIES), name="chk_gen_visibility"
        ),
        # Library content is unowned; everything else must have an owner.
        CheckConstraint(
            "visibility = 'library' OR teacher_id IS NOT NULL", name="chk_gen_owner"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )

    # --- ownership & visibility ---
    # Null only for curated library content.
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    visibility: Mapped[str] = mapped_column(server_default=text("'private'"))
    published: Mapped[bool] = mapped_column(server_default=text("true"))
    # Stable natural key for curated seeds (idempotent seeding). Null for user content.
    slug: Mapped[str | None] = mapped_column(unique=True)

    # --- what it is ---
    type: Mapped[str]
    title: Mapped[str]
    description: Mapped[str | None]
    language: Mapped[str] = mapped_column(server_default=text("'hi'"))

    # --- curriculum scoping (same shape as chat_sessions) ---
    grade_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("grades.id")
    )
    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id")
    )
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_chapters.id")
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_topics.id")
    )
    tags: Mapped[list | None] = mapped_column(JSONB)

    # --- provenance: how this came to exist ---
    # 'quick_action' | 'chat' | 'curated' | 'regenerate' | 'cache'
    source: Mapped[str] = mapped_column(server_default=text("'quick_action'"))
    # Set when generated inside a conversation. SET NULL so deleting a chat
    # never destroys the artifact it produced.
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="SET NULL")
    )
    # Regeneration / cache-copy lineage.
    parent_generation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("generations.id", ondelete="SET NULL")
    )
    # Optional lightweight grouping ("everything for Chapter 3").
    module_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("modules.id", ondelete="SET NULL")
    )

    # --- the content ---
    # Form inputs: difficulty, question count, duration, marks scheme, etc.
    # Kept apart from the output so a regeneration can reuse them verbatim.
    input_params: Mapped[dict | None] = mapped_column(JSONB)
    # The generated body. Shape varies by `type`; validated in Pydantic.
    content_json: Mapped[dict | None] = mapped_column(JSONB)

    # --- generation lifecycle ---
    status: Mapped[str] = mapped_column(server_default=text("'queued'"))
    error_message: Mapped[str | None]
    completed_at: Mapped[datetime | None]

    # --- observability & grounding ---
    retrieved_chunk_ids: Mapped[list[uuid.UUID] | None] = mapped_column(
        ARRAY(UUID(as_uuid=True))
    )
    model: Mapped[str | None]
    prompt_version: Mapped[str | None]
    tokens_in: Mapped[int | None]
    tokens_out: Mapped[int | None]
    generation_ms: Mapped[int | None]
    # sha256(type | chapter_id | normalized input_params | language | prompt_version)
    # -- lets a repeat request serve an existing row instead of re-billing an LLM call.
    cache_key: Mapped[str | None]

    # --- user state ---
    is_favorite: Mapped[bool] = mapped_column(server_default=text("false"))

    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class GenerationExport(Base):
    """A rendered file for a generation. Separate table: one artifact can have
    several formats (a deck wants both .pptx and .pdf) and each is produced
    independently. `file_key` is an object-storage key, never a signed URL --
    sign on read. Rows are written only once a real bucket is configured;
    until then .pptx renders on demand in-memory (backend.ppt)."""

    __tablename__ = "generation_exports"
    __table_args__ = (
        UniqueConstraint("generation_id", "format"),
        Index("idx_exports_generation", "generation_id"),
        CheckConstraint(_in_list("format", EXPORT_FORMATS), name="chk_export_format"),
        CheckConstraint(
            _in_list("status", GENERATION_STATUSES), name="chk_export_status"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    generation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("generations.id", ondelete="CASCADE")
    )
    format: Mapped[str]
    file_key: Mapped[str | None]
    file_size_bytes: Mapped[int | None]
    status: Mapped[str] = mapped_column(server_default=text("'queued'"))
    error_message: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    completed_at: Mapped[datetime | None]


class GenerationFeedback(Base):
    """Replaces module_feedback -- feedback on one artifact, not a bundle."""

    __tablename__ = "generation_feedback"
    __table_args__ = (
        UniqueConstraint("generation_id", "teacher_id"),
        Index("idx_gen_feedback_generation", "generation_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    generation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("generations.id", ondelete="CASCADE")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    rating: Mapped[int | None] = mapped_column(SmallInteger)  # 1 = up, -1 = down
    comment: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

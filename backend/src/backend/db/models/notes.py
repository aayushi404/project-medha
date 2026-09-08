import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class ChapterNote(Base):
    """Teacher/principal-curated revision notes for one chapter -- a short
    summary, key points, and important terms. Not AI-generated (yet); a
    real, lightweight content model, same shape as `LibraryItem`.
    `school_id` null = visible to every school (a state-wide note); set =
    only that school's own version. One note per (chapter, school) -- a
    later save overwrites, no versioning."""

    __tablename__ = "chapter_notes"
    __table_args__ = (UniqueConstraint("chapter_id", "school_id", name="uq_chapter_notes_chapter_school"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    chapter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_chapters.id", ondelete="CASCADE")
    )
    school_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    summary: Mapped[str]
    key_points: Mapped[list | None] = mapped_column(JSONB)
    important_terms: Mapped[list | None] = mapped_column(JSONB)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

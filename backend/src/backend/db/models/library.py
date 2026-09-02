import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class LibraryPresentation(Base):
    """A curated, curriculum-keyed slide deck.

    Stored as the same slide spec the LLM produces (`spec_json`) and rendered by
    the same `backend.ppt.render_pptx` -- no file storage needed. `file_key` is
    reserved for a hand-authored .pptx in object storage (Tier 2, unused today).
    """

    __tablename__ = "library_presentations"
    __table_args__ = (
        Index("idx_library_pres_grade_subject", "grade_id", "subject_id"),
        Index("idx_library_pres_chapter", "chapter_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    # stable natural key so the seed script is idempotent
    slug: Mapped[str] = mapped_column(unique=True)
    title: Mapped[str]
    description: Mapped[str | None]
    language: Mapped[str] = mapped_column(server_default="hi")  # 'hi' | 'en'

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

    tags: Mapped[list | None] = mapped_column(JSONB)  # free-text topic tags
    spec_json: Mapped[dict | None] = mapped_column(JSONB)
    file_key: Mapped[str | None]  # reserved: object-storage key (Tier 2)
    slide_count: Mapped[int | None]
    source: Mapped[str] = mapped_column(server_default="curated")  # curated | generated
    published: Mapped[bool] = mapped_column(server_default=text("true"))

    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

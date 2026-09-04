import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class PracticeQuestion(Base):
    """One teacher/principal-curated practice question for a chapter --
    same `type`/`options`/`answer`/`difficulty` shape as the `QuizContent`
    artifact in `modules/`, kept as a separate, simple table rather than
    reusing Modules: a Module is private to the teacher who generated it,
    while practice questions are meant to be published to every student in
    the chapter's grade, so the two need different visibility rules."""

    __tablename__ = "practice_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    chapter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_chapters.id", ondelete="CASCADE")
    )
    school_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    question: Mapped[str]
    type: Mapped[str] = mapped_column(server_default="mcq")  # mcq | short | truefalse
    options: Mapped[list | None] = mapped_column(JSONB)
    answer: Mapped[str]
    difficulty: Mapped[str] = mapped_column(server_default="medium")  # easy | medium | hard
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

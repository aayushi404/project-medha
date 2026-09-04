import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class ReportCardMark(Base):
    """One subject's score for one student in one term. `term` is a free
    string ("Term 1", "Annual", ...) rather than an enum -- schools don't
    agree on term names, and this is deliberately lightweight (no
    grade-boundary/rank computation, no multi-exam-per-term breakdown)."""

    __tablename__ = "report_card_marks"
    __table_args__ = (UniqueConstraint("student_id", "subject_id", "term", name="uq_report_card_entry"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    term: Mapped[str]
    marks_obtained: Mapped[float]
    max_marks: Mapped[float] = mapped_column(server_default=text("100"))
    remarks: Mapped[str | None]
    entered_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

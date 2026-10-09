import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class WorkUpdate(Base):
    """A teacher's end-of-day report for one (grade, subject, chapter). The
    principal's feedback/flag lives on the same row; student reactions are in
    `WorkUpdateReaction`."""

    __tablename__ = "work_updates"
    __table_args__ = (
        Index("idx_work_updates_school", "school_id", text("created_at DESC")),
        Index("idx_work_updates_teacher", "teacher_id", text("created_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    grade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    work_date: Mapped[date_]
    grade_label: Mapped[str]
    subject_name: Mapped[str]
    chapter_title: Mapped[str]
    activities: Mapped[list] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    topics: Mapped[list] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    other_topics: Mapped[str | None]
    activity_detail: Mapped[str | None]
    homework: Mapped[list] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    ai_usefulness: Mapped[str]
    note: Mapped[str]
    principal_note: Mapped[str | None]
    principal_badge: Mapped[str | None]
    flagged: Mapped[bool] = mapped_column(server_default=text("false"))
    feedback_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL")
    )
    feedback_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class WorkUpdateReaction(Base):
    """A student's approve / disapprove of a work update ("yes, this was
    actually taught"). Names are shown to the teacher and principal."""

    __tablename__ = "work_update_reactions"
    __table_args__ = (
        UniqueConstraint("work_update_id", "student_id", name="uq_work_update_reaction_student"),
        CheckConstraint("value IN ('approve','disapprove')", name="chk_work_update_reaction_value"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    work_update_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_updates.id", ondelete="CASCADE")
    )
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"))
    value: Mapped[str]
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

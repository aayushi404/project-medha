import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class TimetableEntry(Base):
    """One cell in a grade's weekly timetable grid. `day_of_week` is 0=Monday
    .. 5=Saturday (schools here don't run Sunday classes, but nothing stops
    a 6). `period_number` is 1-indexed and school-defined (no separate
    "periods" table -- the grid is just (day, period) -> subject/teacher).
    Principal-authored (see `timetable/service.py`); teachers and students
    only read."""

    __tablename__ = "timetable_entries"
    __table_args__ = (
        UniqueConstraint("grade_id", "day_of_week", "period_number", name="uq_timetable_slot"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    grade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    day_of_week: Mapped[int]
    period_number: Mapped[int]
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

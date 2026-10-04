import uuid
from datetime import datetime

from pydantic import BaseModel

from backend.approvals.schemas import ApprovalResult, RejectIn

__all__ = [
    "TeacherStudentStats",
    "PendingStudent",
    "StudentRosterItem",
    "TeacherSectionOut",
    "RejectIn",
    "ApprovalResult",
]


class TeacherStudentStats(BaseModel):
    students: int  # approved at this school
    pending_students: int


class PendingStudent(BaseModel):
    id: uuid.UUID
    full_name: str
    class_section_id: uuid.UUID
    grade_id: uuid.UUID
    grade_label: str
    section: str
    roll_number: int | None
    # The number the student will log in with. Lists carry no email: it's shown
    # on the full profile only.
    login_phone: str | None
    applied_at: datetime


class StudentRosterItem(BaseModel):
    id: uuid.UUID
    full_name: str
    class_section_id: uuid.UUID
    grade_id: uuid.UUID
    grade_label: str
    section: str
    roll_number: int | None
    login_phone: str | None
    approved_at: datetime | None
    photo_url: str | None = None


class TeacherSectionSubjectOut(BaseModel):
    id: uuid.UUID
    name: str


class TeacherSectionOut(BaseModel):
    """A class_section the calling teacher can act on -- via a
    `teaching_assignments` row or being its class_teacher. Feeds the class
    picker on attendance/homework/report-card/OMR/notifications pages.
    `subjects` is specifically the teacher's `teaching_assignments` for this
    section -- needed (with ids, not just names) for the subject picker on
    homework/report-card, which require an exact assignment match."""

    id: uuid.UUID
    grade_id: uuid.UUID
    grade_label: str
    section: str
    academic_year_label: str
    is_class_teacher: bool
    subjects: list[TeacherSectionSubjectOut]
    # approved and pending students in this class (current year)
    students: int = 0
    pending_students: int = 0

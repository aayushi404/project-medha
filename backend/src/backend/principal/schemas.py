import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from backend.approvals.schemas import ApprovalResult, RejectIn
from backend.teacher.schemas import StudentRosterItem

__all__ = [
    "PrincipalStats",
    "PendingTeacher",
    "TeacherRosterItem",
    "StudentRosterItem",
    "ClassSectionSummary",
    "RosterStudentItem",
    "StudentProfile",
    "TeachingAssignmentIn",
    "TeachingAssignmentOut",
    "AcademicYearCreateIn",
    "AcademicYearOut",
    "ClassSectionCreateIn",
    "ClassSectionUpdateIn",
    "SubjectTeacherIn",
    "ClassAttendanceSummary",
    "SchoolAttendanceSummaryOut",
    "RejectIn",
    "ApprovalResult",
]


class PrincipalStats(BaseModel):
    teachers: int  # approved at this school
    pending_teachers: int
    students: int  # approved at this school
    pending_students: int


class PendingTeacher(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    mobile_number: str | None
    employee_code: str | None
    years_of_experience: int | None
    qualification: str | None
    applied_at: datetime


class TeacherRosterItem(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    mobile_number: str | None
    employee_code: str | None
    years_of_experience: int | None
    approved_at: datetime | None
    photo_url: str | None = None
    sections_taught: list[str] = []  # e.g. ["Science - Class 8 · A", ...]
    # Assignment-drawer display fields (see principal/service.py::list_teachers)
    primary_subject_name: str | None = None
    classes_count: int = 0
    class_teacher_of_section_id: uuid.UUID | None = None
    class_teacher_of_label: str | None = None  # e.g. "Class 7 · B"


class TeacherProfile(BaseModel):
    """The full detail behind one row of `TeacherRosterItem` -- the
    principal-facing /principal/teachers/{id} page."""

    id: uuid.UUID
    full_name: str
    email: str
    mobile_number: str | None
    employee_code: str | None
    years_of_experience: int | None
    qualification: str | None
    approval_status: str
    approved_at: datetime | None
    photo_url: str | None
    sections_taught: list[str]


class ClassSectionSummary(BaseModel):
    id: uuid.UUID
    grade_label: str
    section: str
    academic_year_label: str
    student_count: int
    class_teacher_id: uuid.UUID | None
    class_teacher_name: str | None


class RosterStudentItem(BaseModel):
    id: uuid.UUID
    roll_number: int | None
    full_name: str
    guardian_name: str | None
    photo_url: str | None = None


class StudentProfile(BaseModel):
    id: uuid.UUID
    full_name: str
    admission_number: str | None
    status: str
    photo_url: str | None
    grade_label: str | None
    section: str | None
    roll_number: int | None
    academic_year_label: str | None
    class_teacher_name: str | None
    guardian_name: str | None
    guardian_relation: str | None
    guardian_phone: str | None


class TeachingAssignmentIn(BaseModel):
    teacher_id: uuid.UUID
    class_section_id: uuid.UUID
    subject_id: uuid.UUID


class TeachingAssignmentOut(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    teacher_name: str
    class_section_id: uuid.UUID
    grade_label: str
    section: str
    subject_id: uuid.UUID
    subject_name: str


class AcademicYearCreateIn(BaseModel):
    label: str = Field(min_length=1, max_length=20)  # e.g. "2026-27"
    starts_on: date
    ends_on: date
    set_current: bool = True

    @model_validator(mode="after")
    def _dates_ordered(self) -> "AcademicYearCreateIn":
        if self.starts_on >= self.ends_on:
            raise ValueError("starts_on must be before ends_on")
        return self


class AcademicYearOut(BaseModel):
    id: uuid.UUID
    label: str
    starts_on: date
    ends_on: date
    is_current: bool


class ClassSectionCreateIn(BaseModel):
    grade_id: uuid.UUID
    section: str = Field(default="A", min_length=1, max_length=5)
    # Which academic year to create this section under. None means "the
    # school's current year" -- the pre-existing behaviour, kept as the
    # default so older callers (and the always-current registration flow)
    # don't need to change.
    academic_year_id: uuid.UUID | None = None


class ClassSectionUpdateIn(BaseModel):
    class_teacher_id: uuid.UUID | None = None


class SubjectTeacherIn(BaseModel):
    teacher_id: uuid.UUID | None = None  # None unassigns the subject


class ClassAttendanceSummary(BaseModel):
    class_section_id: uuid.UUID
    grade_label: str
    section: str
    class_teacher_name: str | None
    total_students: int
    present_count: int
    absent_count: int
    unmarked_count: int
    percentage: float | None  # None when total_students == 0


class SchoolAttendanceSummaryOut(BaseModel):
    date: date
    total_students: int
    present_count: int
    absent_count: int
    unmarked_count: int
    percentage: float | None
    classes: list[ClassAttendanceSummary]

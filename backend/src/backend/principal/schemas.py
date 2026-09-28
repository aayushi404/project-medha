import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

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
    "StudentImportRowIn",
    "StudentImportIn",
    "StudentImportRowResult",
    "StudentImportOut",
    "RejectIn",
    "ApprovalResult",
]

# Upper bound on one upload. A large Bihar government school is ~1,500
# students; anything bigger is almost certainly the wrong file.
MAX_IMPORT_ROWS = 2000


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


class ClassSectionSummary(BaseModel):
    id: uuid.UUID
    grade_label: str
    section: str
    student_count: int
    class_teacher_name: str | None


class RosterStudentItem(BaseModel):
    id: uuid.UUID
    roll_number: int | None
    full_name: str
    guardian_name: str | None


class StudentProfile(BaseModel):
    id: uuid.UUID
    full_name: str
    admission_number: str | None
    status: str
    grade_label: str | None
    section: str | None
    roll_number: int | None
    academic_year_label: str | None
    class_teacher_name: str | None
    guardian_name: str | None
    guardian_relation: str | None
    guardian_phone: str | None


class StudentImportRowIn(BaseModel):
    """One CSV row, as the browser parsed it. Fields are deliberately loose
    strings: each row is validated in the service so one bad row is reported
    back against its line number instead of failing the whole upload with a
    422. The max lengths only bound the payload size."""

    line: int = Field(ge=1)  # line number in the uploaded file, for messages
    full_name: str | None = Field(default=None, max_length=300)
    grade: str | None = Field(default=None, max_length=50)
    roll_number: str | None = Field(default=None, max_length=50)
    guardian_name: str | None = Field(default=None, max_length=300)
    guardian_relation: str | None = Field(default=None, max_length=50)
    guardian_phone: str | None = Field(default=None, max_length=50)


class StudentImportIn(BaseModel):
    rows: list[StudentImportRowIn] = Field(min_length=1, max_length=MAX_IMPORT_ROWS)
    # true: validate only and report what would happen (the preview step).
    # false: create the accounts for every valid row.
    dry_run: bool = True


class StudentImportRowResult(BaseModel):
    line: int
    # ready   -- valid; would be created (dry run only)
    # created -- account created
    # exists  -- already on Medha for this class + roll number; left untouched
    # error   -- invalid; `message` says what to fix
    status: Literal["ready", "created", "exists", "error"]
    message: str | None
    full_name: str | None
    grade_label: str | None
    roll_number: str | None


class StudentImportOut(BaseModel):
    dry_run: bool
    total: int
    ready: int  # valid rows (created, when not a dry run)
    created: int
    exists: int
    errors: int
    rows: list[StudentImportRowResult]

import uuid
from datetime import datetime

from pydantic import BaseModel

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

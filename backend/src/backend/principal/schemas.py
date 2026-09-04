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
    "RejectIn",
    "ApprovalResult",
]


class PrincipalStats(BaseModel):
    teachers: int  # approved at this school
    pending_teachers: int


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

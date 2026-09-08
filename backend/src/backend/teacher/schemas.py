import uuid
from datetime import datetime

from pydantic import BaseModel

from backend.approvals.schemas import ApprovalResult, RejectIn

__all__ = [
    "TeacherStudentStats",
    "PendingStudent",
    "StudentRosterItem",
    "RejectIn",
    "ApprovalResult",
]


class TeacherStudentStats(BaseModel):
    students: int  # approved at this school
    pending_students: int


class PendingStudent(BaseModel):
    id: uuid.UUID
    full_name: str
    grade_id: uuid.UUID
    grade_label: str
    roll_number: str | None
    applied_at: datetime


class StudentRosterItem(BaseModel):
    id: uuid.UUID
    full_name: str
    grade_id: uuid.UUID
    grade_label: str
    roll_number: str | None
    email: str | None
    activated: bool  # has set a login credential
    approved_at: datetime | None

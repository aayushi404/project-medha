import uuid
from datetime import datetime

from pydantic import BaseModel

from backend.approvals.schemas import ApprovalResult, RejectIn

__all__ = [
    "AdminStats",
    "PendingPrincipal",
    "PrincipalListItem",
    "SchoolPrincipalStatus",
    "SchoolDetail",
    "SchoolStaffMember",
    "DistrictSummary",
    "ActivityItem",
    "RejectIn",
    "ApprovalResult",
]


class AdminStats(BaseModel):
    schools: int
    districts: int
    principals: int  # approved
    teachers: int  # approved
    students: int  # approved
    pending_principals: int
    schools_without_principal: int
    # share of today's marked attendance that is "present"; None until any
    # attendance has been marked today
    attendance_today_pct: float | None = None


class PendingPrincipal(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None
    mobile_number: str | None
    qualification: str | None
    school_id: uuid.UUID
    school_name: str
    district_name: str
    applied_at: datetime


class PrincipalListItem(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None
    mobile_number: str | None
    qualification: str | None
    school_id: uuid.UUID | None
    school_name: str | None
    district_name: str | None
    approval_status: str  # approved | pending | rejected
    rejection_reason: str | None = None
    email_verified: bool
    applied_at: datetime
    decided_at: datetime | None = None


class SchoolPrincipalStatus(BaseModel):
    school_id: uuid.UUID
    school_name: str
    district_name: str
    principal_name: str | None = None
    principal_email: str | None = None
    principal_status: str | None = None  # approved | pending | rejected
    teacher_count: int = 0
    student_count: int = 0


class SchoolStaffMember(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None
    role: str  # principal | teacher
    approval_status: str
    qualification: str | None = None


class SchoolDetail(BaseModel):
    school_id: uuid.UUID
    school_name: str
    udise_code: str | None
    school_type: str | None
    medium_of_instruction: str
    district_name: str
    block_name: str | None
    class_count: int
    student_count: int
    pending_student_count: int
    attendance_today_pct: float | None = None
    staff: list[SchoolStaffMember]


class DistrictSummary(BaseModel):
    district_id: uuid.UUID
    district_name: str
    schools: int
    schools_without_principal: int
    teachers: int
    students: int
    pending_principals: int


class ActivityItem(BaseModel):
    id: uuid.UUID
    action: str  # approved | rejected | revoked
    subject_name: str
    subject_role: str  # principal | teacher | student
    actor_name: str
    school_name: str | None = None
    reason: str | None = None
    created_at: datetime

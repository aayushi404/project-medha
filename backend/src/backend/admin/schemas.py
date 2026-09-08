import uuid
from datetime import datetime

from pydantic import BaseModel

from backend.approvals.schemas import ApprovalResult, RejectIn

__all__ = [
    "AdminStats",
    "PendingPrincipal",
    "SchoolPrincipalStatus",
    "RejectIn",
    "ApprovalResult",
]


class AdminStats(BaseModel):
    schools: int
    principals: int  # approved
    teachers: int  # approved
    pending_principals: int


class PendingPrincipal(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    mobile_number: str | None
    qualification: str | None
    school_id: uuid.UUID
    school_name: str
    district_name: str
    applied_at: datetime


class SchoolPrincipalStatus(BaseModel):
    school_id: uuid.UUID
    school_name: str
    district_name: str
    principal_name: str | None = None
    principal_email: str | None = None
    principal_status: str | None = None  # approved | pending | rejected



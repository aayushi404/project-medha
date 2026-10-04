"""The one student profile shape, shared by teachers and the principal.

Who may open a profile is decided on the server (see service.py). `viewer`
says which actions the caller may take on it, so the screen never works out
permissions for itself.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel


class ViewerRights(BaseModel):
    can_approve: bool
    can_reject: bool
    # the homeroom (class) teacher of the student's current class only
    can_reset_login: bool


class StudentProfileOut(BaseModel):
    id: uuid.UUID
    full_name: str
    photo_url: str | None
    approval_status: str
    status: str
    login_phone: str | None
    email: str | None
    class_section_id: uuid.UUID | None
    grade_label: str | None
    section: str | None
    roll_number: int | None
    academic_year_label: str | None
    class_teacher_name: str | None
    approved_at: datetime | None
    guardian_name: str | None
    guardian_relation: str | None
    guardian_phone: str | None
    viewer: ViewerRights

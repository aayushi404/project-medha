import re
import uuid
from datetime import datetime
from typing import Literal

from backend.auth.password_policy import validate_password
from backend.core import validators
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

# roles a user may pick on the registration form. "admin" is deliberately
# absent -- admin accounts are seeded, never self-registered.
RegisterRole = Literal["teacher", "principal"]


def _normalize_email(v: str) -> str:
    return v.strip().lower()


def _normalize_mobile(v: str) -> str:
    return validators.indian_mobile(v)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    # The portal the login came from: the Student / Teacher / Principal tabs on
    # /login, or `admin` from the separate /admin/login page. Optional: omitted
    # (or None), no portal check is done -- kept optional rather than required
    # so any other caller of this endpoint (scripts, future clients) isn't
    # forced to know it. When given, the account's role must match it (see
    # auth/service.py).
    role: Literal["student", "teacher", "principal", "admin"] | None = None

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalize_email(v)


class RegisterIn(BaseModel):
    role: RegisterRole
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)  # real rules: password_policy (below)
    mobile_number: str = Field(min_length=1, max_length=20)
    school_id: uuid.UUID
    # teacher-only; employee_code is required for teachers (checked below)
    employee_code: str | None = Field(default=None, max_length=60)
    years_of_experience: int | None = Field(default=None, ge=0, le=50)
    qualification: str | None = Field(default=None, max_length=120)
    # Set when registration was reached via "Continue with Google". The
    # backend verifies this token itself and takes the Google identity (and a
    # verified email) from it -- a client-supplied "sub" is never trusted.
    # Approval (employee_code + principal sign-off) still applies.
    google_id_token: str | None = Field(default=None, min_length=10, max_length=4096)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalize_email(v)

    @field_validator("mobile_number")
    @classmethod
    def _mobile(cls, v: str) -> str:
        return _normalize_mobile(v)

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        return validators.clean_name(v, label="Name")

    @field_validator("employee_code")
    @classmethod
    def _employee_code(cls, v: str | None) -> str | None:
        return validators.employee_code(v) if v else None

    @field_validator("qualification")
    @classmethod
    def _qualification(cls, v: str | None) -> str | None:
        return validators.clean_text(v, max_len=120) if v else None

    @model_validator(mode="after")
    def _require_teacher_fields(self) -> "RegisterIn":
        if self.role == "teacher" and not self.employee_code:
            raise ValueError("Employee code (government teacher ID) is required.")
        validate_password(self.password, email=str(self.email), name=self.full_name)
        return self


class RegisterOut(BaseModel):
    status: Literal["pending"] = "pending"
    role: str
    message: str


class VerifyEmailIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class EmailOnlyIn(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalize_email(v)


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=1, max_length=128)

    @model_validator(mode="after")
    def _policy(self) -> "ResetPasswordIn":
        validate_password(self.new_password)
        return self


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)

    @model_validator(mode="after")
    def _policy(self) -> "ChangePasswordIn":
        validate_password(self.new_password)
        if self.new_password == self.current_password:
            raise ValueError("New password must be different from the current one.")
        return self


class MessageOut(BaseModel):
    message: str


class TokenOut(BaseModel):
    access_token: str
    expires_in: int


class GoogleAuthIn(BaseModel):
    id_token: str = Field(min_length=10)


class TeacherOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str | None
    full_name: str
    role: str
    approval_status: str
    school_id: uuid.UUID | None
    onboarded_at: datetime | None
    photo_url: str | None = None


class StudentOut(BaseModel):
    """`grade_id`/`roll_number` are resolved server-side via the student's
    current `student_enrollments` row (see auth/router.py:me) -- `Student`
    itself no longer carries these as columns, see the school-management-
    system section-based rewiring pass."""

    id: uuid.UUID
    email: str | None
    full_name: str
    role: str = "student"
    approval_status: str
    school_id: uuid.UUID
    grade_id: uuid.UUID | None
    roll_number: str | None
    photo_url: str | None = None

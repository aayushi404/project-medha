import re
import uuid
from datetime import datetime
from typing import Literal

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
    """Strip +91 / spaces / dashes, keep the trailing 10 digits."""
    digits = re.sub(r"\D", "", v)
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if len(digits) != 10:
        raise ValueError("Enter a valid 10-digit mobile number.")
    return digits


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalize_email(v)


class RegisterIn(BaseModel):
    role: RegisterRole
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    mobile_number: str = Field(min_length=1, max_length=20)
    school_id: uuid.UUID
    # teacher-only; employee_code is required for teachers (checked below)
    employee_code: str | None = Field(default=None, max_length=60)
    years_of_experience: int | None = Field(default=None, ge=0, le=50)
    qualification: str | None = Field(default=None, max_length=120)
    # Set when registration was reached via "Continue with Google" on a brand
    # new identity -- links the resulting pending row so a later /auth/google
    # login finds it without a separate link step. Google only authenticates
    # *identity* here; approval (employee_code + principal sign-off) still
    # applies exactly as it does for a plain email/password registration.
    google_sub: str | None = Field(default=None, max_length=255)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalize_email(v)

    @field_validator("mobile_number")
    @classmethod
    def _mobile(cls, v: str) -> str:
        return _normalize_mobile(v)

    @field_validator("full_name", "employee_code", "qualification")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if isinstance(v, str) else v

    @model_validator(mode="after")
    def _require_teacher_fields(self) -> "RegisterIn":
        if self.role == "teacher" and not self.employee_code:
            raise ValueError("Employee code (government teacher ID) is required.")
        return self


class RegisterOut(BaseModel):
    status: Literal["pending"] = "pending"
    role: str
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
    grade_id: uuid.UUID | None
    roll_number: str | None
    onboarded_at: datetime | None

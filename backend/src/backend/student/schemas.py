import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from backend.auth.schemas import _normalize_email


class StudentRegisterIn(BaseModel):
    """Phase 1: a student asks to join a class. No credential yet -- a teacher at
    the school verifies the class + roll number against the register first."""

    full_name: str = Field(min_length=2, max_length=120)
    school_id: uuid.UUID
    grade_id: uuid.UUID
    roll_number: str = Field(min_length=1, max_length=20)

    @field_validator("full_name", "roll_number")
    @classmethod
    def _trim(cls, v: str) -> str:
        return v.strip()


class StudentRegisterOut(BaseModel):
    status: Literal["pending"] = "pending"
    message: str


class StudentActivateIn(BaseModel):
    """Phase 2: the student proves who they are by re-entering the details a
    teacher already approved, then sets a login credential."""

    school_id: uuid.UUID
    grade_id: uuid.UUID
    roll_number: str = Field(min_length=1, max_length=20)
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalize_email(v)

    @field_validator("full_name", "roll_number")
    @classmethod
    def _trim(cls, v: str) -> str:
        return v.strip()


class StudentActivateOut(BaseModel):
    status: Literal["activated"] = "activated"
    message: str

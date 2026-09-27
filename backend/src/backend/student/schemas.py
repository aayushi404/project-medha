import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from backend.auth.password_policy import validate_password
from backend.auth.schemas import _normalize_email
from backend.core import validators


class StudentRegisterIn(BaseModel):
    """Self-registration, one step: a student picks their school, grade,
    class_section (current academic year), and roll number for that
    section, gives guardian details, and sets their own login credential.
    A teacher still has to approve the resulting pending row before it can
    log in -- but there's no separate "activate" step anymore."""

    full_name: str = Field(min_length=2, max_length=120)
    school_id: uuid.UUID
    class_section_id: uuid.UUID
    roll_number: int = Field(ge=1, le=999)
    guardian_name: str = Field(min_length=2, max_length=120)
    guardian_relation: Literal["father", "mother", "guardian"]
    guardian_phone: str = Field(min_length=1, max_length=20)
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)  # real rules: password_policy (below)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return _normalize_email(v)

    @field_validator("full_name")
    @classmethod
    def _name(cls, v: str) -> str:
        return validators.clean_name(v, label="Name")

    @field_validator("guardian_name")
    @classmethod
    def _guardian_name(cls, v: str) -> str:
        return validators.clean_name(v, label="Guardian's name")

    @field_validator("guardian_phone")
    @classmethod
    def _guardian_phone(cls, v: str) -> str:
        # stored in E.164 -- this is the number the absence-call feature dials
        return validators.e164_indian_mobile(v)

    @model_validator(mode="after")
    def _password_policy(self) -> "StudentRegisterIn":
        validate_password(self.password, email=str(self.email), name=self.full_name)
        return self


class StudentRegisterOut(BaseModel):
    status: Literal["pending"] = "pending"
    message: str

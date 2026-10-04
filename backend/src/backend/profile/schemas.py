import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

# Direct generation branches on this in the prompts (docs/phase-1/04), so keep
# it a closed set rather than free text. "hinglish" is code-mixed Hindi-English
# (Latin script) -- distinct from "hi"/"hi-BiharBoli", which are Devanagari.
Language = Literal["hi-BiharBoli", "hi", "en", "hinglish"]


class SchoolOut(BaseModel):
    id: uuid.UUID
    name: str
    district_name: str


class ProfileSubjectOut(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    grade_id: uuid.UUID
    grade_label: str
    numeric_level: int
    is_primary: bool


class ProfileOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None
    phone_number: str | None
    preferred_language: str
    photo_url: str | None
    onboarded_at: datetime | None
    school: SchoolOut | None
    subjects: list[ProfileSubjectOut]


class ProfileUpdateIn(BaseModel):
    """All fields optional; a field left out is left unchanged. A teacher's
    classes and subjects are assigned by the principal, not edited here, so
    there is no `subjects` field: anything sent for it is ignored."""

    full_name: str | None = None
    preferred_language: Language | None = None

    @field_validator("full_name")
    @classmethod
    def _trim_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("full_name cannot be empty")
        return v

class StudentSelfProfileOut(BaseModel):
    """A student's own view of their profile -- lighter than `ProfileOut`
    since there's no self-edit page for this yet (grade/section/guardian
    detail lives in the principal-facing `StudentProfile` instead)."""

    id: uuid.UUID
    full_name: str
    email: str | None
    phone_number: str | None
    preferred_language: str
    photo_url: str | None


class StudentSelfProfileUpdateIn(BaseModel):
    full_name: str | None = None
    preferred_language: Language | None = None

    @field_validator("full_name")
    @classmethod
    def _trim_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("full_name cannot be empty")
        return v

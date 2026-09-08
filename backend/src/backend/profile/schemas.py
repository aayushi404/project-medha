import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator, model_validator

from backend.onboarding.schemas import TeacherSubjectIn, validate_subject_selection

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
    email: str
    phone_number: str | None
    preferred_language: str
    onboarded_at: datetime | None
    school: SchoolOut | None
    subjects: list[ProfileSubjectOut]


class ProfileUpdateIn(BaseModel):
    """All fields optional; a field left out is left unchanged. When `subjects`
    is given it replaces the teacher's full subject/grade set."""

    full_name: str | None = None
    preferred_language: Language | None = None
    subjects: list[TeacherSubjectIn] | None = None

    @field_validator("full_name")
    @classmethod
    def _trim_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("full_name cannot be empty")
        return v

    @model_validator(mode="after")
    def _validate_subjects(self) -> "ProfileUpdateIn":
        if self.subjects is not None:
            validate_subject_selection(self.subjects)
        return self

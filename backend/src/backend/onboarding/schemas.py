import uuid
from collections.abc import Sequence

from pydantic import BaseModel, field_validator, model_validator


class TeacherSubjectIn(BaseModel):
    subject_id: uuid.UUID
    grade_id: uuid.UUID
    is_primary: bool = False


def validate_subject_selection(subjects: Sequence[TeacherSubjectIn]) -> None:
    """Shared rules for a teacher's subject/grade set (onboarding + profile edit):
    at least one pair, no duplicate pairs, exactly one marked primary."""
    if not subjects:
        raise ValueError("at least one subject/grade pair is required")

    pairs = [(s.subject_id, s.grade_id) for s in subjects]
    if len(pairs) != len(set(pairs)):
        raise ValueError("duplicate subject/grade pairs are not allowed")

    if sum(1 for s in subjects if s.is_primary) != 1:
        raise ValueError("exactly one subject/grade pair must be marked as primary")


class OnboardingCompleteIn(BaseModel):
    full_name: str
    school_id: uuid.UUID
    subjects: list[TeacherSubjectIn]

    @field_validator("full_name")
    @classmethod
    def _validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("full_name is required")
        return v

    @model_validator(mode="after")
    def _validate_subjects(self) -> "OnboardingCompleteIn":
        validate_subject_selection(self.subjects)
        return self

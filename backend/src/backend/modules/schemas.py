import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


class ModuleListItem(BaseModel):
    id: uuid.UUID
    title: str
    grade_id: uuid.UUID
    grade_label: str
    subject_id: uuid.UUID
    subject_name: str
    chapter_id: uuid.UUID | None
    topic_id: uuid.UUID | None
    topic_title: str | None
    artifact_types: list[str]
    updated_at: datetime


class ArtifactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    artifact_type: str
    content_json: dict | None
    created_at: datetime


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rating: int | None
    comment: str | None
    created_at: datetime


class ModuleDetailOut(BaseModel):
    id: uuid.UUID
    title: str
    grade_label: str
    subject_name: str
    topic_title: str | None
    session_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    artifacts: list[ArtifactOut]
    feedback: FeedbackOut | None


class FeedbackIn(BaseModel):
    rating: Literal[1, -1]
    comment: str | None = None

    @field_validator("comment")
    @classmethod
    def _clean(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

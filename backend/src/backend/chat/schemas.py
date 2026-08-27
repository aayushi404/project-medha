import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


class SessionCreateIn(BaseModel):
    grade_id: uuid.UUID
    subject_id: uuid.UUID
    chapter_id: uuid.UUID | None = None
    topic_id: uuid.UUID | None = None


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    grade_id: uuid.UUID
    subject_id: uuid.UUID
    chapter_id: uuid.UUID | None
    topic_id: uuid.UUID | None
    title: str | None
    created_at: datetime
    updated_at: datetime


class SessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    grade_id: uuid.UUID
    subject_id: uuid.UUID
    topic_id: uuid.UUID | None
    updated_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    created_at: datetime


class SessionDetailOut(SessionOut):
    messages: list[MessageOut]
    module_id: uuid.UUID | None


class MessageCreateIn(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("content is required")
        return v


class GenerateIn(BaseModel):
    # 'explanation' is produced by /messages, not here
    artifact_type: Literal["quiz", "activity"]

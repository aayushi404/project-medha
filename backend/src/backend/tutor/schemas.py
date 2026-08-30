import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class TutorSessionCreateIn(BaseModel):
    # the student's class is taken from their account, not the request
    subject_id: uuid.UUID
    chapter_id: uuid.UUID


class TutorSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subject_id: uuid.UUID
    chapter_id: uuid.UUID | None
    topic_id: uuid.UUID | None
    title: str | None
    created_at: datetime
    updated_at: datetime


class TutorSessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    subject_id: uuid.UUID
    chapter_id: uuid.UUID | None
    updated_at: datetime


class TutorMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str  # 'student' | 'assistant'
    content: str
    created_at: datetime


class TutorSessionDetailOut(TutorSessionOut):
    messages: list[TutorMessageOut]


class TutorMessageCreateIn(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("content is required")
        return v

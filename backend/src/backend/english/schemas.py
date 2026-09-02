import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class EnglishSessionCreateIn(BaseModel):
    lesson_topic: str | None = None


class EnglishSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_topic: str | None
    title: str | None
    created_at: datetime
    updated_at: datetime


class EnglishMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    created_at: datetime


class EnglishSessionDetailOut(EnglishSessionOut):
    messages: list[EnglishMessageOut]


class EnglishMessageCreateIn(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("content is required")
        return v

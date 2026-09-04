import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChapterNoteIn(BaseModel):
    chapter_id: uuid.UUID
    summary: str = Field(min_length=1, max_length=4000)
    key_points: list[str] = Field(default_factory=list)
    important_terms: list[str] = Field(default_factory=list)


class ChapterNoteOut(BaseModel):
    id: uuid.UUID
    chapter_id: uuid.UUID
    summary: str
    key_points: list[str]
    important_terms: list[str]
    updated_at: datetime

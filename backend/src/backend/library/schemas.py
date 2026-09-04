import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LibraryItemIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    url: str = Field(min_length=1, max_length=2000)
    grade_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None


class LibraryItemOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    url: str
    grade_label: str | None
    subject_name: str | None
    created_at: datetime

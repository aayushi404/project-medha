import uuid
from datetime import datetime

from pydantic import BaseModel


class LibraryPresentationItem(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str | None
    language: str
    grade_label: str | None
    subject_name: str | None
    chapter_title: str | None
    slide_count: int | None
    updated_at: datetime


class LibraryPresentationDetail(LibraryPresentationItem):
    tags: list[str] | None
    # the stored slide spec (same shape the LLM produces / a module `ppt`
    # artifact stores) -- lets the frontend render an in-app preview
    spec: dict | None

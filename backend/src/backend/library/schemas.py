from urllib.parse import urlparse
import uuid
from datetime import datetime

from pydantic import field_validator, BaseModel, Field


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


class LibraryItemIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    url: str = Field(min_length=1, max_length=2000)

    @field_validator("url")
    @classmethod
    def _http_only(cls, v: str) -> str:
        # links are rendered as clickable anchors for every student and teacher:
        # javascript:/data: URLs would be stored XSS
        v = v.strip()
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("Enter a full web address starting with http:// or https://")
        return v
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

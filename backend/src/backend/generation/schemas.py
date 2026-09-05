import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ScopeIn(BaseModel):
    grade_id: uuid.UUID
    subject_id: uuid.UUID
    chapter_id: uuid.UUID | None = None
    topic_id: uuid.UUID | None = None


class GenerateIn(BaseModel):
    scope: ScopeIn
    # validated per-type in the pipeline against PARAM_MODELS[type]
    params: dict = Field(default_factory=dict)
    language: str | None = None  # defaults to the teacher's preferred_language


class RegenerateIn(BaseModel):
    # optional overrides merged onto the parent row's input_params
    params: dict | None = None
    language: str | None = None


class GenerationListItem(BaseModel):
    id: str  # uuid for real rows; "legacy:<artifact_id>" for pre-v2 module rows
    type: str
    title: str
    status: str
    source: str
    is_favorite: bool
    grade_label: str | None
    subject_name: str | None
    chapter_title: str | None
    created_at: datetime
    legacy: bool = False
    module_id: uuid.UUID | None = None


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rating: int | None
    comment: str | None
    created_at: datetime


class ExportOut(BaseModel):
    format: str
    status: str
    ready: bool


class GenerationDetailOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    description: str | None
    language: str
    status: str
    source: str
    is_favorite: bool
    grade_id: uuid.UUID | None
    subject_id: uuid.UUID | None
    chapter_id: uuid.UUID | None
    topic_id: uuid.UUID | None
    grade_label: str | None
    subject_name: str | None
    chapter_title: str | None
    input_params: dict | None
    content_json: dict | None
    error_message: str | None
    session_id: uuid.UUID | None
    parent_generation_id: uuid.UUID | None
    prompt_version: str | None
    created_at: datetime
    updated_at: datetime
    feedback: FeedbackOut | None
    exports: list[ExportOut]


class GenerationPatchIn(BaseModel):
    is_favorite: bool | None = None
    title: str | None = None

    @field_validator("title")
    @classmethod
    def _clean_title(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()[:160]
        if not v:
            raise ValueError("title cannot be blank")
        return v


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

import uuid

from pydantic import BaseModel, ConfigDict


class ChapterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chapter_number: int
    title: str


class TopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None = None
    sequence_order: int

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str
    data: dict | None
    read_at: datetime | None
    created_at: datetime


class UnreadCountOut(BaseModel):
    count: int


class DeviceTokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=4096)
    platform: Literal["android", "ios", "web"]


class AnnounceIn(BaseModel):
    """A principal announces to `audience` (their whole school); a teacher
    announces to one `grade_id` (their class). Exactly one of the two must
    be set -- which one is valid depends on the caller's role, checked in
    `service.announce`."""

    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=2000)
    audience: Literal["teachers", "students"] | None = None
    grade_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _one_target(self) -> "AnnounceIn":
        if (self.audience is None) == (self.grade_id is None):
            raise ValueError("Set exactly one of audience (principal) or grade_id (teacher).")
        return self


class AnnounceOut(BaseModel):
    recipients: int

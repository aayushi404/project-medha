import uuid
from datetime import date as date_
from datetime import datetime

from pydantic import BaseModel, Field


class HomeworkCreateIn(BaseModel):
    grade_id: uuid.UUID
    subject_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    due_date: date_ | None = None


class HomeworkListItem(BaseModel):
    id: uuid.UUID
    title: str
    grade_label: str
    subject_name: str | None
    due_date: date_ | None
    created_at: datetime
    done_count: int
    total_count: int


class HomeworkDetailOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    grade_label: str
    subject_name: str | None
    due_date: date_ | None
    created_at: datetime


class HomeworkStudentOut(BaseModel):
    """A student's own view of one assignment, with their personal
    done/not-done flag folded in."""

    id: uuid.UUID
    title: str
    description: str | None
    subject_name: str | None
    due_date: date_ | None
    done: bool
    created_at: datetime

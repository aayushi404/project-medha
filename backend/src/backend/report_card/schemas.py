import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ReportCardMarkIn(BaseModel):
    student_id: uuid.UUID
    subject_id: uuid.UUID
    term: str = Field(min_length=1, max_length=60)
    marks_obtained: float = Field(ge=0)
    max_marks: float = Field(gt=0, default=100)
    remarks: str | None = Field(default=None, max_length=500)


class ReportCardMarkOut(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    term: str
    marks_obtained: float
    max_marks: float
    remarks: str | None
    updated_at: datetime


class ReportCardOut(BaseModel):
    student_id: uuid.UUID
    student_name: str
    marks: list[ReportCardMarkOut]

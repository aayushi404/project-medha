import uuid

from pydantic import BaseModel, Field


class TimetableSlotIn(BaseModel):
    day_of_week: int = Field(ge=0, le=6)  # 0=Monday
    period_number: int = Field(ge=1, le=12)
    subject_id: uuid.UUID | None = None
    teacher_id: uuid.UUID | None = None


class TimetableSetIn(BaseModel):
    grade_id: uuid.UUID
    slots: list[TimetableSlotIn]


class TimetableSlotOut(BaseModel):
    day_of_week: int
    period_number: int
    subject_id: uuid.UUID | None
    subject_name: str | None
    teacher_id: uuid.UUID | None
    teacher_name: str | None


class TimetableOut(BaseModel):
    grade_id: uuid.UUID
    grade_label: str
    slots: list[TimetableSlotOut]

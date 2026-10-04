import uuid
from datetime import time
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class PeriodSlotIn(BaseModel):
    period_number: int = Field(ge=1, le=20)
    label: str | None = Field(default=None, max_length=40)
    starts_at: time | None = None
    ends_at: time | None = None
    is_break: bool = False

    @model_validator(mode="after")
    def _ends_after_start(self) -> "PeriodSlotIn":
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("A period must end after it starts.")
        return self


class PeriodSlotOut(BaseModel):
    id: uuid.UUID
    day_of_week: int
    period_number: int
    label: str | None
    starts_at: time | None
    ends_at: time | None
    is_break: bool


class DaySlotsIn(BaseModel):
    slots: list[PeriodSlotIn] = Field(max_length=20)


class CopySlotsIn(BaseModel):
    from_day: int = Field(ge=1, le=7)
    to_days: list[int] = Field(min_length=1, max_length=7)


class TimetableCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    # Start a revision from this timetable's cells instead of an empty grid.
    copy_from_id: uuid.UUID | None = None


class TimetableOut(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    version: int
    academic_year_id: uuid.UUID
    academic_year_label: str


class TimetableListItem(TimetableOut):
    cell_count: int


class VersionIn(BaseModel):
    version: int


class SectionOut(BaseModel):
    id: uuid.UUID
    label: str  # "9 · A"
    grade_label: str  # "Class 9"
    section: str


class SubjectOut(BaseModel):
    id: uuid.UUID
    name: str


class CellOut(BaseModel):
    class_section_id: uuid.UUID
    period_slot_id: uuid.UUID
    subject_id: uuid.UUID
    subject_name: str
    teacher_id: uuid.UUID | None
    teacher_name: str | None


class EligibleTeacherOut(BaseModel):
    teacher_id: uuid.UUID
    name: str
    # assigned: teaches this subject to this section. qualified: teaches it
    # to this grade somewhere in the school.
    tier: Literal["assigned", "qualified"]
    periods_today: int
    periods_week: int


class TimetableGridOut(BaseModel):
    timetable_id: uuid.UUID
    name: str
    status: str
    editable: bool
    version: int
    day_of_week: int
    period_slots: list[PeriodSlotOut]
    class_sections: list[SectionOut]
    subjects: list[SubjectOut]
    cells: list[CellOut]
    # keyed "<class_section_id>:<subject_id>"; pairs with no teacher are absent
    eligible_teachers: dict[str, list[EligibleTeacherOut]]


class CellIn(BaseModel):
    class_section_id: uuid.UUID
    period_slot_id: uuid.UUID
    subject_id: uuid.UUID
    teacher_id: uuid.UUID | None = None


class SaveDayIn(BaseModel):
    version: int
    cells: list[CellIn] = Field(max_length=400)


class CopyDayOut(BaseModel):
    grid: TimetableGridOut
    copied: int
    # cells from the source day with no matching period on the target day
    skipped: int


class ValidationItem(BaseModel):
    day_of_week: int
    period_number: int
    class_label: str
    subject_name: str | None = None


class OverloadItem(BaseModel):
    teacher_id: uuid.UUID
    teacher_name: str
    day_of_week: int
    periods: int
    cap: int


class ValidationOut(BaseModel):
    empty_slots: list[ValidationItem]
    no_teacher: list[ValidationItem]
    overloaded: list[OverloadItem]
    daily_cap: int

import uuid
from datetime import date as date_
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from backend.timetable_planner.schemas import PeriodSlotOut, SectionOut

Reason = Literal["sick", "leave", "official_duty", "training"]


class AbsenceIn(BaseModel):
    teacher_id: uuid.UUID
    dates: list[date_] = Field(min_length=1, max_length=31)
    is_full_day: bool = True
    from_period_number: int | None = Field(default=None, ge=1, le=20)
    to_period_number: int | None = Field(default=None, ge=1, le=20)
    reason: Reason | None = None
    note: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _partial_needs_range(self) -> "AbsenceIn":
        if not self.is_full_day:
            if self.from_period_number is None or self.to_period_number is None:
                raise ValueError("A partial absence needs from and to periods.")
            if self.from_period_number > self.to_period_number:
                raise ValueError("The 'from' period must come before the 'to' period.")
        return self


class AbsenceOut(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    teacher_name: str
    date: date_
    is_full_day: bool
    from_period_number: int | None
    to_period_number: int | None
    reason: str | None
    note: str | None


class AbsenceResultOut(BaseModel):
    absences: list[AbsenceOut]
    # covers that were removed because the substitute is now absent; those cells are red again
    released: int


class SubstitutionIn(BaseModel):
    date: date_
    timetable_cell_id: uuid.UUID
    action: Literal["assign", "self_study", "cancel"]
    substitute_teacher_id: uuid.UUID | None = None
    note: str | None = Field(default=None, max_length=200)


class BulkSubstitutionIn(BaseModel):
    date: date_
    items: list[SubstitutionIn] = Field(min_length=1, max_length=200)


class SubstitutionOut(BaseModel):
    id: uuid.UUID
    date: date_
    timetable_cell_id: uuid.UUID | None
    status: str
    substitute_teacher_id: uuid.UUID | None
    substitute_teacher_name: str | None
    note: str | None


class CandidateOut(BaseModel):
    teacher_id: uuid.UUID
    name: str
    photo_url: str | None
    # 1 reserve for this section, 2 teaches this subject, 3 free for supervision only
    tier: int
    teaches_subject: bool
    subjects: list[str]
    periods_today: int
    covers_today: int


class UnavailableOut(BaseModel):
    teacher_id: uuid.UUID
    name: str
    photo_url: str | None
    reason: str


class CandidatesOut(BaseModel):
    available: list[CandidateOut]
    unavailable: list[UnavailableOut]


class CoverCellOut(BaseModel):
    timetable_cell_id: uuid.UUID
    class_section_id: uuid.UUID
    period_slot_id: uuid.UUID
    subject_id: uuid.UUID
    subject_name: str
    original_teacher_id: uuid.UUID | None
    original_teacher_name: str | None
    # normal | needs_cover | covered | self_study | cancelled
    state: str
    substitute: SubstitutionOut | None


class DaySummaryOut(BaseModel):
    absent_count: int
    needs_cover: int
    resolved: int


class TimetableRefOut(BaseModel):
    id: uuid.UUID
    name: str


class DayBoardOut(BaseModel):
    date: date_
    day_of_week: int
    timetable: TimetableRefOut | None
    summary: DaySummaryOut
    absences: list[AbsenceOut]
    period_slots: list[PeriodSlotOut]
    class_sections: list[SectionOut]
    cells: list[CoverCellOut]
    # keyed by timetable_cell_id, only for cells that need cover
    candidates: dict[str, CandidatesOut]


class SuggestionItemOut(BaseModel):
    timetable_cell_id: uuid.UUID
    class_section_id: uuid.UUID
    period_slot_id: uuid.UUID
    substitute_teacher_id: uuid.UUID | None
    substitute_teacher_name: str | None
    tier: int | None
    reason: str | None  # set when nobody is free


class SuggestionOut(BaseModel):
    items: list[SuggestionItemOut]


class FinalStatusOut(BaseModel):
    date: date_
    finalized: bool
    version: int | None = None
    finalized_at: str | None = None
    finalized_by_name: str | None = None
    # the snapshot still matches the cover as it is now
    up_to_date: bool | None = None
    needs_cover: int


class FinalDayOut(BaseModel):
    date: date_
    finalized: bool
    finalized_at: str | None = None
    # see cover/finalize.py for the shape
    payload: dict | None = None

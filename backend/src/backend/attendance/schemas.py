import uuid
from datetime import date as date_
from typing import Literal

from pydantic import BaseModel, Field

AttendanceStatus = Literal["present", "absent"]


class AttendanceStudentOut(BaseModel):
    student_id: uuid.UUID
    full_name: str
    roll_number: int | None
    photo_url: str | None
    status: AttendanceStatus | None  # None = not yet marked for this date


class AttendanceDayOut(BaseModel):
    class_section_id: uuid.UUID
    grade_label: str
    section: str
    date: date_
    students: list[AttendanceStudentOut]


class AttendanceRecordIn(BaseModel):
    student_id: uuid.UUID
    status: AttendanceStatus


class AttendanceMarkIn(BaseModel):
    class_section_id: uuid.UUID
    date: date_
    records: list[AttendanceRecordIn] = Field(min_length=1)


class AttendanceMineItem(BaseModel):
    date: date_
    status: AttendanceStatus

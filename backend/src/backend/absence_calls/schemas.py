import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

AbsenceCallStatus = Literal[
    "queued",
    "no_guardian_phone",
    "not_configured",
    "dialing",
    "ringing",
    "in_progress",
    "completed",
    "no_answer",
    "failed",
]


class AbsenceCallOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    guardian_phone: str | None
    status: AbsenceCallStatus
    reason_text: str | None
    attendance_date: str
    created_at: datetime
    completed_at: datetime | None

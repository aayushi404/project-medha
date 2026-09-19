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
    # The provider/config error text when the call couldn't even be placed
    # (not_configured, no_guardian_phone, failed) -- distinct from
    # reason_text, which is the AI's takeaway from a call that DID happen.
    failure_reason: str | None
    # The full back-and-forth, one "role: line" per row -- set once the call
    # actually happened (completed, or ended mid-conversation on `stop`).
    transcript: str | None
    attendance_date: str
    created_at: datetime
    completed_at: datetime | None

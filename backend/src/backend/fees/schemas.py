import uuid
from datetime import date as date_
from datetime import datetime

from pydantic import BaseModel, Field


class FeePaymentIn(BaseModel):
    student_id: uuid.UUID
    amount: float = Field(gt=0)
    fee_type: str = Field(min_length=1, max_length=100)
    payment_date: date_
    note: str | None = Field(default=None, max_length=500)


class FeePaymentOut(BaseModel):
    id: uuid.UUID
    amount: float
    fee_type: str
    payment_date: date_
    note: str | None
    logged_by_name: str
    created_at: datetime

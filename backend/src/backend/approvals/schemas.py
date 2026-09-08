import uuid

from pydantic import BaseModel, Field


class RejectIn(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class ApprovalResult(BaseModel):
    id: uuid.UUID
    approval_status: str

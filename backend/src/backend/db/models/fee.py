import uuid
from datetime import date as date_
from datetime import datetime

from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class FeePayment(Base):
    """A manually-logged fee payment record -- there is no payment gateway
    here, this is a ledger a principal/teacher enters after collecting a
    payment by hand, so students and (eventually) parents have a record."""

    __tablename__ = "fee_payments"
    __table_args__ = (Index("idx_fee_payments_student", "student_id", text("payment_date DESC")),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    student_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE"))
    school_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("schools.id"))
    amount: Mapped[float]
    fee_type: Mapped[str]
    payment_date: Mapped[date_]
    note: Mapped[str | None]
    logged_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teachers.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

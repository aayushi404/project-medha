"""Fee payments: a manually-kept ledger, principal-logged -- there is no
payment gateway here, this is a record entered after collecting a payment
by hand, so students (and eventually parents) have a log to check."""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, aliased

from backend.db.models import FeePayment, Teacher
from backend.fees.schemas import FeePaymentIn, FeePaymentOut


def log_payment(db: Session, principal: Teacher, payload: FeePaymentIn) -> FeePaymentOut:
    student = db.get(Teacher, payload.student_id)
    if student is None or student.role != "student" or student.school_id != principal.school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")

    row = FeePayment(
        student_id=payload.student_id,
        school_id=principal.school_id,
        amount=payload.amount,
        fee_type=payload.fee_type,
        payment_date=payload.payment_date,
        note=payload.note,
        logged_by=principal.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return FeePaymentOut(
        id=row.id, amount=row.amount, fee_type=row.fee_type, payment_date=row.payment_date,
        note=row.note, logged_by_name=principal.full_name, created_at=row.created_at,
    )


def list_for_student(db: Session, viewer: Teacher, student_id: uuid.UUID) -> list[FeePaymentOut]:
    student = db.get(Teacher, student_id)
    if student is None or student.role != "student":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    if viewer.role == "student":
        if viewer.id != student.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only view your own fee log.")
    elif student.school_id != viewer.school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")

    logger_alias = aliased(Teacher)
    rows = (
        db.query(FeePayment, logger_alias.full_name)
        .join(logger_alias, FeePayment.logged_by == logger_alias.id)
        .filter(FeePayment.student_id == student_id)
        .order_by(FeePayment.payment_date.desc())
        .all()
    )
    return [
        FeePaymentOut(
            id=p.id, amount=p.amount, fee_type=p.fee_type, payment_date=p.payment_date,
            note=p.note, logged_by_name=name, created_at=p.created_at,
        )
        for p, name in rows
    ]

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_user, require_principal
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.fees import service
from backend.fees.schemas import FeePaymentIn, FeePaymentOut

router = APIRouter(prefix="/fees", tags=["fees"])


@router.post("", response_model=FeePaymentOut)
def log_fee(
    payload: FeePaymentIn, principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> FeePaymentOut:
    return service.log_payment(db, principal, payload)


@router.get("/{student_id}", response_model=list[FeePaymentOut])
def list_fees(
    student_id: uuid.UUID, user: Teacher = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[FeePaymentOut]:
    return service.list_for_student(db, user, student_id)

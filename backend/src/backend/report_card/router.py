import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_user, require_teacher
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.report_card import service
from backend.report_card.schemas import ReportCardMarkIn, ReportCardMarkOut, ReportCardOut

router = APIRouter(prefix="/report-card", tags=["report-card"])


@router.post("/marks", response_model=ReportCardMarkOut)
def upsert_mark(
    payload: ReportCardMarkIn, teacher: Teacher = Depends(require_teacher), db: Session = Depends(get_db)
) -> ReportCardMarkOut:
    return service.upsert_mark(db, teacher, payload)


@router.get("/{student_id}", response_model=ReportCardOut)
def get_report_card(
    student_id: uuid.UUID, user: Teacher = Depends(get_current_user), db: Session = Depends(get_db)
) -> ReportCardOut:
    return service.get_report_card(db, user, student_id)

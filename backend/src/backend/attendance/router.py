import uuid
from datetime import date as date_

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.attendance import service
from backend.attendance.schemas import AttendanceDayOut, AttendanceMarkIn
from backend.auth.dependencies import require_teacher
from backend.db.models import Teacher
from backend.db.session import get_db

router = APIRouter(prefix="/attendance", tags=["attendance"], dependencies=[Depends(require_teacher)])


@router.get("", response_model=AttendanceDayOut)
def get_attendance(
    grade_id: uuid.UUID,
    date: date_ | None = Query(default=None, description="Defaults to today."),
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> AttendanceDayOut:
    return service.get_day(db, teacher, grade_id, date or date_.today())


@router.post("", response_model=AttendanceDayOut)
def mark_attendance(
    payload: AttendanceMarkIn,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> AttendanceDayOut:
    return service.mark_day(db, teacher, payload)

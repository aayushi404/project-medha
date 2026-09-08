import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_user, require_role
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.timetable import service
from backend.timetable.schemas import TimetableOut, TimetableSetIn

router = APIRouter(prefix="/timetable", tags=["timetable"])

require_timetable_editor = require_role("principal", "teacher")


@router.get("", response_model=TimetableOut)
def get_timetable(
    grade_id: uuid.UUID, user: Teacher = Depends(get_current_user), db: Session = Depends(get_db)
) -> TimetableOut:
    return service.get(db, user, grade_id)


@router.put("", response_model=TimetableOut)
def set_timetable(
    payload: TimetableSetIn, user: Teacher = Depends(require_timetable_editor), db: Session = Depends(get_db)
) -> TimetableOut:
    return service.set_grid(db, user, payload)

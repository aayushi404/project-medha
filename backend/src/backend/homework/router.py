import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_student, require_teacher
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.homework import service
from backend.homework.schemas import (
    HomeworkCreateIn,
    HomeworkDetailOut,
    HomeworkListItem,
    HomeworkStudentOut,
)

router = APIRouter(prefix="/homework", tags=["homework"])


@router.post("", response_model=HomeworkDetailOut)
def create_homework(
    payload: HomeworkCreateIn, teacher: Teacher = Depends(require_teacher), db: Session = Depends(get_db)
) -> HomeworkDetailOut:
    return service.create(db, teacher, payload)


@router.get("", response_model=list[HomeworkListItem])
def list_homework(teacher: Teacher = Depends(require_teacher), db: Session = Depends(get_db)) -> list[HomeworkListItem]:
    return service.list_for_teacher(db, teacher)


@router.get("/mine", response_model=list[HomeworkStudentOut])
def my_homework(student: Teacher = Depends(require_student), db: Session = Depends(get_db)) -> list[HomeworkStudentOut]:
    return service.list_for_student(db, student)


@router.post("/{homework_id}/done", response_model=HomeworkStudentOut)
def mark_done(
    homework_id: uuid.UUID, student: Teacher = Depends(require_student), db: Session = Depends(get_db)
) -> HomeworkStudentOut:
    return service.set_done(db, student, homework_id, True)


@router.post("/{homework_id}/undone", response_model=HomeworkStudentOut)
def mark_undone(
    homework_id: uuid.UUID, student: Teacher = Depends(require_student), db: Session = Depends(get_db)
) -> HomeworkStudentOut:
    return service.set_done(db, student, homework_id, False)

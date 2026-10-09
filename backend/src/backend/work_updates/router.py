import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_teacher, require_principal, require_student, require_teacher
from backend.db.models import Student, Teacher
from backend.db.session import get_db
from backend.work_updates import service
from backend.work_updates.schemas import (
    HomeworkRef,
    PrincipalFeedbackIn,
    ReactIn,
    WorkUpdateCreateIn,
    WorkUpdateOut,
    WorkUpdateStudentOut,
)

router = APIRouter(prefix="/work-updates", tags=["work-updates"])


@router.post("", response_model=WorkUpdateOut)
def create_work_update(
    payload: WorkUpdateCreateIn, teacher: Teacher = Depends(require_teacher), db: Session = Depends(get_db)
) -> WorkUpdateOut:
    return service.create(db, teacher, payload)


@router.get("", response_model=list[WorkUpdateOut])
def list_work_updates(user: Teacher = Depends(get_current_teacher), db: Session = Depends(get_db)) -> list[WorkUpdateOut]:
    if user.role not in ("teacher", "principal"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have permission to do that.")
    return service.list_for_staff(db, user)


@router.get("/homework-today", response_model=list[HomeworkRef])
def homework_today(
    grade_id: uuid.UUID,
    subject_id: uuid.UUID,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[HomeworkRef]:
    return service.todays_homework_for_teacher(db, teacher, grade_id, subject_id)


@router.get("/mine", response_model=list[WorkUpdateStudentOut])
def my_class_work_updates(
    student: Student = Depends(require_student), db: Session = Depends(get_db)
) -> list[WorkUpdateStudentOut]:
    return service.list_for_student(db, student)


@router.post("/{update_id}/react", response_model=WorkUpdateStudentOut)
def react_to_work_update(
    update_id: uuid.UUID,
    payload: ReactIn,
    student: Student = Depends(require_student),
    db: Session = Depends(get_db),
) -> WorkUpdateStudentOut:
    return service.react(db, student, update_id, payload.value)


@router.post("/{update_id}/feedback", response_model=WorkUpdateOut)
def principal_feedback(
    update_id: uuid.UUID,
    payload: PrincipalFeedbackIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> WorkUpdateOut:
    return service.give_feedback(db, principal, update_id, payload)

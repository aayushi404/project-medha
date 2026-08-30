import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_teacher
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.teacher import service
from backend.teacher.schemas import (
    ApprovalResult,
    PendingStudent,
    RejectIn,
    StudentRosterItem,
    TeacherStudentStats,
)

router = APIRouter(
    prefix="/teacher", tags=["teacher"], dependencies=[Depends(require_teacher)]
)


@router.get("/students/stats", response_model=TeacherStudentStats)
def stats(
    teacher: Teacher = Depends(require_teacher), db: Session = Depends(get_db)
) -> TeacherStudentStats:
    return service.get_stats(db, teacher)


@router.get("/students", response_model=list[StudentRosterItem])
def students(
    teacher: Teacher = Depends(require_teacher), db: Session = Depends(get_db)
) -> list[StudentRosterItem]:
    return service.list_students(db, teacher)


@router.get("/students/pending", response_model=list[PendingStudent])
def pending_students(
    teacher: Teacher = Depends(require_teacher), db: Session = Depends(get_db)
) -> list[PendingStudent]:
    return service.list_pending_students(db, teacher)


@router.post("/students/{student_id}/approve", response_model=ApprovalResult)
def approve_student(
    student_id: uuid.UUID,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.approve_student(db, teacher, student_id)


@router.post("/students/{student_id}/reject", response_model=ApprovalResult)
def reject_student(
    student_id: uuid.UUID,
    payload: RejectIn,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.reject_student(db, teacher, student_id, payload.reason)

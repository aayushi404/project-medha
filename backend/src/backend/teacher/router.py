import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_teacher
from backend.auth.schemas import ResetCodeOut
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.teacher import service
from backend.teacher.schemas import (
    ApprovalResult,
    PendingStudent,
    RejectIn,
    StudentRosterItem,
    TeacherSectionOut,
    TeacherStudentStats,
)

router = APIRouter(
    prefix="/teacher", tags=["teacher"], dependencies=[Depends(require_teacher)]
)


@router.get("/sections", response_model=list[TeacherSectionOut])
def my_sections(
    teacher: Teacher = Depends(require_teacher), db: Session = Depends(get_db)
) -> list[TeacherSectionOut]:
    return service.list_my_sections(db, teacher)


@router.get("/students/stats", response_model=TeacherStudentStats)
def stats(
    teacher: Teacher = Depends(require_teacher), db: Session = Depends(get_db)
) -> TeacherStudentStats:
    return service.get_stats(db, teacher)


@router.get("/students", response_model=list[StudentRosterItem])
def students(
    class_section_id: uuid.UUID | None = Query(default=None),
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[StudentRosterItem]:
    """Approved students in the teacher's classes; narrowed to one class with
    `class_section_id`. A class they don't teach returns an empty list."""
    return service.list_students(db, teacher, class_section_id)


@router.get("/students/pending", response_model=list[PendingStudent])
def pending_students(
    class_section_id: uuid.UUID | None = Query(default=None),
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[PendingStudent]:
    return service.list_pending_students(db, teacher, class_section_id)


@router.post("/students/{student_id}/approve", response_model=ApprovalResult)
def approve_student(
    student_id: uuid.UUID,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.approve_student(db, teacher, student_id)


@router.post("/students/{student_id}/reset-code", response_model=ResetCodeOut)
def reset_student_code(
    student_id: uuid.UUID,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ResetCodeOut:
    return service.issue_student_reset_code(db, teacher, student_id)


@router.post("/students/{student_id}/reject", response_model=ApprovalResult)
def reject_student(
    student_id: uuid.UUID,
    payload: RejectIn,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.reject_student(db, teacher, student_id, payload.reason)

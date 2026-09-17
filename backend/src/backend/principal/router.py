import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_principal
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.principal import service
from backend.principal.schemas import (
    ApprovalResult,
    ClassSectionSummary,
    PendingTeacher,
    PrincipalStats,
    RejectIn,
    RosterStudentItem,
    StudentProfile,
    StudentRosterItem,
    TeacherRosterItem,
)

router = APIRouter(
    prefix="/principal", tags=["principal"], dependencies=[Depends(require_principal)]
)


@router.get("/stats", response_model=PrincipalStats)
def stats(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> PrincipalStats:
    return service.get_stats(db, principal)


@router.get("/teachers", response_model=list[TeacherRosterItem])
def teachers(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> list[TeacherRosterItem]:
    return service.list_teachers(db, principal)


@router.get("/students", response_model=list[StudentRosterItem])
def students(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> list[StudentRosterItem]:
    return service.list_students(db, principal)


@router.get("/sections", response_model=list[ClassSectionSummary])
def class_sections(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> list[ClassSectionSummary]:
    return service.list_class_sections(db, principal)


@router.get("/sections/{section_id}/students", response_model=list[RosterStudentItem])
def section_roster(
    section_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[RosterStudentItem]:
    return service.list_section_students(db, principal, section_id)


@router.get("/students/{student_id}", response_model=StudentProfile)
def student_profile(
    student_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> StudentProfile:
    return service.get_student_profile(db, principal, student_id)


@router.get("/teachers/pending", response_model=list[PendingTeacher])
def pending_teachers(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> list[PendingTeacher]:
    return service.list_pending_teachers(db, principal)


@router.post("/teachers/{teacher_id}/approve", response_model=ApprovalResult)
def approve_teacher(
    teacher_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.approve_teacher(db, principal, teacher_id)


@router.post("/teachers/{teacher_id}/reject", response_model=ApprovalResult)
def reject_teacher(
    teacher_id: uuid.UUID,
    payload: RejectIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.reject_teacher(db, principal, teacher_id, payload.reason)

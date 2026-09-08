import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_principal
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.principal import service
from backend.principal.schemas import (
    ApprovalResult,
    PendingTeacher,
    PrincipalStats,
    RejectIn,
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

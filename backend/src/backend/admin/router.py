import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.admin import service
from backend.admin.schemas import (
    AdminStats,
    ApprovalResult,
    PendingPrincipal,
    RejectIn,
    SchoolPrincipalStatus,
)
from backend.auth.dependencies import require_admin
from backend.db.models import Teacher
from backend.db.session import get_db

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/stats", response_model=AdminStats)
def stats(db: Session = Depends(get_db)) -> AdminStats:
    return service.get_stats(db)


@router.get("/principals/pending", response_model=list[PendingPrincipal])
def pending_principals(db: Session = Depends(get_db)) -> list[PendingPrincipal]:
    return service.list_pending_principals(db)


@router.get("/schools", response_model=list[SchoolPrincipalStatus])
def schools(db: Session = Depends(get_db)) -> list[SchoolPrincipalStatus]:
    return service.list_schools(db)


@router.post("/principals/{principal_id}/approve", response_model=ApprovalResult)
def approve_principal(
    principal_id: uuid.UUID,
    admin: Teacher = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.approve_principal(db, admin, principal_id)


@router.post("/principals/{principal_id}/reject", response_model=ApprovalResult)
def reject_principal(
    principal_id: uuid.UUID,
    payload: RejectIn,
    admin: Teacher = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.reject_principal(db, admin, principal_id, payload.reason)

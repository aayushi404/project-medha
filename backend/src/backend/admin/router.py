import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.admin import service
from backend.admin.schemas import (
    ActivityItem,
    AdminStats,
    ApprovalResult,
    DistrictSummary,
    PendingPrincipal,
    PrincipalListItem,
    RejectIn,
    SchoolDetail,
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


@router.get("/principals", response_model=list[PrincipalListItem])
def principals(
    approval_status: Literal["pending", "approved", "rejected"] | None = Query(default=None),
    q: str | None = Query(default=None, max_length=100),
    db: Session = Depends(get_db),
) -> list[PrincipalListItem]:
    return service.list_principals(db, approval_status, q)


@router.get("/schools", response_model=list[SchoolPrincipalStatus])
def schools(
    q: str | None = Query(default=None, max_length=100),
    district_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[SchoolPrincipalStatus]:
    return service.list_schools(db, q, district_id)


@router.get("/schools/{school_id}", response_model=SchoolDetail)
def school_detail(school_id: uuid.UUID, db: Session = Depends(get_db)) -> SchoolDetail:
    return service.get_school(db, school_id)


@router.get("/districts", response_model=list[DistrictSummary])
def districts(db: Session = Depends(get_db)) -> list[DistrictSummary]:
    return service.list_districts(db)


@router.get("/activity", response_model=list[ActivityItem])
def activity(
    limit: int = Query(default=50, ge=1, le=200), db: Session = Depends(get_db)
) -> list[ActivityItem]:
    return service.list_activity(db, limit)


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


@router.post("/principals/{principal_id}/revoke", response_model=ApprovalResult)
def revoke_principal(
    principal_id: uuid.UUID,
    payload: RejectIn,
    admin: Teacher = Depends(require_admin),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.revoke_principal(db, admin, principal_id, payload.reason)

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.admin.schemas import (
    AdminStats,
    ApprovalResult,
    PendingPrincipal,
    SchoolPrincipalStatus,
)
from backend.approvals import service as approvals
from backend.db.models import District, School, Teacher


def get_stats(db: Session) -> AdminStats:
    def _count(*filters) -> int:
        return db.query(func.count(Teacher.id)).filter(*filters).scalar() or 0

    return AdminStats(
        schools=db.query(func.count(School.id)).scalar() or 0,
        principals=_count(Teacher.role == "principal", Teacher.approval_status == "approved"),
        teachers=_count(Teacher.role == "teacher", Teacher.approval_status == "approved"),
        pending_principals=_count(
            Teacher.role == "principal", Teacher.approval_status == "pending"
        ),
    )


def list_pending_principals(db: Session) -> list[PendingPrincipal]:
    rows = (
        db.query(Teacher, School.name, District.name)
        .join(School, Teacher.school_id == School.id)
        .join(District, School.district_id == District.id)
        .filter(Teacher.role == "principal", Teacher.approval_status == "pending")
        .order_by(Teacher.created_at)
        .all()
    )
    return [
        PendingPrincipal(
            id=t.id,
            full_name=t.full_name,
            email=t.email,
            mobile_number=t.phone_number,
            qualification=t.qualification,
            school_id=t.school_id,
            school_name=school_name,
            district_name=district_name,
            applied_at=t.created_at,
        )
        for t, school_name, district_name in rows
    ]


def list_schools(db: Session) -> list[SchoolPrincipalStatus]:
    school_rows = (
        db.query(School, District.name)
        .join(District, School.district_id == District.id)
        .order_by(School.name)
        .all()
    )
    # one representative principal per school: an approved one if present,
    # otherwise the most recent applicant
    principals = (
        db.query(Teacher)
        .filter(Teacher.role == "principal", Teacher.school_id.isnot(None))
        .order_by(
            (Teacher.approval_status == "approved").desc(), Teacher.created_at.desc()
        )
        .all()
    )
    by_school: dict[uuid.UUID, Teacher] = {}
    for p in principals:
        by_school.setdefault(p.school_id, p)

    out: list[SchoolPrincipalStatus] = []
    for school, district_name in school_rows:
        p = by_school.get(school.id)
        out.append(
            SchoolPrincipalStatus(
                school_id=school.id,
                school_name=school.name,
                district_name=district_name,
                principal_name=p.full_name if p else None,
                principal_email=p.email if p else None,
                principal_status=p.approval_status if p else None,
            )
        )
    return out


def _get_principal(db: Session, principal_id: uuid.UUID) -> Teacher:
    principal = db.get(Teacher, principal_id)
    if principal is None or principal.role != "principal":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Principal application not found.")
    return principal


def approve_principal(
    db: Session, admin: Teacher, principal_id: uuid.UUID
) -> ApprovalResult:
    principal = _get_principal(db, principal_id)
    updated = approvals.approve(db, actor=admin, subject=principal)
    return ApprovalResult(id=updated.id, approval_status=updated.approval_status)


def reject_principal(
    db: Session, admin: Teacher, principal_id: uuid.UUID, reason: str
) -> ApprovalResult:
    principal = _get_principal(db, principal_id)
    updated = approvals.reject(db, actor=admin, subject=principal, reason=reason)
    return ApprovalResult(id=updated.id, approval_status=updated.approval_status)

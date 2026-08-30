import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.approvals import service as approvals
from backend.approvals.schemas import ApprovalResult
from backend.db.models import Teacher
from backend.principal.schemas import PendingTeacher, PrincipalStats, TeacherRosterItem


def _school_id(principal: Teacher) -> uuid.UUID:
    if principal.school_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Your account isn't linked to a school."
        )
    return principal.school_id


def get_stats(db: Session, principal: Teacher) -> PrincipalStats:
    school_id = _school_id(principal)

    def _count(*extra) -> int:
        return (
            db.query(func.count(Teacher.id))
            .filter(Teacher.role == "teacher", Teacher.school_id == school_id, *extra)
            .scalar()
            or 0
        )

    return PrincipalStats(
        teachers=_count(Teacher.approval_status == "approved"),
        pending_teachers=_count(Teacher.approval_status == "pending"),
    )


def list_pending_teachers(db: Session, principal: Teacher) -> list[PendingTeacher]:
    school_id = _school_id(principal)
    rows = (
        db.query(Teacher)
        .filter(
            Teacher.role == "teacher",
            Teacher.school_id == school_id,
            Teacher.approval_status == "pending",
        )
        .order_by(Teacher.created_at)
        .all()
    )
    return [
        PendingTeacher(
            id=t.id,
            full_name=t.full_name,
            email=t.email,
            mobile_number=t.phone_number,
            employee_code=t.employee_code,
            years_of_experience=t.years_of_experience,
            qualification=t.qualification,
            applied_at=t.created_at,
        )
        for t in rows
    ]


def list_teachers(db: Session, principal: Teacher) -> list[TeacherRosterItem]:
    school_id = _school_id(principal)
    rows = (
        db.query(Teacher)
        .filter(
            Teacher.role == "teacher",
            Teacher.school_id == school_id,
            Teacher.approval_status == "approved",
        )
        .order_by(Teacher.full_name)
        .all()
    )
    return [
        TeacherRosterItem(
            id=t.id,
            full_name=t.full_name,
            email=t.email,
            mobile_number=t.phone_number,
            employee_code=t.employee_code,
            years_of_experience=t.years_of_experience,
            approved_at=t.approved_at,
        )
        for t in rows
    ]


def _get_scoped_teacher(
    db: Session, principal: Teacher, teacher_id: uuid.UUID
) -> Teacher:
    """Load a teacher only if they belong to this principal's school. A
    principal passing another school's teacher id gets a plain 404 -- scoping
    lives here in the service, not the router, so it can't be forgotten."""
    school_id = _school_id(principal)
    teacher = db.get(Teacher, teacher_id)
    if (
        teacher is None
        or teacher.role != "teacher"
        or teacher.school_id != school_id
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher application not found.")
    return teacher


def approve_teacher(
    db: Session, principal: Teacher, teacher_id: uuid.UUID
) -> ApprovalResult:
    teacher = _get_scoped_teacher(db, principal, teacher_id)
    updated = approvals.approve(db, actor=principal, subject=teacher)
    return ApprovalResult(id=updated.id, approval_status=updated.approval_status)


def reject_teacher(
    db: Session, principal: Teacher, teacher_id: uuid.UUID, reason: str
) -> ApprovalResult:
    teacher = _get_scoped_teacher(db, principal, teacher_id)
    updated = approvals.reject(db, actor=principal, subject=teacher, reason=reason)
    return ApprovalResult(id=updated.id, approval_status=updated.approval_status)

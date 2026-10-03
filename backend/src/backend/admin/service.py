import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session, aliased

from backend.admin.schemas import (
    ActivityItem,
    AdminStats,
    ApprovalResult,
    DistrictSummary,
    PendingPrincipal,
    PrincipalListItem,
    SchoolDetail,
    SchoolPrincipalStatus,
    SchoolStaffMember,
)
from backend.approvals import service as approvals
from backend.db.models import (
    ApprovalEvent,
    AttendanceRecord,
    AuthSession,
    Block,
    ClassSection,
    District,
    School,
    Student,
    Teacher,
)


def _count(db: Session, model, *filters) -> int:
    return db.query(func.count(model.id)).filter(*filters).scalar() or 0


def _principals_by_school(db: Session) -> dict[uuid.UUID, Teacher]:
    """One representative principal per school: an approved one if present,
    otherwise the most recent applicant."""
    principals = (
        db.query(Teacher)
        .filter(Teacher.role == "principal", Teacher.school_id.isnot(None))
        .order_by((Teacher.approval_status == "approved").desc(), Teacher.created_at.desc())
        .all()
    )
    by_school: dict[uuid.UUID, Teacher] = {}
    for p in principals:
        by_school.setdefault(p.school_id, p)
    return by_school


def _approved_principal_school_ids(db: Session) -> set[uuid.UUID]:
    rows = (
        db.query(Teacher.school_id)
        .filter(
            Teacher.role == "principal",
            Teacher.approval_status == "approved",
            Teacher.school_id.isnot(None),
        )
        .all()
    )
    return {r[0] for r in rows}


def _attendance_today_pct(db: Session, *student_filters) -> float | None:
    """% of today's marked attendance that is 'present' (None if none marked).
    `student_filters` narrow it (e.g. to one school) via a join on students."""
    q = db.query(
        func.count(AttendanceRecord.id),
        func.sum(case((AttendanceRecord.status == "present", 1), else_=0)),
    ).filter(AttendanceRecord.attendance_date == date.today())
    if student_filters:
        q = q.join(Student, Student.id == AttendanceRecord.student_id).filter(*student_filters)
    total, present = q.one()
    if not total:
        return None
    return round(100 * (present or 0) / total, 1)


def get_stats(db: Session) -> AdminStats:
    school_total = _count(db, School)
    with_principal = _approved_principal_school_ids(db)
    return AdminStats(
        schools=school_total,
        districts=_count(db, District),
        principals=_count(
            db, Teacher, Teacher.role == "principal", Teacher.approval_status == "approved"
        ),
        teachers=_count(
            db, Teacher, Teacher.role == "teacher", Teacher.approval_status == "approved"
        ),
        students=_count(db, Student, Student.approval_status == "approved"),
        pending_principals=_count(
            db, Teacher, Teacher.role == "principal", Teacher.approval_status == "pending"
        ),
        schools_without_principal=max(school_total - len(with_principal), 0),
        attendance_today_pct=_attendance_today_pct(db),
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


def list_principals(
    db: Session, approval_status: str | None, q: str | None
) -> list[PrincipalListItem]:
    query = (
        db.query(Teacher, School.name, District.name)
        .outerjoin(School, Teacher.school_id == School.id)
        .outerjoin(District, School.district_id == District.id)
        .filter(Teacher.role == "principal")
    )
    if approval_status:
        query = query.filter(Teacher.approval_status == approval_status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(
            Teacher.full_name.ilike(like) | Teacher.email.ilike(like) | School.name.ilike(like)
        )
    rows = query.order_by(Teacher.created_at.desc()).all()
    return [
        PrincipalListItem(
            id=t.id,
            full_name=t.full_name,
            email=t.email,
            mobile_number=t.phone_number,
            qualification=t.qualification,
            school_id=t.school_id,
            school_name=school_name,
            district_name=district_name,
            approval_status=t.approval_status,
            rejection_reason=t.rejection_reason,
            email_verified=t.email_verified_at is not None,
            applied_at=t.created_at,
            decided_at=t.approved_at,
        )
        for t, school_name, district_name in rows
    ]


def list_schools(
    db: Session, q: str | None = None, district_id: uuid.UUID | None = None
) -> list[SchoolPrincipalStatus]:
    query = db.query(School, District.name).join(District, School.district_id == District.id)
    if district_id:
        query = query.filter(School.district_id == district_id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(School.name.ilike(like) | School.udise_code.ilike(like))
    school_rows = query.order_by(School.name).all()

    teacher_counts = dict(
        db.query(Teacher.school_id, func.count(Teacher.id))
        .filter(Teacher.role == "teacher", Teacher.approval_status == "approved")
        .group_by(Teacher.school_id)
        .all()
    )
    student_counts = dict(
        db.query(Student.school_id, func.count(Student.id))
        .filter(Student.approval_status == "approved")
        .group_by(Student.school_id)
        .all()
    )
    by_school = _principals_by_school(db)

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
                teacher_count=teacher_counts.get(school.id, 0),
                student_count=student_counts.get(school.id, 0),
            )
        )
    return out


def get_school(db: Session, school_id: uuid.UUID) -> SchoolDetail:
    row = (
        db.query(School, District.name, Block.name)
        .join(District, School.district_id == District.id)
        .outerjoin(Block, School.block_id == Block.id)
        .filter(School.id == school_id)
        .one_or_none()
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found.")
    school, district_name, block_name = row

    staff = (
        db.query(Teacher)
        .filter(Teacher.school_id == school_id, Teacher.role.in_(("principal", "teacher")))
        .order_by((Teacher.role == "principal").desc(), Teacher.full_name)
        .all()
    )
    return SchoolDetail(
        school_id=school.id,
        school_name=school.name,
        udise_code=school.udise_code,
        school_type=school.school_type,
        medium_of_instruction=school.medium_of_instruction,
        district_name=district_name,
        block_name=block_name,
        class_count=_count(db, ClassSection, ClassSection.school_id == school_id),
        student_count=_count(
            db, Student, Student.school_id == school_id, Student.approval_status == "approved"
        ),
        pending_student_count=_count(
            db, Student, Student.school_id == school_id, Student.approval_status == "pending"
        ),
        attendance_today_pct=_attendance_today_pct(db, Student.school_id == school_id),
        staff=[
            SchoolStaffMember(
                id=t.id,
                full_name=t.full_name,
                email=t.email,
                role=t.role,
                approval_status=t.approval_status,
                qualification=t.qualification,
            )
            for t in staff
        ],
    )


def list_districts(db: Session) -> list[DistrictSummary]:
    districts = db.query(District).order_by(District.name).all()
    school_district = {sid: did for sid, did in db.query(School.id, School.district_id).all()}
    with_principal = _approved_principal_school_ids(db)

    def _by_district(rows) -> dict[uuid.UUID, int]:
        out: dict[uuid.UUID, int] = {}
        for school_id, n in rows:
            did = school_district.get(school_id)
            if did is not None:
                out[did] = out.get(did, 0) + n
        return out

    teachers = _by_district(
        db.query(Teacher.school_id, func.count(Teacher.id))
        .filter(Teacher.role == "teacher", Teacher.approval_status == "approved")
        .group_by(Teacher.school_id)
        .all()
    )
    students = _by_district(
        db.query(Student.school_id, func.count(Student.id))
        .filter(Student.approval_status == "approved")
        .group_by(Student.school_id)
        .all()
    )
    pending = _by_district(
        db.query(Teacher.school_id, func.count(Teacher.id))
        .filter(Teacher.role == "principal", Teacher.approval_status == "pending")
        .group_by(Teacher.school_id)
        .all()
    )

    out: list[DistrictSummary] = []
    for d in districts:
        ids = [sid for sid, did in school_district.items() if did == d.id]
        out.append(
            DistrictSummary(
                district_id=d.id,
                district_name=d.name,
                schools=len(ids),
                schools_without_principal=sum(1 for sid in ids if sid not in with_principal),
                teachers=teachers.get(d.id, 0),
                students=students.get(d.id, 0),
                pending_principals=pending.get(d.id, 0),
            )
        )
    return out


def list_activity(db: Session, limit: int = 50) -> list[ActivityItem]:
    actor = aliased(Teacher)
    subject_teacher = aliased(Teacher)
    rows = (
        db.query(ApprovalEvent, actor.full_name, subject_teacher, Student)
        .join(actor, ApprovalEvent.actor_user_id == actor.id)
        .outerjoin(subject_teacher, ApprovalEvent.subject_user_id == subject_teacher.id)
        .outerjoin(Student, ApprovalEvent.subject_student_id == Student.id)
        .order_by(ApprovalEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    school_ids = {
        (t or s).school_id for _, _, t, s in rows if (t or s) is not None and (t or s).school_id
    }
    school_names = (
        dict(db.query(School.id, School.name).filter(School.id.in_(school_ids)).all())
        if school_ids
        else {}
    )

    out: list[ActivityItem] = []
    for event, actor_name, t, s in rows:
        subject = t if t is not None else s
        if subject is None:
            continue
        out.append(
            ActivityItem(
                id=event.id,
                action=event.action,
                subject_name=subject.full_name,
                subject_role=subject.role,
                actor_name=actor_name,
                school_name=school_names.get(subject.school_id),
                reason=event.reason,
                created_at=event.created_at,
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


def revoke_principal(
    db: Session, admin: Teacher, principal_id: uuid.UUID, reason: str
) -> ApprovalResult:
    """Withdraw an approved principal's access (e.g. they left the school):
    flips them to 'rejected', ends their live sessions and logs a 'revoked'
    event, which frees the school's single principal seat."""
    principal = _get_principal(db, principal_id)
    if principal.approval_status != "approved":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only an approved principal can be revoked."
        )
    principal.approval_status = "rejected"
    principal.rejection_reason = reason
    principal.approved_by = None
    principal.approved_at = None
    db.add(
        ApprovalEvent(
            subject_user_id=principal.id,
            actor_user_id=admin.id,
            action="revoked",
            reason=reason,
        )
    )
    db.query(AuthSession).filter(
        AuthSession.teacher_id == principal.id, AuthSession.revoked_at.is_(None)
    ).update({AuthSession.revoked_at: datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()
    return ApprovalResult(id=principal.id, approval_status=principal.approval_status)

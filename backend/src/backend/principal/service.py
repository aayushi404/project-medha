import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.approvals import service as approvals
from backend.approvals.schemas import ApprovalResult
from backend.db.models import (
    AcademicYear,
    ClassSection,
    Grade,
    Student,
    StudentEnrollment,
    Teacher,
)
from backend.principal.schemas import (
    ClassSectionSummary,
    PendingTeacher,
    PrincipalStats,
    RosterStudentItem,
    StudentProfile,
    StudentRosterItem,
    TeacherRosterItem,
)


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

    def _count_role(role: str, *extra) -> int:
        return (
            db.query(func.count(Teacher.id))
            .filter(Teacher.role == role, Teacher.school_id == school_id, *extra)
            .scalar()
            or 0
        )

    return PrincipalStats(
        teachers=_count(Teacher.approval_status == "approved"),
        pending_teachers=_count(Teacher.approval_status == "pending"),
        students=_count_role("student", Teacher.approval_status == "approved"),
        pending_students=_count_role("student", Teacher.approval_status == "pending"),
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


def list_students(db: Session, principal: Teacher) -> list[StudentRosterItem]:
    """Every approved student at the principal's school, across all grades --
    used by school-wide pickers (e.g. logging a fee payment) that a single
    teacher's own `/teacher/students` roster can't cover."""
    school_id = _school_id(principal)
    rows = (
        db.query(Teacher, Grade.label)
        .join(Grade, Teacher.grade_id == Grade.id)
        .filter(
            Teacher.role == "student",
            Teacher.school_id == school_id,
            Teacher.approval_status == "approved",
        )
        .order_by(Grade.numeric_level, Teacher.roll_number, Teacher.full_name)
        .all()
    )
    return [
        StudentRosterItem(
            id=s.id,
            full_name=s.full_name,
            grade_id=s.grade_id,
            grade_label=grade_label,
            roll_number=s.roll_number,
            email=s.email,
            activated=s.email is not None,
            approved_at=s.approved_at,
        )
        for s, grade_label in rows
    ]


def list_class_sections(db: Session, principal: Teacher) -> list[ClassSectionSummary]:
    """The current academic year's sections at this school, each with a live
    headcount -- the landing grid for the "Classes" directory. A separate
    domain from `list_students` above: this reads the new school-records
    roster (`students`/`student_enrollments`), not the login-capable
    `teachers` rows with role='student'."""
    school_id = _school_id(principal)
    student_count = (
        db.query(func.count(StudentEnrollment.id))
        .filter(
            StudentEnrollment.class_section_id == ClassSection.id,
            StudentEnrollment.left_on.is_(None),
        )
        .correlate(ClassSection)
        .scalar_subquery()
    )
    rows = (
        db.query(ClassSection, Grade.label, student_count, Teacher.full_name)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .join(AcademicYear, ClassSection.academic_year_id == AcademicYear.id)
        .outerjoin(Teacher, ClassSection.class_teacher_id == Teacher.id)
        .filter(ClassSection.school_id == school_id, AcademicYear.is_current.is_(True))
        .order_by(Grade.numeric_level, ClassSection.section)
        .all()
    )
    return [
        ClassSectionSummary(
            id=section.id,
            grade_label=grade_label,
            section=section.section,
            student_count=count,
            class_teacher_name=teacher_name,
        )
        for section, grade_label, count, teacher_name in rows
    ]


def _get_scoped_section(db: Session, principal: Teacher, section_id: uuid.UUID) -> ClassSection:
    school_id = _school_id(principal)
    section = db.get(ClassSection, section_id)
    if section is None or section.school_id != school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found.")
    return section


def list_section_students(
    db: Session, principal: Teacher, section_id: uuid.UUID
) -> list[RosterStudentItem]:
    """A section's roster, ordered by roll number -- attendance isn't wired
    into this yet (see docs/phase-2/Medha-principal-dashboard.md build order
    step 7); this covers identity and enrolment only."""
    section = _get_scoped_section(db, principal, section_id)
    rows = (
        db.query(StudentEnrollment, Student)
        .join(Student, StudentEnrollment.student_id == Student.id)
        .filter(
            StudentEnrollment.class_section_id == section.id,
            StudentEnrollment.left_on.is_(None),
        )
        .order_by(StudentEnrollment.roll_number)
        .all()
    )
    return [
        RosterStudentItem(
            id=student.id,
            roll_number=enrollment.roll_number,
            full_name=student.full_name,
            guardian_name=student.guardian_name,
        )
        for enrollment, student in rows
    ]


def get_student_profile(
    db: Session, principal: Teacher, student_id: uuid.UUID
) -> StudentProfile:
    school_id = _school_id(principal)
    student = db.get(Student, student_id)
    if student is None or student.school_id != school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")

    row = (
        db.query(StudentEnrollment, ClassSection, Grade, AcademicYear, Teacher.full_name)
        .join(ClassSection, StudentEnrollment.class_section_id == ClassSection.id)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .join(AcademicYear, StudentEnrollment.academic_year_id == AcademicYear.id)
        .outerjoin(Teacher, ClassSection.class_teacher_id == Teacher.id)
        .filter(
            StudentEnrollment.student_id == student.id,
            StudentEnrollment.left_on.is_(None),
        )
        .order_by(AcademicYear.starts_on.desc())
        .first()
    )
    enrollment, section, grade, year, class_teacher_name = row if row else (None, None, None, None, None)

    return StudentProfile(
        id=student.id,
        full_name=student.full_name,
        admission_number=student.admission_number,
        status=student.status,
        grade_label=grade.label if grade else None,
        section=section.section if section else None,
        roll_number=enrollment.roll_number if enrollment else None,
        academic_year_label=year.label if year else None,
        class_teacher_name=class_teacher_name,
        guardian_name=student.guardian_name,
        guardian_relation=student.guardian_relation,
        guardian_phone=student.guardian_phone,
    )


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

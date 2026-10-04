import uuid
from datetime import date as date_

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.approvals import service as approvals
from backend.approvals.schemas import ApprovalResult
from backend.auth import service as auth_service
from backend.auth.schemas import ResetCodeOut
from backend.db.models import (
    AcademicYear,
    AttendanceRecord,
    ClassSection,
    Grade,
    Student,
    StudentEnrollment,
    Subject,
    Teacher,
    TeacherSubject,
    TeachingAssignment,
)
from backend.principal.schemas import (
    AcademicYearCreateIn,
    AcademicYearOut,
    ClassAttendanceSummary,
    ClassSectionCreateIn,
    ClassSectionSummary,
    ClassSectionUpdateIn,
    PendingTeacher,
    PrincipalStats,
    RosterStudentItem,
    SchoolAttendanceSummaryOut,
    StudentRosterItem,
    TeacherProfile,
    TeacherRosterItem,
    ReserveTeacherOut,
    TeachingAssignmentIn,
    TeachingAssignmentOut,
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

    def _count_students(*extra) -> int:
        return (
            db.query(func.count(Student.id))
            .filter(Student.school_id == school_id, *extra)
            .scalar()
            or 0
        )

    return PrincipalStats(
        teachers=_count(Teacher.approval_status == "approved"),
        pending_teachers=_count(Teacher.approval_status == "pending"),
        students=_count_students(Student.approval_status == "approved"),
        pending_students=_count_students(Student.approval_status == "pending"),
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


def _sections_taught_by(db: Session, teacher_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[str]]:
    assignments: dict[uuid.UUID, list[str]] = {tid: [] for tid in teacher_ids}
    if not teacher_ids:
        return assignments
    assignment_rows = (
        db.query(TeachingAssignment, Subject.name, Grade.label, ClassSection.section)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .join(ClassSection, TeachingAssignment.class_section_id == ClassSection.id)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .filter(TeachingAssignment.teacher_id.in_(teacher_ids), TeachingAssignment.role == "primary")
        .all()
    )
    for ta, subject_name, grade_label, section in assignment_rows:
        assignments[ta.teacher_id].append(f"{subject_name} - {grade_label} · {section}")
    return assignments


def _assignment_drawer_extras(
    db: Session, teacher_ids: list[uuid.UUID]
) -> dict[uuid.UUID, dict]:
    """Per-teacher display fields the assignment drawer needs: their primary
    subject, how many classes they're already involved with (teaching
    assignment or class teacher -- same union `core.section_access
    .teacher_section_ids` computes for one teacher, batched here for a whole
    roster), and which section (if any) they're already class teacher of."""
    extras: dict[uuid.UUID, dict] = {
        tid: {
            "primary_subject_name": None,
            "classes": set(),
            "class_teacher_of_section_id": None,
            "class_teacher_of_label": None,
        }
        for tid in teacher_ids
    }
    if not teacher_ids:
        return extras

    primary_rows = (
        db.query(TeacherSubject.teacher_id, Subject.name)
        .join(Subject, TeacherSubject.subject_id == Subject.id)
        .filter(TeacherSubject.teacher_id.in_(teacher_ids), TeacherSubject.is_primary.is_(True))
        .all()
    )
    for tid, subject_name in primary_rows:
        if extras[tid]["primary_subject_name"] is None:
            extras[tid]["primary_subject_name"] = subject_name

    assignment_rows = (
        db.query(TeachingAssignment.teacher_id, TeachingAssignment.class_section_id)
        .filter(TeachingAssignment.teacher_id.in_(teacher_ids), TeachingAssignment.role == "primary")
        .all()
    )
    for tid, section_id in assignment_rows:
        extras[tid]["classes"].add(section_id)

    homeroom_rows = (
        db.query(ClassSection, Grade.label)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .filter(ClassSection.class_teacher_id.in_(teacher_ids))
        .all()
    )
    for section, grade_label in homeroom_rows:
        tid = section.class_teacher_id
        extras[tid]["classes"].add(section.id)
        extras[tid]["class_teacher_of_section_id"] = section.id
        extras[tid]["class_teacher_of_label"] = f"{grade_label} · {section.section}"

    return extras


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
    teacher_ids = [t.id for t in rows]
    assignments = _sections_taught_by(db, teacher_ids)
    extras = _assignment_drawer_extras(db, teacher_ids)

    return [
        TeacherRosterItem(
            id=t.id,
            full_name=t.full_name,
            email=t.email,
            mobile_number=t.phone_number,
            employee_code=t.employee_code,
            years_of_experience=t.years_of_experience,
            approved_at=t.approved_at,
            photo_url=t.photo_url,
            sections_taught=assignments.get(t.id, []),
            primary_subject_name=extras[t.id]["primary_subject_name"],
            classes_count=len(extras[t.id]["classes"]),
            class_teacher_of_section_id=extras[t.id]["class_teacher_of_section_id"],
            class_teacher_of_label=extras[t.id]["class_teacher_of_label"],
        )
        for t in rows
    ]


def get_teacher_profile(db: Session, principal: Teacher, teacher_id: uuid.UUID) -> TeacherProfile:
    teacher = _get_scoped_teacher(db, principal, teacher_id)
    sections_taught = _sections_taught_by(db, [teacher.id])[teacher.id]
    return TeacherProfile(
        id=teacher.id,
        full_name=teacher.full_name,
        email=teacher.email,
        mobile_number=teacher.phone_number,
        employee_code=teacher.employee_code,
        years_of_experience=teacher.years_of_experience,
        qualification=teacher.qualification,
        approval_status=teacher.approval_status,
        approved_at=teacher.approved_at,
        photo_url=teacher.photo_url,
        sections_taught=sections_taught,
    )


def list_students(db: Session, principal: Teacher) -> list[StudentRosterItem]:
    """Every approved student at the principal's school, across all grades --
    used by school-wide pickers (e.g. logging a fee payment) that a single
    teacher's own `/teacher/students` roster can't cover."""
    # Note: this is now structurally close to `list_class_sections`/
    # `list_section_students` below, which read the newer `students`/
    # `student_enrollments` roster directly -- a good candidate to merge in a
    # later, isolated pass, not alongside everything else moving here.
    school_id = _school_id(principal)
    rows = (
        db.query(
            Student,
            ClassSection.id,
            ClassSection.grade_id,
            Grade.label,
            ClassSection.section,
            StudentEnrollment.roll_number,
        )
        .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
        .join(ClassSection, StudentEnrollment.class_section_id == ClassSection.id)
        .join(AcademicYear, StudentEnrollment.academic_year_id == AcademicYear.id)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .filter(
            Student.school_id == school_id,
            Student.approval_status == "approved",
            StudentEnrollment.left_on.is_(None),
            AcademicYear.is_current.is_(True),
        )
        .order_by(Grade.numeric_level, ClassSection.section, StudentEnrollment.roll_number, Student.full_name)
        .all()
    )
    return [
        StudentRosterItem(
            id=s.id,
            full_name=s.full_name,
            class_section_id=class_section_id,
            grade_id=grade_id,
            grade_label=grade_label,
            section=section,
            roll_number=roll_number,
            login_phone=s.phone_number,
            approved_at=s.approved_at,
            photo_url=s.photo_url,
        )
        for s, class_section_id, grade_id, grade_label, section, roll_number in rows
    ]


def _resolve_year(
    db: Session, school_id: uuid.UUID, academic_year_id: uuid.UUID | None
) -> AcademicYear | None:
    """The year to scope sections to: the one explicitly asked for (must
    belong to this school), or else the school's current year."""
    if academic_year_id is not None:
        year = db.get(AcademicYear, academic_year_id)
        if year is None or year.school_id != school_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Academic year not found.")
        return year
    return (
        db.query(AcademicYear)
        .filter(AcademicYear.school_id == school_id, AcademicYear.is_current.is_(True))
        .first()
    )


def list_class_sections(
    db: Session, principal: Teacher, academic_year_id: uuid.UUID | None = None
) -> list[ClassSectionSummary]:
    """A school year's sections, each with a live headcount -- the landing
    grid for the "Classes" directory. Defaults to the current academic year;
    pass `academic_year_id` to browse a past/other year. A separate domain
    from `list_students` above: this reads the new school-records roster
    (`students`/`student_enrollments`), not the login-capable `teachers` rows
    with role='student'."""
    school_id = _school_id(principal)
    year = _resolve_year(db, school_id, academic_year_id)
    if year is None:
        return []

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
        .outerjoin(Teacher, ClassSection.class_teacher_id == Teacher.id)
        .filter(ClassSection.school_id == school_id, ClassSection.academic_year_id == year.id)
        .order_by(Grade.numeric_level, ClassSection.section)
        .all()
    )
    return [
        ClassSectionSummary(
            id=section.id,
            grade_label=grade_label,
            section=section.section,
            academic_year_label=year.label,
            student_count=count,
            class_teacher_id=section.class_teacher_id,
            class_teacher_name=teacher_name,
        )
        for section, grade_label, count, teacher_name in rows
    ]


def get_class_section(db: Session, principal: Teacher, section_id: uuid.UUID) -> ClassSectionSummary:
    section = _get_scoped_section(db, principal, section_id)
    return _class_section_out(db, section)


def _class_section_out(db: Session, section: ClassSection) -> ClassSectionSummary:
    grade = db.get(Grade, section.grade_id)
    year = db.get(AcademicYear, section.academic_year_id)
    count = (
        db.query(func.count(StudentEnrollment.id))
        .filter(
            StudentEnrollment.class_section_id == section.id,
            StudentEnrollment.left_on.is_(None),
        )
        .scalar()
        or 0
    )
    teacher = db.get(Teacher, section.class_teacher_id) if section.class_teacher_id else None
    return ClassSectionSummary(
        id=section.id,
        grade_label=grade.label if grade else "",
        section=section.section,
        academic_year_label=year.label if year else "",
        student_count=count,
        class_teacher_id=section.class_teacher_id,
        class_teacher_name=teacher.full_name if teacher else None,
    )


def list_academic_years(db: Session, principal: Teacher) -> list[AcademicYearOut]:
    school_id = _school_id(principal)
    rows = (
        db.query(AcademicYear)
        .filter(AcademicYear.school_id == school_id)
        .order_by(AcademicYear.starts_on.desc())
        .all()
    )
    return [
        AcademicYearOut(
            id=y.id, label=y.label, starts_on=y.starts_on, ends_on=y.ends_on, is_current=y.is_current
        )
        for y in rows
    ]


def create_academic_year(
    db: Session, principal: Teacher, payload: AcademicYearCreateIn
) -> AcademicYearOut:
    school_id = _school_id(principal)

    existing = (
        db.query(AcademicYear)
        .filter(AcademicYear.school_id == school_id, AcademicYear.label == payload.label)
        .first()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An academic year with this label already exists.")

    if payload.set_current:
        db.query(AcademicYear).filter(
            AcademicYear.school_id == school_id, AcademicYear.is_current.is_(True)
        ).update({AcademicYear.is_current: False}, synchronize_session=False)

    year = AcademicYear(
        school_id=school_id,
        label=payload.label,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
        is_current=payload.set_current,
    )
    db.add(year)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An academic year with this label already exists."
        ) from exc
    db.refresh(year)
    return AcademicYearOut(
        id=year.id, label=year.label, starts_on=year.starts_on, ends_on=year.ends_on, is_current=year.is_current
    )


def create_class_section(
    db: Session, principal: Teacher, payload: ClassSectionCreateIn
) -> ClassSectionSummary:
    school_id = _school_id(principal)

    year = _resolve_year(db, school_id, payload.academic_year_id)
    if year is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Set up an academic year for your school first."
        )
    if db.get(Grade, payload.grade_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Grade not found.")

    existing = (
        db.query(ClassSection)
        .filter(
            ClassSection.school_id == school_id,
            ClassSection.academic_year_id == year.id,
            ClassSection.grade_id == payload.grade_id,
            ClassSection.section == payload.section,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This section already exists.")

    section = ClassSection(
        school_id=school_id,
        academic_year_id=year.id,
        grade_id=payload.grade_id,
        section=payload.section,
    )
    db.add(section)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This section already exists.") from exc
    db.refresh(section)
    return _class_section_out(db, section)


def _teaches_section(db: Session, teacher_id: uuid.UUID, section_id: uuid.UUID) -> bool:
    return (
        db.query(TeachingAssignment.id)
        .filter(
            TeachingAssignment.teacher_id == teacher_id,
            TeachingAssignment.class_section_id == section_id,
            TeachingAssignment.role == "primary",
        )
        .first()
        is not None
    )


def _release_class_teacher_if_not_teaching(db: Session, section: ClassSection) -> None:
    """A class teacher must teach at least one subject in their class. When a
    subject change leaves them teaching nothing there, the class teacher seat
    is released rather than left pointing at someone who isn't in the class."""
    db.flush()  # the check must see this request's own deletes and reassignments
    if section.class_teacher_id and not _teaches_section(db, section.class_teacher_id, section.id):
        section.class_teacher_id = None


def update_class_section(
    db: Session, principal: Teacher, section_id: uuid.UUID, payload: ClassSectionUpdateIn
) -> ClassSectionSummary:
    section = _get_scoped_section(db, principal, section_id)
    school_id = _school_id(principal)

    if payload.class_teacher_id is not None:
        teacher = db.get(Teacher, payload.class_teacher_id)
        if (
            teacher is None
            or teacher.role != "teacher"
            or teacher.school_id != school_id
            or teacher.approval_status != "approved"
        ):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher not found.")
        if not _teaches_section(db, payload.class_teacher_id, section.id):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"{teacher.full_name} doesn't teach any subject in "
                f"{db.get(Grade, section.grade_id).label} · {section.section} yet. "
                "Assign them a subject here first.",
            )

        # A teacher may be class teacher of only one section (see
        # idx_one_section_per_class_teacher) -- clear any other section
        # they're currently on so this reassignment doesn't hit that
        # constraint. The freed-up section shows "no class teacher" next
        # time it's fetched.
        db.query(ClassSection).filter(
            ClassSection.class_teacher_id == payload.class_teacher_id,
            ClassSection.id != section.id,
        ).update({ClassSection.class_teacher_id: None}, synchronize_session=False)

    section.class_teacher_id = payload.class_teacher_id
    db.commit()
    db.refresh(section)
    return _class_section_out(db, section)


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
            photo_url=student.photo_url,
        )
        for enrollment, student in rows
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


def issue_teacher_reset_code(db: Session, principal: Teacher, teacher_id: uuid.UUID) -> ResetCodeOut:
    """A teacher who can't log in (forgotten password, no email to reset by)
    gets a one-time code from their principal, read out in person."""
    teacher = _get_scoped_teacher(db, principal, teacher_id)
    return auth_service.issue_reset_code(db, principal, teacher)


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


def _teaching_assignment_out(
    db: Session, assignment: TeachingAssignment
) -> TeachingAssignmentOut:
    row = (
        db.query(Teacher.full_name, Grade.label, ClassSection.section, Subject.name)
        .select_from(TeachingAssignment)
        .join(Teacher, TeachingAssignment.teacher_id == Teacher.id)
        .join(ClassSection, TeachingAssignment.class_section_id == ClassSection.id)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .filter(TeachingAssignment.id == assignment.id)
        .one()
    )
    teacher_name, grade_label, section, subject_name = row
    return TeachingAssignmentOut(
        id=assignment.id,
        teacher_id=assignment.teacher_id,
        teacher_name=teacher_name,
        class_section_id=assignment.class_section_id,
        grade_label=grade_label,
        section=section,
        subject_id=assignment.subject_id,
        subject_name=subject_name,
    )


def list_section_teaching_assignments(
    db: Session, principal: Teacher, section_id: uuid.UUID
) -> list[TeachingAssignmentOut]:
    section = _get_scoped_section(db, principal, section_id)
    rows = (
        db.query(TeachingAssignment)
        .filter(TeachingAssignment.class_section_id == section.id, TeachingAssignment.role == "primary")
        .all()
    )
    return [_teaching_assignment_out(db, a) for a in rows]


def create_teaching_assignment(
    db: Session, principal: Teacher, payload: TeachingAssignmentIn
) -> TeachingAssignmentOut:
    school_id = _school_id(principal)
    section = db.get(ClassSection, payload.class_section_id)
    if section is None or section.school_id != school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found.")
    teacher = db.get(Teacher, payload.teacher_id)
    if teacher is None or teacher.role != "teacher" or teacher.school_id != school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher not found.")
    if db.get(Subject, payload.subject_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found.")

    existing = (
        db.query(TeachingAssignment)
        .filter(
            TeachingAssignment.teacher_id == payload.teacher_id,
            TeachingAssignment.class_section_id == payload.class_section_id,
            TeachingAssignment.subject_id == payload.subject_id,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This assignment already exists.")

    assignment = TeachingAssignment(
        teacher_id=payload.teacher_id,
        class_section_id=payload.class_section_id,
        subject_id=payload.subject_id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return _teaching_assignment_out(db, assignment)


def delete_teaching_assignment(
    db: Session, principal: Teacher, assignment_id: uuid.UUID
) -> None:
    school_id = _school_id(principal)
    assignment = db.get(TeachingAssignment, assignment_id)
    if assignment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found.")
    section = db.get(ClassSection, assignment.class_section_id)
    if section is None or section.school_id != school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found.")
    db.delete(assignment)
    _release_class_teacher_if_not_teaching(db, section)
    db.commit()


def set_subject_teacher(
    db: Session,
    principal: Teacher,
    section_id: uuid.UUID,
    subject_id: uuid.UUID,
    teacher_id: uuid.UUID | None,
) -> list[TeachingAssignmentOut]:
    """Assign, change, or clear (teacher_id=None) the one teacher who teaches
    `subject_id` in this section -- a single atomic call so the UI's "change
    teacher" dropdown never has to do a separate delete-then-create and risk
    landing on neither state if the second call fails."""
    section = _get_scoped_section(db, principal, section_id)
    school_id = _school_id(principal)
    if db.get(Subject, subject_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Subject not found.")

    existing = (
        db.query(TeachingAssignment)
        .filter(
            TeachingAssignment.class_section_id == section.id,
            TeachingAssignment.subject_id == subject_id,
        )
        .first()
    )

    if teacher_id is None:
        if existing is not None:
            db.delete(existing)
            _release_class_teacher_if_not_teaching(db, section)
            db.commit()
        return list_section_teaching_assignments(db, principal, section_id)

    teacher = db.get(Teacher, teacher_id)
    if (
        teacher is None
        or teacher.role != "teacher"
        or teacher.school_id != school_id
        or teacher.approval_status != "approved"
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher not found.")

    if existing is not None:
        existing.teacher_id = teacher_id
    else:
        db.add(
            TeachingAssignment(
                teacher_id=teacher_id, class_section_id=section.id, subject_id=subject_id
            )
        )

    _release_class_teacher_if_not_teaching(db, section)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This assignment already exists."
        ) from exc

    return list_section_teaching_assignments(db, principal, section_id)


def get_attendance_summary(
    db: Session,
    principal: Teacher,
    on_date: date_,
    academic_year_id: uuid.UUID | None = None,
) -> SchoolAttendanceSummaryOut:
    """Real attendance numbers for every class_section at the principal's
    school on `on_date`, plus a school-wide total -- the data behind the
    principal's Attendance page."""
    school_id = _school_id(principal)
    year = _resolve_year(db, school_id, academic_year_id)
    if year is None:
        return SchoolAttendanceSummaryOut(
            date=on_date,
            total_students=0,
            present_count=0,
            absent_count=0,
            unmarked_count=0,
            percentage=None,
            classes=[],
        )

    student_count = (
        db.query(func.count(StudentEnrollment.id))
        .filter(
            StudentEnrollment.class_section_id == ClassSection.id,
            StudentEnrollment.left_on.is_(None),
        )
        .correlate(ClassSection)
        .scalar_subquery()
    )
    section_rows = (
        db.query(ClassSection, Grade.label, student_count, Teacher.full_name)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .outerjoin(Teacher, ClassSection.class_teacher_id == Teacher.id)
        .filter(ClassSection.school_id == school_id, ClassSection.academic_year_id == year.id)
        .order_by(Grade.numeric_level, ClassSection.section)
        .all()
    )

    present_expr = func.sum(case((AttendanceRecord.status == "present", 1), else_=0))
    absent_expr = func.sum(case((AttendanceRecord.status == "absent", 1), else_=0))
    marked_rows = (
        db.query(StudentEnrollment.class_section_id, present_expr, absent_expr)
        .join(AttendanceRecord, AttendanceRecord.student_id == StudentEnrollment.student_id)
        .filter(
            StudentEnrollment.left_on.is_(None),
            StudentEnrollment.academic_year_id == year.id,
            AttendanceRecord.attendance_date == on_date,
        )
        .group_by(StudentEnrollment.class_section_id)
        .all()
    )
    marked_by_section = {sid: (present or 0, absent or 0) for sid, present, absent in marked_rows}

    classes: list[ClassAttendanceSummary] = []
    total_students = total_present = total_absent = 0
    for section, grade_label, count, teacher_name in section_rows:
        present, absent = marked_by_section.get(section.id, (0, 0))
        unmarked = max(0, count - present - absent)
        classes.append(
            ClassAttendanceSummary(
                class_section_id=section.id,
                grade_label=grade_label,
                section=section.section,
                class_teacher_name=teacher_name,
                total_students=count,
                present_count=present,
                absent_count=absent,
                unmarked_count=unmarked,
                percentage=round(present / count * 100, 1) if count else None,
            )
        )
        total_students += count
        total_present += present
        total_absent += absent

    return SchoolAttendanceSummaryOut(
        date=on_date,
        total_students=total_students,
        present_count=total_present,
        absent_count=total_absent,
        unmarked_count=max(0, total_students - total_present - total_absent),
        percentage=round(total_present / total_students * 100, 1) if total_students else None,
        classes=classes,
    )


# --- reserve teachers: on standby for any period in a class (daily cover) ---


def list_reserve_teachers(
    db: Session, principal: Teacher, section_id: uuid.UUID
) -> list[ReserveTeacherOut]:
    section = _get_scoped_section(db, principal, section_id)
    rows = (
        db.query(Teacher)
        .join(TeachingAssignment, TeachingAssignment.teacher_id == Teacher.id)
        .filter(TeachingAssignment.class_section_id == section.id, TeachingAssignment.role == "reserve")
        .order_by(Teacher.full_name)
        .all()
    )
    extras = _assignment_drawer_extras(db, [t.id for t in rows])
    return [
        ReserveTeacherOut(
            teacher_id=t.id,
            full_name=t.full_name,
            photo_url=t.photo_url,
            primary_subject_name=extras[t.id]["primary_subject_name"],
            classes_count=len(extras[t.id]["classes"]),
        )
        for t in rows
    ]


def add_reserve_teacher(
    db: Session, principal: Teacher, section_id: uuid.UUID, teacher_id: uuid.UUID
) -> list[ReserveTeacherOut]:
    section = _get_scoped_section(db, principal, section_id)
    school_id = _school_id(principal)
    teacher = db.get(Teacher, teacher_id)
    if (
        teacher is None
        or teacher.role != "teacher"
        or teacher.school_id != school_id
        or teacher.approval_status != "approved"
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher not found.")
    db.add(TeachingAssignment(teacher_id=teacher.id, class_section_id=section.id, role="reserve"))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"{teacher.full_name} is already a reserve here.") from exc
    return list_reserve_teachers(db, principal, section_id)


def remove_reserve_teacher(
    db: Session, principal: Teacher, section_id: uuid.UUID, teacher_id: uuid.UUID
) -> list[ReserveTeacherOut]:
    section = _get_scoped_section(db, principal, section_id)
    deleted = (
        db.query(TeachingAssignment)
        .filter(
            TeachingAssignment.class_section_id == section.id,
            TeachingAssignment.teacher_id == teacher_id,
            TeachingAssignment.role == "reserve",
        )
        .delete(synchronize_session=False)
    )
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reserve teacher not found.")
    db.commit()
    return list_reserve_teachers(db, principal, section_id)

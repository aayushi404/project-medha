"""Teacher-facing student approvals. A teacher only sees and decides on students
in the classes they actually teach: scoping is `student.school_id ==
teacher.school_id` and the student's current class's grade in the set of
grades the teacher is assigned to (`teacher_subjects`). A stray id from
another school -- or another class -- just 404s.

"Current class" is resolved via the student's `StudentEnrollment` for the
school's current academic year, not a denormalized column on `Student` --
this is the approval queue's only change from the pre-class_section design;
the *access rule* (grade + `teacher_subjects`) is unchanged.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.approvals import service as approvals
from backend.approvals.schemas import ApprovalResult
from backend.db.models import (
    AcademicYear,
    ClassSection,
    Grade,
    Student,
    StudentEnrollment,
    Subject,
    Teacher,
    TeacherSubject,
    TeachingAssignment,
)
from backend.teacher.schemas import (
    PendingStudent,
    StudentRosterItem,
    TeacherSectionOut,
    TeacherSectionSubjectOut,
    TeacherStudentStats,
)


def _school_id(teacher: Teacher) -> uuid.UUID:
    if teacher.school_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Your account isn't linked to a school."
        )
    return teacher.school_id


def _teacher_grade_ids(db: Session, teacher: Teacher) -> list[uuid.UUID]:
    """The distinct grades this teacher is assigned to teach. Empty if the
    teacher has no subject/grade pairs yet -- in that case they can see and
    approve no students until onboarding assigns them a class."""
    return [
        gid
        for (gid,) in db.query(TeacherSubject.grade_id)
        .filter(TeacherSubject.teacher_id == teacher.id)
        .distinct()
        .all()
    ]


def _current_enrollment_query(db: Session):
    """Student joined to their current-year, still-enrolled class placement.
    Every caller in this module filters this further. Selects `ClassSection.
    grade_id`, not `Student.grade_id` -- the latter is a deprecated, no-longer
    -written column (see student/service.py:register)."""
    return (
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
        .filter(StudentEnrollment.left_on.is_(None), AcademicYear.is_current.is_(True))
    )


def get_stats(db: Session, teacher: Teacher) -> TeacherStudentStats:
    school_id = _school_id(teacher)
    grade_ids = _teacher_grade_ids(db, teacher)
    if not grade_ids:
        return TeacherStudentStats(students=0, pending_students=0)

    def _count(status_value: str) -> int:
        return (
            _current_enrollment_query(db)
            .filter(
                Student.school_id == school_id,
                ClassSection.grade_id.in_(grade_ids),
                Student.approval_status == status_value,
            )
            .count()
        )

    return TeacherStudentStats(
        students=_count("approved"), pending_students=_count("pending")
    )


def _rows(
    db: Session,
    school_id: uuid.UUID,
    grade_ids: list[uuid.UUID],
    approval_status: str,
):
    if not grade_ids:
        return []
    return (
        _current_enrollment_query(db)
        .filter(
            Student.school_id == school_id,
            ClassSection.grade_id.in_(grade_ids),
            Student.approval_status == approval_status,
        )
        .order_by(Grade.numeric_level, ClassSection.section, StudentEnrollment.roll_number, Student.full_name)
        .all()
    )


def list_pending_students(db: Session, teacher: Teacher) -> list[PendingStudent]:
    school_id = _school_id(teacher)
    grade_ids = _teacher_grade_ids(db, teacher)
    return [
        PendingStudent(
            id=s.id,
            full_name=s.full_name,
            class_section_id=class_section_id,
            grade_id=grade_id,
            grade_label=grade_label,
            section=section,
            roll_number=roll_number,
            applied_at=s.created_at,
        )
        for s, class_section_id, grade_id, grade_label, section, roll_number in _rows(
            db, school_id, grade_ids, "pending"
        )
    ]


def list_students(db: Session, teacher: Teacher) -> list[StudentRosterItem]:
    school_id = _school_id(teacher)
    grade_ids = _teacher_grade_ids(db, teacher)
    return [
        StudentRosterItem(
            id=s.id,
            full_name=s.full_name,
            class_section_id=class_section_id,
            grade_id=grade_id,
            grade_label=grade_label,
            section=section,
            roll_number=roll_number,
            email=s.email,
            approved_at=s.approved_at,
            photo_url=s.photo_url,
        )
        for s, class_section_id, grade_id, grade_label, section, roll_number in _rows(
            db, school_id, grade_ids, "approved"
        )
    ]


def _get_scoped_student(
    db: Session, teacher: Teacher, student_id: uuid.UUID
) -> Student:
    school_id = _school_id(teacher)
    grade_ids = _teacher_grade_ids(db, teacher)
    student = db.get(Student, student_id)
    if student is None or student.school_id != school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student registration not found.")

    in_scope = (
        _current_enrollment_query(db)
        .filter(Student.id == student_id, ClassSection.grade_id.in_(grade_ids))
        .first()
        is not None
    )
    if not in_scope:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student registration not found.")
    return student


def approve_student(
    db: Session, teacher: Teacher, student_id: uuid.UUID
) -> ApprovalResult:
    student = _get_scoped_student(db, teacher, student_id)
    updated = approvals.approve(db, actor=teacher, subject=student)
    return ApprovalResult(id=updated.id, approval_status=updated.approval_status)


def reject_student(
    db: Session, teacher: Teacher, student_id: uuid.UUID, reason: str
) -> ApprovalResult:
    student = _get_scoped_student(db, teacher, student_id)
    updated = approvals.reject(db, actor=teacher, subject=student, reason=reason)
    return ApprovalResult(id=updated.id, approval_status=updated.approval_status)


def list_my_sections(db: Session, teacher: Teacher) -> list[TeacherSectionOut]:
    """Sections this teacher can act on: via a `teaching_assignments` row or
    being the section's class_teacher, current academic year only. Feeds the
    class picker on attendance/homework/report-card/OMR/notifications."""
    school_id = _school_id(teacher)

    assigned_ids = {
        sid
        for (sid,) in db.query(TeachingAssignment.class_section_id)
        .filter(TeachingAssignment.teacher_id == teacher.id)
        .distinct()
        .all()
    }
    class_teacher_ids = {
        sid
        for (sid,) in db.query(ClassSection.id)
        .filter(ClassSection.class_teacher_id == teacher.id)
        .all()
    }
    section_ids = assigned_ids | class_teacher_ids
    if not section_ids:
        return []

    rows = (
        db.query(ClassSection, Grade.label, AcademicYear.label)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .join(AcademicYear, ClassSection.academic_year_id == AcademicYear.id)
        .filter(
            ClassSection.id.in_(section_ids),
            ClassSection.school_id == school_id,
            AcademicYear.is_current.is_(True),
        )
        .order_by(Grade.numeric_level, ClassSection.section)
        .all()
    )

    subject_rows = (
        db.query(TeachingAssignment.class_section_id, Subject.id, Subject.name)
        .join(Subject, TeachingAssignment.subject_id == Subject.id)
        .filter(TeachingAssignment.teacher_id == teacher.id)
        .all()
    )
    subjects_by_section: dict[uuid.UUID, list[TeacherSectionSubjectOut]] = {}
    for sid, subject_id, name in subject_rows:
        subjects_by_section.setdefault(sid, []).append(
            TeacherSectionSubjectOut(id=subject_id, name=name)
        )

    return [
        TeacherSectionOut(
            id=section.id,
            grade_id=section.grade_id,
            grade_label=grade_label,
            section=section.section,
            academic_year_label=year_label,
            is_class_teacher=section.class_teacher_id == teacher.id,
            subjects=subjects_by_section.get(section.id, []),
        )
        for section, grade_label, year_label in rows
    ]

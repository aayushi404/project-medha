"""Teacher-facing student lists, class picker, and approvals.

A teacher works with the students of the classes (sections) they act on: a
`teaching_assignments` row for the section (any subject), or being its
`class_teacher`. That is the same rule as `assert_can_act_on_section` and the
class picker, so a teacher can see, approve and open every student in a class
they teach -- and nothing outside it. A stray id from another school or another
class just 404s.

"Current class" is resolved via the student's `StudentEnrollment` for the
school's current academic year, not a denormalized column on `Student`.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.approvals import service as approvals
from backend.approvals.schemas import ApprovalResult
from backend.auth import service as auth_service
from backend.auth.schemas import ResetCodeOut
from backend.core.section_access import (
    assert_is_class_teacher_of_section,
    current_enrollment,
    teacher_current_section_ids,
)
from backend.db.models import (
    AcademicYear,
    ClassSection,
    Grade,
    Student,
    StudentEnrollment,
    Subject,
    Teacher,
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


def _narrow(section_ids: set[uuid.UUID], class_section_id: uuid.UUID | None) -> set[uuid.UUID]:
    """The sections a list covers: all of the teacher's, or just the one asked
    for. Asking for a class they don't teach gives an empty list, not a leak."""
    if class_section_id is None:
        return section_ids
    return {class_section_id} & section_ids


def get_stats(db: Session, teacher: Teacher) -> TeacherStudentStats:
    school_id = _school_id(teacher)
    section_ids = teacher_current_section_ids(db, teacher)
    if not section_ids:
        return TeacherStudentStats(students=0, pending_students=0)

    def _count(status_value: str) -> int:
        return (
            _current_enrollment_query(db)
            .filter(
                Student.school_id == school_id,
                ClassSection.id.in_(section_ids),
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
    section_ids: set[uuid.UUID],
    approval_status: str,
):
    if not section_ids:
        return []
    return (
        _current_enrollment_query(db)
        .filter(
            Student.school_id == school_id,
            ClassSection.id.in_(section_ids),
            Student.approval_status == approval_status,
        )
        .order_by(Grade.numeric_level, ClassSection.section, StudentEnrollment.roll_number, Student.full_name)
        .all()
    )


def list_pending_students(
    db: Session, teacher: Teacher, class_section_id: uuid.UUID | None = None
) -> list[PendingStudent]:
    school_id = _school_id(teacher)
    section_ids = _narrow(teacher_current_section_ids(db, teacher), class_section_id)
    return [
        PendingStudent(
            id=s.id,
            full_name=s.full_name,
            class_section_id=class_section_id_,
            grade_id=grade_id,
            grade_label=grade_label,
            section=section,
            roll_number=roll_number,
            login_phone=s.phone_number,
            applied_at=s.created_at,
        )
        for s, class_section_id_, grade_id, grade_label, section, roll_number in _rows(
            db, school_id, section_ids, "pending"
        )
    ]


def list_students(
    db: Session, teacher: Teacher, class_section_id: uuid.UUID | None = None
) -> list[StudentRosterItem]:
    school_id = _school_id(teacher)
    section_ids = _narrow(teacher_current_section_ids(db, teacher), class_section_id)
    return [
        StudentRosterItem(
            id=s.id,
            full_name=s.full_name,
            class_section_id=class_section_id_,
            grade_id=grade_id,
            grade_label=grade_label,
            section=section,
            roll_number=roll_number,
            login_phone=s.phone_number,
            approved_at=s.approved_at,
            photo_url=s.photo_url,
        )
        for s, class_section_id_, grade_id, grade_label, section, roll_number in _rows(
            db, school_id, section_ids, "approved"
        )
    ]


def _get_scoped_student(
    db: Session, teacher: Teacher, student_id: uuid.UUID
) -> Student:
    """The student, if they're enrolled in a class this teacher acts on."""
    school_id = _school_id(teacher)
    student = db.get(Student, student_id)
    if student is None or student.school_id != school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student registration not found.")
    enrollment = current_enrollment(db, student)
    if enrollment is None or enrollment.class_section_id not in teacher_current_section_ids(db, teacher):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student registration not found.")
    return student


def issue_student_reset_code(db: Session, teacher: Teacher, student_id: uuid.UUID) -> ResetCodeOut:
    """Only the homeroom (class) teacher of the student's current section may
    reissue their login -- a subject teacher who teaches the class can approve
    a registration, but not take over a child's account."""
    student = db.get(Student, student_id)
    if student is None or student.school_id != _school_id(teacher):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    enrollment = current_enrollment(db, student)
    if enrollment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    assert_is_class_teacher_of_section(db, teacher, enrollment.class_section_id)
    return auth_service.issue_reset_code(db, teacher, student)


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


def _counts_by_section(
    db: Session, school_id: uuid.UUID, section_ids: set[uuid.UUID]
) -> dict[uuid.UUID, dict[str, int]]:
    """Approved and pending student counts per section, for the class chooser."""
    if not section_ids:
        return {}
    rows = (
        db.query(ClassSection.id, Student.approval_status, func.count(Student.id))
        .select_from(Student)
        .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
        .join(ClassSection, StudentEnrollment.class_section_id == ClassSection.id)
        .join(AcademicYear, StudentEnrollment.academic_year_id == AcademicYear.id)
        .filter(
            Student.school_id == school_id,
            ClassSection.id.in_(section_ids),
            StudentEnrollment.left_on.is_(None),
            AcademicYear.is_current.is_(True),
            Student.approval_status.in_(["approved", "pending"]),
        )
        .group_by(ClassSection.id, Student.approval_status)
        .all()
    )
    counts: dict[uuid.UUID, dict[str, int]] = {}
    for sid, status_value, n in rows:
        counts.setdefault(sid, {"approved": 0, "pending": 0})[status_value] = n
    return counts


def list_my_sections(db: Session, teacher: Teacher) -> list[TeacherSectionOut]:
    """Sections this teacher can act on: via a `teaching_assignments` row or
    being the section's class_teacher, current academic year only. Feeds the
    class picker on attendance/homework/report-card/OMR/notifications and on
    the students page."""
    school_id = _school_id(teacher)
    section_ids = teacher_current_section_ids(db, teacher)
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
        .filter(TeachingAssignment.teacher_id == teacher.id, TeachingAssignment.role == "primary")
        .all()
    )
    subjects_by_section: dict[uuid.UUID, list[TeacherSectionSubjectOut]] = {}
    for sid, subject_id, name in subject_rows:
        subjects_by_section.setdefault(sid, []).append(
            TeacherSectionSubjectOut(id=subject_id, name=name)
        )
    counts = _counts_by_section(db, school_id, section_ids)

    return [
        TeacherSectionOut(
            id=section.id,
            grade_id=section.grade_id,
            grade_label=grade_label,
            section=section.section,
            academic_year_label=year_label,
            is_class_teacher=section.class_teacher_id == teacher.id,
            subjects=subjects_by_section.get(section.id, []),
            students=counts.get(section.id, {}).get("approved", 0),
            pending_students=counts.get(section.id, {}).get("pending", 0),
        )
        for section, grade_label, year_label in rows
    ]

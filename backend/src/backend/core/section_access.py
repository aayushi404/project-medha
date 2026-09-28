"""Shared "can this teacher act on this class_section" checks -- the
school-level access rule for attendance, homework, OMR, and teacher-to-
section notifications: a teacher may act on a section if they hold a
`teaching_assignments` row for it (any subject) or are its `class_teacher_id`.

Report cards are stricter (see `assert_can_act_on_section_and_subject`): a
mark entry needs a subject-specific `teaching_assignments` row, no
class-teacher bypass -- grading a subject you don't teach should never be
allowed just because you're the homeroom teacher.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.db.models import AcademicYear, ClassSection, Student, StudentEnrollment, Teacher, TeachingAssignment


def _get_section(db: Session, teacher: Teacher, class_section_id: uuid.UUID) -> ClassSection:
    section = db.get(ClassSection, class_section_id)
    if section is None or section.school_id != teacher.school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found.")
    return section


def assert_can_act_on_section(
    db: Session, teacher: Teacher, class_section_id: uuid.UUID
) -> ClassSection:
    section = _get_section(db, teacher, class_section_id)

    if section.class_teacher_id == teacher.id:
        return section

    has_assignment = (
        db.query(TeachingAssignment.id)
        .filter(
            TeachingAssignment.teacher_id == teacher.id,
            TeachingAssignment.class_section_id == class_section_id,
        )
        .first()
        is not None
    )
    if not has_assignment:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You aren't assigned to this class."
        )
    return section


def assert_is_class_teacher_of_section(
    db: Session, teacher: Teacher, class_section_id: uuid.UUID
) -> ClassSection:
    """Stricter than `assert_can_act_on_section`: no `teaching_assignments`
    bypass. Only the section's homeroom teacher may pass -- used for
    attendance marking, where a subject teacher assigned to the class
    shouldn't be able to take the register just because they teach there."""
    section = _get_section(db, teacher, class_section_id)
    if section.class_teacher_id != teacher.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Only the class teacher can mark attendance for this class."
        )
    return section


def assert_can_act_on_section_and_subject(
    db: Session, teacher: Teacher, class_section_id: uuid.UUID, subject_id: uuid.UUID
) -> ClassSection:
    section = _get_section(db, teacher, class_section_id)

    has_assignment = (
        db.query(TeachingAssignment.id)
        .filter(
            TeachingAssignment.teacher_id == teacher.id,
            TeachingAssignment.class_section_id == class_section_id,
            TeachingAssignment.subject_id == subject_id,
        )
        .first()
        is not None
    )
    if not has_assignment:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "You don't teach this subject in this class."
        )
    return section


def current_enrollment(db: Session, student: Student) -> StudentEnrollment | None:
    """The student's active placement for the school's current academic
    year, or None if they aren't enrolled in one (e.g. a school that hasn't
    set up class_sections yet). Used wherever a student-facing module
    (homework, tutor, English) needs to know "what class is this student
    in" without reading the deprecated `Student.grade_id`."""
    return (
        db.query(StudentEnrollment)
        .join(AcademicYear, AcademicYear.id == StudentEnrollment.academic_year_id)
        .filter(
            StudentEnrollment.student_id == student.id,
            StudentEnrollment.left_on.is_(None),
            AcademicYear.is_current.is_(True),
        )
        .first()
    )


def assert_can_view_student(db: Session, viewer: Teacher, student: Student) -> None:
    """A principal may view any student at their school; a teacher only
    students in a section they teach or are class teacher of. 404 (not 403)
    for everything else so student ids can't be probed across schools/classes."""
    not_found = HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    if viewer.school_id is None or student.school_id != viewer.school_id:
        raise not_found
    if viewer.role == "principal":
        return
    enrollment = current_enrollment(db, student)
    if enrollment is None:
        raise not_found
    try:
        assert_can_act_on_section(db, viewer, enrollment.class_section_id)
    except HTTPException:
        raise not_found from None


def teacher_section_ids(db: Session, teacher: Teacher) -> set[uuid.UUID]:
    """Every class_section this teacher teaches in or is class teacher of."""
    assigned = {
        sid for (sid,) in db.query(TeachingAssignment.class_section_id).filter(TeachingAssignment.teacher_id == teacher.id).all()
    }
    homeroom = {sid for (sid,) in db.query(ClassSection.id).filter(ClassSection.class_teacher_id == teacher.id).all()}
    return assigned | homeroom

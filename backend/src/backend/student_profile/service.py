"""Builds a student's full profile for a teacher or the principal.

Access: the viewer must be a teacher or the principal of the student's school,
and for a teacher the student must be in a class they act on (their assignment
or homeroom). Anyone else gets 404, so ids can't be probed across schools or
classes. The check is `assert_can_view_student`, the same rule the lists use.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.core.section_access import assert_can_view_student
from backend.db.models import AcademicYear, ClassSection, Grade, Student, StudentEnrollment, Teacher
from backend.student_profile.schemas import StudentProfileOut, ViewerRights


def student_profile(db: Session, viewer: Teacher, student_id: uuid.UUID) -> StudentProfileOut:
    student = db.get(Student, student_id)
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    assert_can_view_student(db, viewer, student)

    row = (
        db.query(StudentEnrollment, ClassSection, Grade, AcademicYear, Teacher.full_name)
        .join(ClassSection, StudentEnrollment.class_section_id == ClassSection.id)
        .join(Grade, ClassSection.grade_id == Grade.id)
        .join(AcademicYear, StudentEnrollment.academic_year_id == AcademicYear.id)
        .outerjoin(Teacher, ClassSection.class_teacher_id == Teacher.id)
        .filter(StudentEnrollment.student_id == student.id, StudentEnrollment.left_on.is_(None))
        .order_by(AcademicYear.starts_on.desc())
        .first()
    )
    enrollment, section, grade, year, class_teacher_name = row if row else (None, None, None, None, None)

    # Rights: the principal views only. Teachers get approve/reject on pending
    # students (their scope was checked above) and reset only as homeroom teacher.
    is_teacher = viewer.role == "teacher"
    pending = student.approval_status == "pending"
    is_homeroom = section is not None and section.class_teacher_id == viewer.id

    return StudentProfileOut(
        id=student.id,
        full_name=student.full_name,
        photo_url=student.photo_url,
        approval_status=student.approval_status,
        status=student.status,
        login_phone=student.phone_number,
        email=student.email,
        class_section_id=section.id if section else None,
        grade_label=grade.label if grade else None,
        section=section.section if section else None,
        roll_number=enrollment.roll_number if enrollment else None,
        academic_year_label=year.label if year else None,
        class_teacher_name=class_teacher_name,
        approved_at=student.approved_at,
        guardian_name=student.guardian_name,
        guardian_relation=student.guardian_relation,
        guardian_phone=student.guardian_phone,
        viewer=ViewerRights(
            can_approve=is_teacher and pending,
            can_reject=is_teacher and pending,
            can_reset_login=is_teacher and is_homeroom,
        ),
    )

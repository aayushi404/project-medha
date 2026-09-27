"""Student self-registration -- one step, unauthenticated. A student picks
their school, grade+section, and a roll number for the current academic
year, gives guardian details, and sets a login credential immediately.
A teacher still has to approve the row (see teacher/service.py) before it
can log in, but there's no separate "activate account" step.

Identity is keyed on email (a credential exists from the start, unlike the
old two-phase flow) -- a previously-rejected applicant re-applying with the
same email reuses and resets that row rather than creating a duplicate.
"""
from datetime import date

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import emails, tokens
from backend.auth.hashing import hash_password
from backend.db.models import AcademicYear, ClassSection, School, Student, StudentEnrollment, Teacher
from backend.student.schemas import StudentRegisterIn, StudentRegisterOut


def _school_has_approved_teacher(db: Session, school_id) -> bool:
    return (
        db.query(Teacher.id)
        .filter(
            Teacher.school_id == school_id,
            Teacher.role == "teacher",
            Teacher.approval_status == "approved",
        )
        .first()
        is not None
    )


def register(db: Session, payload: StudentRegisterIn, background: BackgroundTasks) -> StudentRegisterOut:
    if db.get(School, payload.school_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That school wasn't found.")

    section = db.get(ClassSection, payload.class_section_id)
    if section is None or section.school_id != payload.school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That class wasn't found.")
    year = db.get(AcademicYear, section.academic_year_id)
    if year is None or not year.is_current:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This class is no longer open for registration. Ask your school to check its current academic year.",
        )

    if not _school_has_approved_teacher(db, payload.school_id):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Your school isn't set up on Medha yet. Ask a teacher to register "
            "first, then try again.",
        )

    ok_message = (
        "Registration received. Check your email to verify your address; your "
        "account will then be pending approval from a teacher at your school. "
        "Once approved, log in with the email and password you just set."
    )
    existing = db.query(Student).filter(Student.email == payload.email).first()
    if existing is not None and (
        existing.approval_status != "rejected" or existing.school_id != payload.school_id
    ):
        # Same response as a fresh registration: the owner of the address is told
        # by email, and nobody can use this form to find out who has an account.
        emails.already_registered(background, payload.email, payload.full_name)
        return StudentRegisterOut(message=ok_message)

    student = existing or Student()
    student.full_name = payload.full_name
    student.school_id = payload.school_id
    student.guardian_name = payload.guardian_name
    student.guardian_relation = payload.guardian_relation
    student.guardian_phone = payload.guardian_phone
    student.email = payload.email
    student.password_hash = hash_password(payload.password)
    student.email_verified_at = None
    student.approval_status = "pending"
    student.approved_by = None
    student.approved_at = None
    student.rejection_reason = None
    if existing is None:
        db.add(student)
        db.flush()

    enrollment = (
        db.query(StudentEnrollment)
        .filter(
            StudentEnrollment.student_id == student.id,
            StudentEnrollment.academic_year_id == year.id,
        )
        .first()
    )
    if enrollment is None:
        enrollment = StudentEnrollment(
            student_id=student.id, academic_year_id=year.id, enrolled_on=date.today()
        )
        db.add(enrollment)
    enrollment.class_section_id = section.id
    enrollment.roll_number = payload.roll_number

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A student with this roll number is already registered for this class.",
        ) from exc

    db.refresh(student)
    emails.verification(background, student.email, student.full_name, tokens.issue(db, student, tokens.VERIFY_EMAIL))
    return StudentRegisterOut(message=ok_message)

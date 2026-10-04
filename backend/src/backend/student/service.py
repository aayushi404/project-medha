"""Student self-registration and claiming -- unauthenticated. A student picks
their school, grade+section, and a roll number for the current academic year,
gives guardian details, and sets a login phone and password. A teacher still
has to approve the row (see teacher/service.py) before it can log in.

Identity: the login phone is what the student types. Email is optional. A
student who registers with an email is verified by that address. A student
who doesn't is still fully usable, since no step needs an email.

A rejected applicant may re-apply. The row is found by email when one is
given, otherwise by the roll slot they're applying for, but only when the
phone and name also match -- so a re-application can't take over someone
else's place.
"""
from datetime import date

from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import emails, tokens
from backend.auth.hashing import hash_password
from backend.db.models import AcademicYear, ClassSection, School, Student, StudentEnrollment, Teacher
from backend.student.schemas import (
    StudentClaimIn,
    StudentClaimOut,
    StudentRegisterIn,
    StudentRegisterOut,
)

_ROLL_TAKEN = "A student with this roll number is already registered for this class."


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


def _is_same_person(student: Student, payload: StudentRegisterIn) -> bool:
    return (
        student.phone_number == payload.login_phone
        and student.full_name.lower() == payload.full_name.lower()
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
        "Registration received. Your account will be pending approval from a teacher "
        "at your school. Once approved, log in with your phone number and the password "
        "you just set."
    )
    if payload.email:
        ok_message += " We've also sent a link to verify your email address."

    existing: Student | None = None
    if payload.email:
        existing = db.query(Student).filter(Student.email == payload.email).first()
        if existing is not None and (
            existing.approval_status != "rejected" or existing.school_id != payload.school_id
        ):
            # Same response as a fresh registration: the owner of the address is told
            # by email, and nobody can use this form to find out who has an account.
            emails.already_registered(background, payload.email, payload.full_name)
            return StudentRegisterOut(message=ok_message)

    # The roll slot is the other way an earlier registration can be found. It is
    # only ever reused by a rejected applicant with the same phone and name.
    slot = (
        db.query(Student)
        .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
        .filter(
            StudentEnrollment.class_section_id == section.id,
            StudentEnrollment.roll_number == payload.roll_number,
        )
        .first()
    )
    if slot is not None and slot is not existing:
        reusable = (
            existing is None
            and slot.approval_status == "rejected"
            and slot.school_id == payload.school_id
            and _is_same_person(slot, payload)
        )
        if not reusable:
            raise HTTPException(status.HTTP_409_CONFLICT, _ROLL_TAKEN)
        existing = slot

    student = existing or Student()
    student.full_name = payload.full_name
    student.school_id = payload.school_id
    student.guardian_name = payload.guardian_name
    student.guardian_relation = payload.guardian_relation
    student.guardian_phone = payload.guardian_phone
    student.phone_number = payload.login_phone
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
        raise HTTPException(status.HTTP_409_CONFLICT, _ROLL_TAKEN) from exc

    db.refresh(student)
    if student.email:
        emails.verification(background, student.email, student.full_name, tokens.issue(db, student, tokens.VERIFY_EMAIL))
    return StudentRegisterOut(message=ok_message)


def claim(db: Session, payload: StudentClaimIn, background: BackgroundTasks) -> StudentClaimOut:
    """Attach a password to a principal-imported student (see
    principal/student_import.py). Identity is the school + section + roll +
    name the school recorded, and the login phone must be the one the school
    recorded too. Every student has a phone since 0032, so someone who knows
    the roll details can't swap in their own number."""
    not_found = HTTPException(
        status.HTTP_404_NOT_FOUND,
        "We couldn't find an account matching those details. Check the class, section, "
        "roll number and name (exactly as your school has it), or ask your teacher.",
    )
    section = db.get(ClassSection, payload.class_section_id)
    if section is None or section.school_id != payload.school_id:
        raise not_found
    matches = (
        db.query(Student)
        .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
        .join(AcademicYear, StudentEnrollment.academic_year_id == AcademicYear.id)
        .filter(
            Student.school_id == payload.school_id,
            Student.approval_status == "approved",
            Student.is_active.is_(True),
            Student.email.is_(None),
            Student.password_hash.is_(None),
            func.lower(Student.full_name) == payload.full_name.lower(),
            Student.phone_number == payload.login_phone,
            StudentEnrollment.class_section_id == section.id,
            StudentEnrollment.roll_number == payload.roll_number,
            StudentEnrollment.left_on.is_(None),
            AcademicYear.is_current.is_(True),
        )
        .all()
    )
    if len(matches) != 1:
        raise not_found
    student = matches[0]

    student.password_hash = hash_password(payload.password)
    db.commit()

    return StudentClaimOut(message="Your account is ready. Log in with your phone number and password.")

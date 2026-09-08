"""Student self-service: registration (phase 1) and account activation (phase 2).

Neither endpoint is authenticated -- a student has no session until they have
activated. Phase 1 creates a pending, credential-less row; a teacher approves it;
phase 2 matches the approved row by school + class + roll number + name and
attaches an email + password so the student can log in through /auth/login.
"""
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth.hashing import hash_password
from backend.db.models import Grade, School, Teacher
from backend.student.schemas import (
    StudentActivateIn,
    StudentActivateOut,
    StudentRegisterIn,
    StudentRegisterOut,
)


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


def register(db: Session, payload: StudentRegisterIn) -> StudentRegisterOut:
    if db.get(School, payload.school_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That school wasn't found.")
    if db.get(Grade, payload.grade_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That class wasn't found.")

    if not _school_has_approved_teacher(db, payload.school_id):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Your school isn't set up on Medha yet. Ask a teacher to register "
            "first, then try again.",
        )

    existing = (
        db.query(Teacher)
        .filter(
            Teacher.role == "student",
            Teacher.school_id == payload.school_id,
            Teacher.grade_id == payload.grade_id,
            Teacher.roll_number == payload.roll_number,
        )
        .first()
    )
    if existing is not None and existing.approval_status != "rejected":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A student with this roll number is already registered for this "
            "class. If this is you, activate your account instead.",
        )

    # a rejected roll number may re-apply: reuse the row so the partial unique
    # index on (school, class, roll) doesn't block them
    student = existing or Teacher()
    student.role = "student"
    student.full_name = payload.full_name
    student.school_id = payload.school_id
    student.grade_id = payload.grade_id
    student.roll_number = payload.roll_number
    student.email = None
    student.password_hash = None
    student.approval_status = "pending"
    student.approved_by = None
    student.approved_at = None
    student.rejection_reason = None
    if existing is None:
        db.add(student)

    db.commit()
    return StudentRegisterOut(
        message="Registration received. Your account is pending approval from a "
        "teacher at your school.",
    )


def activate(db: Session, payload: StudentActivateIn) -> StudentActivateOut:
    matches = (
        db.query(Teacher)
        .filter(
            Teacher.role == "student",
            Teacher.approval_status == "approved",
            Teacher.email.is_(None),
            Teacher.school_id == payload.school_id,
            Teacher.grade_id == payload.grade_id,
            Teacher.roll_number == payload.roll_number,
            func.lower(Teacher.full_name) == payload.full_name.lower(),
        )
        .all()
    )
    if not matches:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "We couldn't find an approved registration matching those details. "
            "Check the class, roll number and name, or ask your teacher.",
        )
    if len(matches) > 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "More than one registration matches. Please contact your teacher.",
        )
    student = matches[0]

    email_taken = (
        db.query(Teacher.id)
        .filter(Teacher.email == payload.email, Teacher.id != student.id)
        .first()
    )
    if email_taken is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "That email is already in use."
        )

    student.email = payload.email
    student.password_hash = hash_password(payload.password)
    db.commit()
    return StudentActivateOut(
        message="Your account is ready. You can log in now.",
    )

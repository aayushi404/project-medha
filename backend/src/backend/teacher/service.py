"""Teacher-facing student approvals. A teacher approves students at their own
school; scoping (`student.school_id == teacher.school_id`, `role == 'student'`)
lives here so a stray id from another school just 404s.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.approvals import service as approvals
from backend.approvals.schemas import ApprovalResult
from backend.db.models import Grade, Teacher
from backend.teacher.schemas import (
    PendingStudent,
    StudentRosterItem,
    TeacherStudentStats,
)


def _school_id(teacher: Teacher) -> uuid.UUID:
    if teacher.school_id is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Your account isn't linked to a school."
        )
    return teacher.school_id


def get_stats(db: Session, teacher: Teacher) -> TeacherStudentStats:
    school_id = _school_id(teacher)

    def _count(status_value: str) -> int:
        return (
            db.query(func.count(Teacher.id))
            .filter(
                Teacher.role == "student",
                Teacher.school_id == school_id,
                Teacher.approval_status == status_value,
            )
            .scalar()
            or 0
        )

    return TeacherStudentStats(
        students=_count("approved"), pending_students=_count("pending")
    )


def _rows(db: Session, school_id: uuid.UUID, approval_status: str):
    return (
        db.query(Teacher, Grade.label)
        .join(Grade, Teacher.grade_id == Grade.id)
        .filter(
            Teacher.role == "student",
            Teacher.school_id == school_id,
            Teacher.approval_status == approval_status,
        )
        .order_by(Grade.numeric_level, Teacher.roll_number, Teacher.full_name)
        .all()
    )


def list_pending_students(db: Session, teacher: Teacher) -> list[PendingStudent]:
    school_id = _school_id(teacher)
    return [
        PendingStudent(
            id=s.id,
            full_name=s.full_name,
            grade_id=s.grade_id,
            grade_label=grade_label,
            roll_number=s.roll_number,
            applied_at=s.created_at,
        )
        for s, grade_label in _rows(db, school_id, "pending")
    ]


def list_students(db: Session, teacher: Teacher) -> list[StudentRosterItem]:
    school_id = _school_id(teacher)
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
        for s, grade_label in _rows(db, school_id, "approved")
    ]


def _get_scoped_student(
    db: Session, teacher: Teacher, student_id: uuid.UUID
) -> Teacher:
    school_id = _school_id(teacher)
    student = db.get(Teacher, student_id)
    if (
        student is None
        or student.role != "student"
        or student.school_id != school_id
    ):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "Student registration not found."
        )
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

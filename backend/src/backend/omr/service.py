import os
import uuid
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.db.models import Teacher
from backend.omr.evaluator import OMREvaluator
from backend.omr.schemas import OMREvaluationResponse


def _teacher_student_roster(db: Session, teacher: Teacher, grade_id: uuid.UUID) -> list[dict[str, Any]]:
    """Fetch students in grade_id belonging to teacher's school."""
    if teacher.school_id is None:
        return []

    students = (
        db.query(Teacher)
        .filter(
            Teacher.role == "student",
            Teacher.school_id == teacher.school_id,
            Teacher.grade_id == grade_id,
        )
        .all()
    )

    return [
        {
            "id": str(s.id),
            "full_name": s.full_name,
            "roll_number": s.roll_number,
        }
        for s in students
    ]


async def evaluate_omr_upload(
    db: Session,
    teacher: Teacher,
    file: UploadFile,
    grade_id: uuid.UUID,
    max_marks: float = 100.0,
) -> OMREvaluationResponse:
    if not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file uploaded.")

    filename_lower = file.filename.lower()
    valid_exts = (".pdf", ".png", ".jpg", ".jpeg")
    if not any(filename_lower.endswith(ext) for ext in valid_exts):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Unsupported file format. Please upload PDF, JPG, or PNG."
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File size exceeds 10MB limit.")

    evaluator = OMREvaluator()
    try:
        images = evaluator.load_image_from_bytes(content, file.filename)
    except Exception as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Could not process OMR file: {str(exc)}"
        ) from exc

    if not images:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No readable pages found in uploaded OMR file.")

    # Get student roster for roll number mapping
    roster = _teacher_student_roster(db, teacher, grade_id)

    # Process page 0
    try:
        response = evaluator.evaluate_sheet(images[0], max_marks=max_marks, student_roster=roster)
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"OMR Alignment Error: {str(exc)}"
        ) from exc

    return response

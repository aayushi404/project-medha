import os
import uuid
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.core.section_access import assert_can_act_on_section
import logging

from backend.core.uploads import read_limited, require_kind
from backend.db.models import Student, StudentEnrollment, Teacher

logger = logging.getLogger("backend.omr")
from backend.omr.evaluator import OMREvaluator
from backend.omr.schemas import OMREvaluationResponse


def _teacher_student_roster(db: Session, teacher: Teacher, class_section_id: uuid.UUID) -> list[dict[str, Any]]:
    """Fetch the roster for a class_section the teacher is assigned to."""
    if teacher.school_id is None:
        return []
    assert_can_act_on_section(db, teacher, class_section_id)

    rows = (
        db.query(Student, StudentEnrollment.roll_number)
        .join(StudentEnrollment, StudentEnrollment.student_id == Student.id)
        .filter(
            StudentEnrollment.class_section_id == class_section_id,
            StudentEnrollment.left_on.is_(None),
            Student.approval_status == "approved",
        )
        .all()
    )

    return [
        {
            "id": str(s.id),
            "full_name": s.full_name,
            "roll_number": roll_number,
        }
        for s, roll_number in rows
    ]


async def evaluate_omr_upload(
    db: Session,
    teacher: Teacher,
    file: UploadFile,
    class_section_id: uuid.UUID,
    max_marks: float = 100.0,
) -> OMREvaluationResponse:
    # authorize before touching the (potentially expensive) file
    roster = _teacher_student_roster(db, teacher, class_section_id)

    content = await read_limited(file, 10 * 1024 * 1024)
    kind = require_kind(content, {"pdf", "png", "jpeg"}, "Unsupported file format. Please upload PDF, JPG, or PNG.")
    filename = f"omr.{'pdf' if kind == 'pdf' else 'png' if kind == 'png' else 'jpg'}"  # never trust the client's name

    evaluator = OMREvaluator()
    try:
        images = evaluator.load_image_from_bytes(content, filename)
    except ValueError as exc:  # our own limit/decode messages are safe to show
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not process OMR file: {exc}") from exc
    except Exception as exc:
        logger.warning("omr_decode_failed: %s", exc)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not process the OMR file.") from exc

    if not images:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No readable pages found in uploaded OMR file.")


    # Process page 0
    try:
        response = evaluator.evaluate_sheet(images[0], max_marks=max_marks, student_roster=roster)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "OMR alignment error: could not read the sheet.") from exc

    return response

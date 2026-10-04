import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_role
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.student_profile import service
from backend.student_profile.schemas import StudentProfileOut

router = APIRouter(prefix="/students", tags=["students"])


@router.get("/{student_id}", response_model=StudentProfileOut)
def get_student_profile(
    student_id: uuid.UUID,
    viewer: Teacher = Depends(require_role("teacher", "principal")),
    db: Session = Depends(get_db),
) -> StudentProfileOut:
    """Full profile for a teacher (in their classes) or the principal (school-wide)."""
    return service.student_profile(db, viewer, student_id)

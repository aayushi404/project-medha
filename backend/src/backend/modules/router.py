import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_teacher
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.modules import service
from backend.modules.schemas import (
    FeedbackIn,
    FeedbackOut,
    ModuleDetailOut,
    ModuleListItem,
)

router = APIRouter(tags=["modules"])


@router.get("/modules", response_model=list[ModuleListItem])
def list_modules(
    grade_id: uuid.UUID | None = None,
    subject_id: uuid.UUID | None = None,
    chapter_id: uuid.UUID | None = None,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> list[ModuleListItem]:
    return service.list_modules(db, current_teacher, grade_id, subject_id, chapter_id)


@router.get("/modules/{module_id}", response_model=ModuleDetailOut)
def get_module(
    module_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> ModuleDetailOut:
    return service.get_module_detail(db, current_teacher, module_id)


@router.delete("/modules/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_module(
    module_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> None:
    service.delete_module(db, current_teacher, module_id)


@router.post("/modules/{module_id}/feedback", response_model=FeedbackOut)
def send_feedback(
    module_id: uuid.UUID,
    payload: FeedbackIn,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> FeedbackOut:
    return service.upsert_feedback(db, current_teacher, module_id, payload)

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_user, require_role
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.practice import service
from backend.practice.schemas import PracticeQuestionIn, PracticeQuestionOut

router = APIRouter(prefix="/practice", tags=["practice"])

require_question_author = require_role("teacher", "principal")


@router.get("", response_model=list[PracticeQuestionOut])
def list_questions(
    chapter_id: uuid.UUID, user: Teacher = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[PracticeQuestionOut]:
    return service.list_questions(db, user, chapter_id)


@router.post("", response_model=PracticeQuestionOut)
def add_question(
    payload: PracticeQuestionIn, user: Teacher = Depends(require_question_author), db: Session = Depends(get_db)
) -> PracticeQuestionOut:
    return service.add_question(db, user, payload)


@router.delete("/{question_id}", status_code=204)
def delete_question(
    question_id: uuid.UUID, user: Teacher = Depends(require_question_author), db: Session = Depends(get_db)
) -> None:
    service.delete_question(db, user, question_id)

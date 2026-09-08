from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_teacher
from backend.auth.schemas import TeacherOut
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.onboarding.schemas import OnboardingCompleteIn
from backend.onboarding.service import complete_onboarding

router = APIRouter(tags=["onboarding"])


@router.post("/onboarding/complete", response_model=TeacherOut)
def onboarding_complete(
    payload: OnboardingCompleteIn,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> Teacher:
    return complete_onboarding(db, current_teacher, payload)

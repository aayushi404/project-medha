from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_teacher
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.profile import service
from backend.profile.schemas import ProfileOut, ProfileUpdateIn

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=ProfileOut)
def get_profile(
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> ProfileOut:
    return service.get_profile(db, current_teacher)


@router.patch("/profile", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdateIn,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: Session = Depends(get_db),
) -> ProfileOut:
    return service.update_profile(db, current_teacher, payload)

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.db.session import get_db
from backend.student import service
from backend.student.schemas import (
    StudentActivateIn,
    StudentActivateOut,
    StudentRegisterIn,
    StudentRegisterOut,
)

router = APIRouter(prefix="/student", tags=["student"])


@router.post(
    "/register",
    response_model=StudentRegisterOut,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: StudentRegisterIn, db: Session = Depends(get_db)
) -> StudentRegisterOut:
    return service.register(db, payload)


@router.post("/activate", response_model=StudentActivateOut)
def activate(
    payload: StudentActivateIn, db: Session = Depends(get_db)
) -> StudentActivateOut:
    return service.activate(db, payload)

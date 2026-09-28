from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlalchemy.orm import Session

from backend.core import throttle
from backend.db.session import get_db
from backend.student import service
from backend.student.schemas import (
    StudentClaimIn,
    StudentClaimOut,
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
    payload: StudentRegisterIn,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> StudentRegisterOut:
    # generous: every student in a school lab shares one IP
    throttle.enforce(db, "student_register", throttle.client_ip(request), limit=120, window_seconds=3600)
    return service.register(db, payload, background_tasks)


@router.post("/claim", response_model=StudentClaimOut)
def claim(
    payload: StudentClaimIn,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> StudentClaimOut:
    """Set a login on an account the principal imported without an email."""
    # generous like /register (a school lab shares one IP), but still a cap on
    # guessing names and roll numbers
    throttle.enforce(db, "student_claim", throttle.client_ip(request), limit=120, window_seconds=3600)
    return service.claim(db, payload, background_tasks)

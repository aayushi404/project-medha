import uuid
from datetime import date as date_

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_principal, require_role
from backend.cover import finalize, service
from backend.cover.schemas import (
    AbsenceIn,
    AbsenceResultOut,
    BulkSubstitutionIn,
    CandidatesOut,
    DayBoardOut,
    FinalDayOut,
    FinalStatusOut,
    SubstitutionIn,
    SubstitutionOut,
    SuggestionOut,
)
from backend.db.models import Teacher
from backend.db.session import get_db

router = APIRouter(
    prefix="/principal", tags=["daily-cover"], dependencies=[Depends(require_principal)]
)


@router.get("/day", response_model=DayBoardOut)
def day_board(
    day: date_ = Query(alias="date"),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> DayBoardOut:
    return service.day_board(db, principal, day)


@router.post("/absences", response_model=AbsenceResultOut)
def mark_absences(
    payload: AbsenceIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> AbsenceResultOut:
    return service.mark_absences(db, principal, payload)


@router.delete("/absences/{absence_id}", status_code=204)
def unmark_absence(
    absence_id: uuid.UUID,
    force: bool = Query(default=False),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> Response:
    service.unmark_absence(db, principal, absence_id, force)
    return Response(status_code=204)


@router.get("/substitutions/candidates", response_model=CandidatesOut)
def candidates(
    day: date_ = Query(alias="date"),
    timetable_cell_id: uuid.UUID = Query(),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> CandidatesOut:
    return service.candidates_for(db, principal, day, timetable_cell_id)


@router.post("/substitutions", response_model=SubstitutionOut)
def apply_substitution(
    payload: SubstitutionIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> SubstitutionOut:
    return service.apply_substitution(db, principal, payload)


@router.post("/substitutions/bulk", response_model=list[SubstitutionOut])
def apply_bulk(
    payload: BulkSubstitutionIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[SubstitutionOut]:
    return service.apply_bulk(db, principal, payload.date, payload.items)


@router.delete("/substitutions/{substitution_id}", status_code=204)
def clear_substitution(
    substitution_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> Response:
    service.clear_substitution(db, principal, substitution_id)
    return Response(status_code=204)


@router.post("/substitutions/suggest", response_model=SuggestionOut)
def suggest(
    day: date_ = Query(alias="date"),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> SuggestionOut:
    return service.suggest(db, principal, day)


@router.get("/day/final", response_model=FinalStatusOut)
def final_status(
    day: date_ = Query(alias="date"),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> FinalStatusOut:
    return finalize.final_status(db, principal, day)


@router.post("/day/finalize", response_model=FinalStatusOut)
def finalize_day(
    day: date_ = Query(alias="date"),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> FinalStatusOut:
    return finalize.finalize(db, principal, day)


# The teachers' board. Teachers read the snapshot the principal finalized.
day_board_router = APIRouter(
    prefix="/day-timetable", tags=["day-timetable"], dependencies=[Depends(require_role("teacher", "principal"))]
)


@day_board_router.get("", response_model=FinalDayOut)
def final_day(
    day: date_ = Query(alias="date"),
    user: Teacher = Depends(require_role("teacher", "principal")),
    db: Session = Depends(get_db),
) -> FinalDayOut:
    return finalize.teacher_day(db, user, day)

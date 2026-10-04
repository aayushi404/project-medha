import uuid

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_principal
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.timetable_planner import service
from backend.timetable_planner.schemas import (
    CopyDayOut,
    CopySlotsIn,
    DaySlotsIn,
    PeriodSlotOut,
    SaveDayIn,
    TimetableCreateIn,
    TimetableGridOut,
    TimetableListItem,
    TimetableOut,
    ValidationOut,
    VersionIn,
)

router = APIRouter(
    prefix="/principal", tags=["timetable-planner"], dependencies=[Depends(require_principal)]
)

@router.get("/period-slots", response_model=list[PeriodSlotOut])
def list_period_slots(
    day: int = Query(ge=1, le=7, description="1 = Monday .. 7 = Sunday"),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[PeriodSlotOut]:
    return service.list_day_slots(db, principal, day)


@router.put("/period-slots", response_model=list[PeriodSlotOut])
def replace_period_slots(
    payload: DaySlotsIn,
    day: int = Query(ge=1, le=7, description="1 = Monday .. 7 = Sunday"),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[PeriodSlotOut]:
    return service.replace_day_slots(db, principal, day, payload)


@router.post("/period-slots/copy")
def copy_period_slots(
    payload: CopySlotsIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> dict[str, list[int]]:
    return service.copy_day_slots(db, principal, payload)


@router.get("/timetables", response_model=list[TimetableListItem])
def list_timetables(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> list[TimetableListItem]:
    return service.list_timetables(db, principal)


@router.post("/timetables", response_model=TimetableOut, status_code=201)
def create_timetable(
    payload: TimetableCreateIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> TimetableOut:
    return service.create_timetable(db, principal, payload)


@router.get("/timetables/{timetable_id}/grid", response_model=TimetableGridOut)
def get_grid(
    timetable_id: uuid.UUID,
    day: int = Query(ge=1, le=7, description="1 = Monday .. 7 = Sunday"),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> TimetableGridOut:
    return service.get_grid(db, principal, timetable_id, day)


@router.put("/timetables/{timetable_id}/days/{day}", response_model=TimetableGridOut)
def save_day(
    timetable_id: uuid.UUID,
    payload: SaveDayIn,
    day: int = Path(ge=1, le=7),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> TimetableGridOut:
    return service.save_day(db, principal, timetable_id, day, payload)


@router.post(
    "/timetables/{timetable_id}/days/{day}/copy-from/{source}", response_model=CopyDayOut
)
def copy_day(
    timetable_id: uuid.UUID,
    payload: VersionIn,
    day: int = Path(ge=1, le=7),
    source: int = Path(ge=1, le=7),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> CopyDayOut:
    return service.copy_day(db, principal, timetable_id, day, source, payload)


@router.get("/timetables/{timetable_id}/validate", response_model=ValidationOut)
def validate_timetable(
    timetable_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> ValidationOut:
    return service.validate(db, principal, timetable_id)


@router.post("/timetables/{timetable_id}/publish", response_model=TimetableOut)
def publish_timetable(
    timetable_id: uuid.UUID,
    payload: VersionIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> TimetableOut:
    return service.publish(db, principal, timetable_id, payload)

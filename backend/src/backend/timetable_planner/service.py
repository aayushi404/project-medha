"""Principal's timetable planner (docs/phase-2/principal_timetable_planner.md).

Everything here is scoped to the principal's school. Timetables belong to the
school's current academic year.

Rules enforced on the server, regardless of what the screen shows:
* Only a draft can change. A published timetable is read-only; a revision is a
  new draft copied from it.
* Each day save sends the version it was loaded at; a stale one gets 409.
* Break periods hold no cells. A section holds one subject per period. A
  teacher is in one place per period. Clashes are reported with the teacher's
  name and both sections.
* Validation only warns (empty periods, cells with no teacher, teachers over the
  daily cap). It never blocks a save or a publish.
"""

import uuid
from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from backend.db.models import (
    AcademicYear,
    ClassSection,
    Grade,
    PeriodSlot,
    Subject,
    Teacher,
    TeacherSubject,
    TeachingAssignment,
    Timetable,
    TimetableCell,
)
from backend.timetable_planner.schemas import (
    CellOut,
    CopyDayOut,
    CopySlotsIn,
    DaySlotsIn,
    EligibleTeacherOut,
    OverloadItem,
    PeriodSlotIn,
    PeriodSlotOut,
    SaveDayIn,
    SectionOut,
    SubjectOut,
    TimetableCreateIn,
    TimetableGridOut,
    TimetableListItem,
    TimetableOut,
    ValidationItem,
    ValidationOut,
    VersionIn,
)

# Soft limit for the validation panel. A teacher over this on one day gets a
# warning. It never blocks a save.
DAILY_PERIOD_CAP = 7


def _school_id(principal: Teacher) -> uuid.UUID:
    if principal.school_id is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Your account isn't linked to a school.")
    return principal.school_id


def _current_year(db: Session, school_id: uuid.UUID) -> AcademicYear:
    year = (
        db.query(AcademicYear)
        .filter(AcademicYear.school_id == school_id, AcademicYear.is_current.is_(True))
        .first()
    )
    if year is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Mark a current academic year before planning the timetable.",
        )
    return year


def _load_timetable(
    db: Session, school_id: uuid.UUID, timetable_id: uuid.UUID, *, lock: bool = False
) -> Timetable:
    query = db.query(Timetable).filter(Timetable.id == timetable_id, Timetable.school_id == school_id)
    if lock:
        # Serialises concurrent saves of the same timetable.
        query = query.with_for_update()
    timetable = query.one_or_none()
    if timetable is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Timetable not found.")
    return timetable


def _require_draft(timetable: Timetable) -> None:
    if timetable.status != "draft":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This timetable is published, so it's read-only. Start a revision to change it.",
        )


def _require_version(timetable: Timetable, version: int) -> None:
    if version != timetable.version:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This timetable changed in another tab. Reload to see the latest version.",
        )


def _day_slots(db: Session, school_id: uuid.UUID, day: int) -> list[PeriodSlot]:
    return (
        db.query(PeriodSlot)
        .filter(PeriodSlot.school_id == school_id, PeriodSlot.day_of_week == day)
        .order_by(PeriodSlot.period_number)
        .all()
    )


def _year_sections(
    db: Session, school_id: uuid.UUID, academic_year_id: uuid.UUID
) -> list[tuple[ClassSection, Grade]]:
    return (
        db.query(ClassSection, Grade)
        .join(Grade, Grade.id == ClassSection.grade_id)
        .filter(ClassSection.school_id == school_id, ClassSection.academic_year_id == academic_year_id)
        .order_by(Grade.numeric_level, ClassSection.section)
        .all()
    )


def _section_label(section: ClassSection, grade: Grade) -> str:
    return f"{grade.numeric_level} · {section.section}"


def _slot_out(slot: PeriodSlot) -> PeriodSlotOut:
    return PeriodSlotOut(
        id=slot.id,
        day_of_week=slot.day_of_week,
        period_number=slot.period_number,
        label=slot.label,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        is_break=slot.is_break,
    )


def _timetable_out(db: Session, timetable: Timetable) -> TimetableOut:
    year = db.get(AcademicYear, timetable.academic_year_id)
    return TimetableOut(
        id=timetable.id,
        name=timetable.name,
        status=timetable.status,
        version=timetable.version,
        academic_year_id=timetable.academic_year_id,
        academic_year_label=year.label if year else "",
    )


def _approved_teacher_names(
    db: Session, school_id: uuid.UUID, teacher_ids: set[uuid.UUID]
) -> dict[uuid.UUID, str]:
    if not teacher_ids:
        return {}
    rows = (
        db.query(Teacher.id, Teacher.full_name)
        .filter(
            Teacher.id.in_(teacher_ids),
            Teacher.school_id == school_id,
            Teacher.role == "teacher",
            Teacher.approval_status == "approved",
        )
        .all()
    )
    return {tid: name for tid, name in rows}


# --- period slots (the day's structure) ---


def _replace_day_slots(
    db: Session, school_id: uuid.UUID, day: int, incoming: list[PeriodSlotIn]
) -> None:
    numbers = [s.period_number for s in incoming]
    if len(set(numbers)) != len(numbers):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Each period number can appear only once a day."
        )

    existing = {s.period_number: s for s in _day_slots(db, school_id, day)}
    removed = [slot for number, slot in existing.items() if number not in numbers]
    for slot in removed:
        if _slot_in_use(db, slot.id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Period {slot.period_number} still has classes in a timetable. "
                "Clear it there before removing the period.",
            )

    for item in incoming:
        slot = existing.get(item.period_number)
        if slot is None:
            slot = PeriodSlot(school_id=school_id, day_of_week=day, period_number=item.period_number)
            db.add(slot)
        elif item.is_break and _slot_in_use(db, slot.id):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Period {slot.period_number} still has classes in a timetable. "
                "Clear it there before turning it into a break.",
            )
        slot.label = item.label
        slot.starts_at = item.starts_at
        slot.ends_at = item.ends_at
        slot.is_break = item.is_break

    for slot in removed:
        db.delete(slot)
    db.flush()


def _slot_in_use(db: Session, slot_id: uuid.UUID) -> bool:
    return db.query(TimetableCell.id).filter(TimetableCell.period_slot_id == slot_id).first() is not None


def list_day_slots(db: Session, principal: Teacher, day: int) -> list[PeriodSlotOut]:
    school_id = _school_id(principal)
    return [_slot_out(s) for s in _day_slots(db, school_id, day)]


def replace_day_slots(
    db: Session, principal: Teacher, day: int, payload: DaySlotsIn
) -> list[PeriodSlotOut]:
    school_id = _school_id(principal)
    _replace_day_slots(db, school_id, day, payload.slots)
    db.commit()
    return [_slot_out(s) for s in _day_slots(db, school_id, day)]


def copy_day_slots(db: Session, principal: Teacher, payload: CopySlotsIn) -> dict[str, list[int]]:
    school_id = _school_id(principal)
    source = _day_slots(db, school_id, payload.from_day)
    if not source:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "The day you're copying from has no periods yet."
        )
    definition = [
        PeriodSlotIn(
            period_number=s.period_number,
            label=s.label,
            starts_at=s.starts_at,
            ends_at=s.ends_at,
            is_break=s.is_break,
        )
        for s in source
    ]
    targets = sorted(set(payload.to_days) - {payload.from_day})
    for day in targets:
        _replace_day_slots(db, school_id, day, definition)
    db.commit()
    return {"copied_to": targets}


# --- timetables ---


def list_timetables(db: Session, principal: Teacher) -> list[TimetableListItem]:
    school_id = _school_id(principal)
    year = _current_year(db, school_id)
    timetables = (
        db.query(Timetable)
        .filter(Timetable.school_id == school_id, Timetable.academic_year_id == year.id)
        .order_by(Timetable.created_at.desc())
        .all()
    )
    ids = [t.id for t in timetables]
    counts: dict[uuid.UUID, int] = {}
    if ids:
        counts = dict(
            db.query(TimetableCell.timetable_id, func.count(TimetableCell.id))
            .filter(TimetableCell.timetable_id.in_(ids))
            .group_by(TimetableCell.timetable_id)
            .all()
        )
    return [
        TimetableListItem(**_timetable_out(db, t).model_dump(), cell_count=counts.get(t.id, 0))
        for t in timetables
    ]


def create_timetable(db: Session, principal: Teacher, payload: TimetableCreateIn) -> TimetableOut:
    school_id = _school_id(principal)
    year = _current_year(db, school_id)
    source = None
    if payload.copy_from_id is not None:
        source = _load_timetable(db, school_id, payload.copy_from_id)
        if source.academic_year_id != year.id:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "You can only start a revision from a timetable in the current year.",
            )

    timetable = Timetable(
        school_id=school_id,
        academic_year_id=year.id,
        name=payload.name.strip(),
        status="draft",
        version=1,
        created_by=principal.id,
    )
    db.add(timetable)
    db.flush()
    if source is not None:
        for cell in db.query(TimetableCell).filter(TimetableCell.timetable_id == source.id).all():
            db.add(
                TimetableCell(
                    timetable_id=timetable.id,
                    class_section_id=cell.class_section_id,
                    period_slot_id=cell.period_slot_id,
                    subject_id=cell.subject_id,
                    teacher_id=cell.teacher_id,
                )
            )
    db.commit()
    return _timetable_out(db, timetable)


def _all_cells(db: Session, timetable_id: uuid.UUID):
    teacher = aliased(Teacher)
    return (
        db.query(TimetableCell, PeriodSlot.day_of_week, Subject.name, teacher.full_name)
        .join(PeriodSlot, PeriodSlot.id == TimetableCell.period_slot_id)
        .join(Subject, Subject.id == TimetableCell.subject_id)
        .outerjoin(teacher, teacher.id == TimetableCell.teacher_id)
        .filter(TimetableCell.timetable_id == timetable_id)
        .all()
    )


def _eligible_teachers(
    db: Session,
    school_id: uuid.UUID,
    sections: list[tuple[ClassSection, Grade]],
    day: int,
    workload_day: dict[tuple[uuid.UUID, int], int],
    workload_week: dict[uuid.UUID, int],
) -> dict[str, list[EligibleTeacherOut]]:
    """Three layers from the plan: assigned to this section and subject, then
    qualified for the subject at this grade. The busy layer is worked out in the
    browser from the draft, so the screen can say where each teacher is."""
    section_ids = [sec.id for sec, _ in sections]
    if not section_ids:
        return {}

    eligible_filter = (Teacher.school_id == school_id, Teacher.role == "teacher", Teacher.approval_status == "approved")

    assigned: dict[tuple[uuid.UUID, uuid.UUID], dict[uuid.UUID, str]] = defaultdict(dict)
    for section_id, subject_id, teacher_id, name in (
        db.query(TeachingAssignment.class_section_id, TeachingAssignment.subject_id, Teacher.id, Teacher.full_name)
        .join(Teacher, Teacher.id == TeachingAssignment.teacher_id)
        .filter(
            TeachingAssignment.class_section_id.in_(section_ids),
            TeachingAssignment.role == "primary",
            *eligible_filter,
        )
        .all()
    ):
        assigned[(section_id, subject_id)][teacher_id] = name

    qualified: dict[tuple[uuid.UUID, uuid.UUID], dict[uuid.UUID, str]] = defaultdict(dict)
    for section_id, subject_id, teacher_id, name in (
        db.query(ClassSection.id, TeacherSubject.subject_id, Teacher.id, Teacher.full_name)
        .select_from(ClassSection)
        .join(TeacherSubject, TeacherSubject.grade_id == ClassSection.grade_id)
        .join(Teacher, Teacher.id == TeacherSubject.teacher_id)
        .filter(ClassSection.id.in_(section_ids), *eligible_filter)
        .all()
    ):
        qualified[(section_id, subject_id)][teacher_id] = name

    result: dict[str, list[EligibleTeacherOut]] = {}
    for key in set(assigned) | set(qualified):
        section_id, subject_id = key
        entries: list[EligibleTeacherOut] = []
        for tier, pool in (("assigned", assigned.get(key, {})), ("qualified", qualified.get(key, {}))):
            for teacher_id, name in sorted(pool.items(), key=lambda kv: kv[1]):
                if any(e.teacher_id == teacher_id for e in entries):
                    continue
                entries.append(
                    EligibleTeacherOut(
                        teacher_id=teacher_id,
                        name=name,
                        tier=tier,
                        periods_today=workload_day.get((teacher_id, day), 0),
                        periods_week=workload_week.get(teacher_id, 0),
                    )
                )
        result[f"{section_id}:{subject_id}"] = entries
    return result


def _grid(db: Session, school_id: uuid.UUID, timetable: Timetable, day: int) -> TimetableGridOut:
    sections = _year_sections(db, school_id, timetable.academic_year_id)
    rows = _all_cells(db, timetable.id)

    workload_day: dict[tuple[uuid.UUID, int], int] = defaultdict(int)
    workload_week: dict[uuid.UUID, int] = defaultdict(int)
    for cell, cell_day, _subject_name, _teacher_name in rows:
        if cell.teacher_id is None:
            continue
        workload_week[cell.teacher_id] += 1
        workload_day[(cell.teacher_id, cell_day)] += 1

    cells = [
        CellOut(
            class_section_id=cell.class_section_id,
            period_slot_id=cell.period_slot_id,
            subject_id=cell.subject_id,
            subject_name=subject_name,
            teacher_id=cell.teacher_id,
            teacher_name=teacher_name,
        )
        for cell, cell_day, subject_name, teacher_name in rows
        if cell_day == day
    ]

    return TimetableGridOut(
        timetable_id=timetable.id,
        name=timetable.name,
        status=timetable.status,
        editable=timetable.status == "draft",
        version=timetable.version,
        day_of_week=day,
        period_slots=[_slot_out(s) for s in _day_slots(db, school_id, day)],
        class_sections=[
            SectionOut(
                id=sec.id,
                label=_section_label(sec, grade),
                grade_label=grade.label,
                section=sec.section,
            )
            for sec, grade in sections
        ],
        subjects=[
            SubjectOut(id=s.id, name=s.name)
            for s in db.query(Subject).order_by(Subject.name).all()
        ],
        cells=cells,
        eligible_teachers=_eligible_teachers(
            db, school_id, sections, day, workload_day, workload_week
        ),
    )


def get_grid(db: Session, principal: Teacher, timetable_id: uuid.UUID, day: int) -> TimetableGridOut:
    school_id = _school_id(principal)
    timetable = _load_timetable(db, school_id, timetable_id)
    return _grid(db, school_id, timetable, day)


def save_day(
    db: Session, principal: Teacher, timetable_id: uuid.UUID, day: int, payload: SaveDayIn
) -> TimetableGridOut:
    school_id = _school_id(principal)
    timetable = _load_timetable(db, school_id, timetable_id, lock=True)
    _require_draft(timetable)
    _require_version(timetable, payload.version)

    slots = {s.id: s for s in _day_slots(db, school_id, day)}
    sections = {sec.id: (sec, grade) for sec, grade in _year_sections(db, school_id, timetable.academic_year_id)}
    subject_names = {
        s.id: s.name
        for s in db.query(Subject).filter(Subject.id.in_({c.subject_id for c in payload.cells})).all()
    }
    teacher_names = _approved_teacher_names(
        db, school_id, {c.teacher_id for c in payload.cells if c.teacher_id}
    )

    seen_section_slot: set[tuple[uuid.UUID, uuid.UUID]] = set()
    seen_teacher_slot: dict[tuple[uuid.UUID, uuid.UUID], uuid.UUID] = {}
    for cell in payload.cells:
        slot = slots.get(cell.period_slot_id)
        if slot is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, f"A period isn't part of {day_name(day)}."
            )
        if slot.is_break:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Period {slot.period_number} is a break and can't hold a class.",
            )
        if cell.class_section_id not in sections:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "A selected class isn't in this academic year."
            )
        if cell.subject_id not in subject_names:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A selected subject doesn't exist.")

        section_label = _section_label(*sections[cell.class_section_id])
        if (cell.class_section_id, cell.period_slot_id) in seen_section_slot:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"{section_label} has two subjects in period {slot.period_number}.",
            )
        seen_section_slot.add((cell.class_section_id, cell.period_slot_id))

        if cell.teacher_id is not None:
            if cell.teacher_id not in teacher_names:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    "A selected teacher isn't an approved teacher of your school.",
                )
            key = (cell.teacher_id, cell.period_slot_id)
            if key in seen_teacher_slot:
                other = sections[seen_teacher_slot[key]]
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    f"{teacher_names[cell.teacher_id]} is already teaching "
                    f"{_section_label(*other)} in period {slot.period_number}, "
                    f"so can't also take {section_label}.",
                )
            seen_teacher_slot[key] = cell.class_section_id

    db.query(TimetableCell).filter(
        TimetableCell.timetable_id == timetable.id,
        TimetableCell.period_slot_id.in_(list(slots.keys())),
    ).delete(synchronize_session=False)
    for cell in payload.cells:
        db.add(
            TimetableCell(
                timetable_id=timetable.id,
                class_section_id=cell.class_section_id,
                period_slot_id=cell.period_slot_id,
                subject_id=cell.subject_id,
                teacher_id=cell.teacher_id,
            )
        )
    timetable.version += 1
    try:
        db.flush()
    except IntegrityError:
        # The checks above catch every clash we know of. This is the backstop
        # for the unique index.
        db.rollback()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A teacher is already in another class in this period. Refresh and try again.",
        )
    db.commit()
    return _grid(db, school_id, timetable, day)


def day_name(day: int) -> str:
    return ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][day]


def copy_day(
    db: Session, principal: Teacher, timetable_id: uuid.UUID, day: int, source: int, payload: VersionIn
) -> CopyDayOut:
    school_id = _school_id(principal)
    timetable = _load_timetable(db, school_id, timetable_id, lock=True)
    _require_draft(timetable)
    _require_version(timetable, payload.version)
    if source == day:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a different day to copy from.")

    source_slots = {s.id: s for s in _day_slots(db, school_id, source)}
    if not source_slots:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"{day_name(source)} has no periods set up yet."
        )
    target_by_number = {s.period_number: s for s in _day_slots(db, school_id, day)}
    if not target_by_number:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, f"{day_name(day)} has no periods set up yet."
        )

    source_cells = [
        cell
        for cell, cell_day, _s, _t in _all_cells(db, timetable.id)
        if cell_day == source
    ]

    db.query(TimetableCell).filter(
        TimetableCell.timetable_id == timetable.id,
        TimetableCell.period_slot_id.in_([s.id for s in target_by_number.values()]),
    ).delete(synchronize_session=False)

    copied = 0
    skipped = 0
    for cell in source_cells:
        number = source_slots[cell.period_slot_id].period_number
        target = target_by_number.get(number)
        if target is None or target.is_break:
            skipped += 1
            continue
        db.add(
            TimetableCell(
                timetable_id=timetable.id,
                class_section_id=cell.class_section_id,
                period_slot_id=target.id,
                subject_id=cell.subject_id,
                teacher_id=cell.teacher_id,
            )
        )
        copied += 1

    timetable.version += 1
    db.flush()
    db.commit()
    return CopyDayOut(grid=_grid(db, school_id, timetable, day), copied=copied, skipped=skipped)


def validate(db: Session, principal: Teacher, timetable_id: uuid.UUID) -> ValidationOut:
    school_id = _school_id(principal)
    timetable = _load_timetable(db, school_id, timetable_id)
    sections = _year_sections(db, school_id, timetable.academic_year_id)
    slots = (
        db.query(PeriodSlot)
        .filter(PeriodSlot.school_id == school_id)
        .order_by(PeriodSlot.day_of_week, PeriodSlot.period_number)
        .all()
    )
    rows = _all_cells(db, timetable.id)
    filled = {(cell.class_section_id, cell.period_slot_id) for cell, _d, _s, _t in rows}

    empty: list[ValidationItem] = []
    for slot in slots:
        if slot.is_break:
            continue
        for sec, grade in sections:
            if (sec.id, slot.id) not in filled:
                empty.append(
                    ValidationItem(
                        day_of_week=slot.day_of_week,
                        period_number=slot.period_number,
                        class_label=_section_label(sec, grade),
                    )
                )

    slot_by_id = {s.id: s for s in slots}
    section_by_id = {sec.id: (sec, grade) for sec, grade in sections}
    no_teacher = [
        ValidationItem(
            day_of_week=slot_by_id[cell.period_slot_id].day_of_week,
            period_number=slot_by_id[cell.period_slot_id].period_number,
            class_label=_section_label(*section_by_id[cell.class_section_id]),
            subject_name=subject_name,
        )
        for cell, _d, subject_name, _t in rows
        if cell.teacher_id is None and cell.class_section_id in section_by_id
    ]

    per_day: dict[tuple[uuid.UUID, int], list] = defaultdict(list)
    names: dict[uuid.UUID, str] = {}
    for cell, cell_day, _s, teacher_name in rows:
        if cell.teacher_id is None:
            continue
        per_day[(cell.teacher_id, cell_day)].append(cell)
        names[cell.teacher_id] = teacher_name or ""
    overloaded = [
        OverloadItem(
            teacher_id=teacher_id,
            teacher_name=names[teacher_id],
            day_of_week=cell_day,
            periods=len(cells),
            cap=DAILY_PERIOD_CAP,
        )
        for (teacher_id, cell_day), cells in per_day.items()
        if len(cells) > DAILY_PERIOD_CAP
    ]

    return ValidationOut(
        empty_slots=empty,
        no_teacher=no_teacher,
        overloaded=overloaded,
        daily_cap=DAILY_PERIOD_CAP,
    )


def publish(db: Session, principal: Teacher, timetable_id: uuid.UUID, payload: VersionIn) -> TimetableOut:
    school_id = _school_id(principal)
    timetable = _load_timetable(db, school_id, timetable_id, lock=True)
    if timetable.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a draft can be published.")
    _require_version(timetable, payload.version)

    # Archive the timetable in force first, so the one-published index is never
    # briefly violated.
    db.query(Timetable).filter(
        Timetable.school_id == school_id,
        Timetable.academic_year_id == timetable.academic_year_id,
        Timetable.status == "published",
        Timetable.id != timetable.id,
    ).update({"status": "archived"}, synchronize_session=False)
    db.flush()
    timetable.status = "published"
    timetable.version += 1
    db.commit()
    return _timetable_out(db, timetable)

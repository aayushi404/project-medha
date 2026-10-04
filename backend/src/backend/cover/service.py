"""Daily cover (docs/phase-2/principal_timetable_substitution_architecture.md).

The base timetable is never written here. Absences and cover are recorded per
date, and the day's board is the plan with those overrides applied on read.

A teacher can cover a period only if:
1. they aren't absent for it,
2. they have no base timetable cell in that period,
3. they aren't already covering another class in that period.
Each rule is checked here, and the partial unique index on
`period_substitutions` backs up the third one.
"""

import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date as date_

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.cover.schemas import (
    AbsenceIn,
    AbsenceOut,
    AbsenceResultOut,
    CandidateOut,
    CandidatesOut,
    CoverCellOut,
    DayBoardOut,
    DaySummaryOut,
    SubstitutionIn,
    SubstitutionOut,
    SuggestionItemOut,
    SuggestionOut,
    TimetableRefOut,
    UnavailableOut,
)
from backend.db.models import (
    ClassSection,
    Grade,
    PeriodSlot,
    PeriodSubstitution,
    Subject,
    Teacher,
    TeacherAbsence,
    TeacherSubject,
    TeachingAssignment,
    Timetable,
    TimetableCell,
)
from backend.timetable_planner.schemas import SectionOut
from backend.timetable_planner.service import (
    _current_year,
    _day_slots,
    _school_id,
    _section_label,
    _slot_out,
    _year_sections,
)

UNPROCESSABLE = status.HTTP_422_UNPROCESSABLE_ENTITY


@dataclass
class _Board:
    school_id: uuid.UUID
    date: date_
    day: int
    timetable: Timetable | None
    slots: dict[uuid.UUID, PeriodSlot]
    slot_list: list[PeriodSlot]
    sections: dict[uuid.UUID, tuple[ClassSection, Grade]]
    reserves: dict[uuid.UUID, set[uuid.UUID]]
    teacher_names: dict[uuid.UUID, str]
    teachers: dict[uuid.UUID, Teacher]  # approved teachers of this school
    teacher_subject_ids: dict[uuid.UUID, set[uuid.UUID]]
    teacher_subject_names: dict[uuid.UUID, list[str]]
    subject_names: dict[uuid.UUID, str]
    absences: dict[uuid.UUID, TeacherAbsence]
    cells: list[TimetableCell]
    subs: list[PeriodSubstitution]


def _load_board(db: Session, school_id: uuid.UUID, day_date: date_) -> _Board:
    year = _current_year(db, school_id)
    day = day_date.isoweekday()
    timetable = (
        db.query(Timetable)
        .filter(
            Timetable.school_id == school_id,
            Timetable.academic_year_id == year.id,
            Timetable.status == "published",
        )
        .first()
    )
    slot_list = _day_slots(db, school_id, day)
    sections = {sec.id: (sec, grade) for sec, grade in _year_sections(db, school_id, year.id)}

    reserves: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    if sections:
        for section_id, teacher_id in (
            db.query(TeachingAssignment.class_section_id, TeachingAssignment.teacher_id)
            .filter(TeachingAssignment.class_section_id.in_(list(sections)), TeachingAssignment.role == "reserve")
            .all()
        ):
            reserves[section_id].add(teacher_id)

    all_teachers = db.query(Teacher).filter(Teacher.school_id == school_id, Teacher.role == "teacher").all()
    teacher_names = {t.id: t.full_name for t in all_teachers}
    teachers = {t.id: t for t in all_teachers if t.approval_status == "approved"}

    subject_names = {s.id: s.name for s in db.query(Subject).all()}
    teacher_subject_ids: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    teacher_subject_names: dict[uuid.UUID, set[str]] = defaultdict(set)
    if teachers:
        for teacher_id, subject_id in (
            db.query(TeacherSubject.teacher_id, TeacherSubject.subject_id)
            .filter(TeacherSubject.teacher_id.in_(list(teachers)))
            .all()
        ):
            teacher_subject_ids[teacher_id].add(subject_id)
            teacher_subject_names[teacher_id].add(subject_names[subject_id])

    absences = {
        a.teacher_id: a
        for a in db.query(TeacherAbsence)
        .filter(TeacherAbsence.school_id == school_id, TeacherAbsence.date == day_date)
        .all()
    }

    cells: list[TimetableCell] = []
    subs: list[PeriodSubstitution] = []
    if timetable is not None:
        cells = (
            db.query(TimetableCell)
            .join(PeriodSlot, PeriodSlot.id == TimetableCell.period_slot_id)
            .filter(TimetableCell.timetable_id == timetable.id, PeriodSlot.day_of_week == day)
            .all()
        )
        cell_ids = {c.id for c in cells}
        subs = [
            s
            for s in db.query(PeriodSubstitution)
            .filter(PeriodSubstitution.school_id == school_id, PeriodSubstitution.date == day_date)
            .all()
            if s.timetable_cell_id in cell_ids
        ]

    return _Board(
        school_id=school_id,
        date=day_date,
        day=day,
        timetable=timetable,
        slots={s.id: s for s in slot_list},
        slot_list=slot_list,
        sections=sections,
        reserves=reserves,
        teacher_names=teacher_names,
        teachers=teachers,
        teacher_subject_ids=teacher_subject_ids,
        teacher_subject_names={k: sorted(v) for k, v in teacher_subject_names.items()},
        subject_names=subject_names,
        absences=absences,
        cells=cells,
        subs=subs,
    )


def _covers(absence: TeacherAbsence, period_number: int) -> bool:
    if absence.is_full_day:
        return True
    return absence.from_period_number <= period_number <= absence.to_period_number


def _absent_in(board: _Board, teacher_id: uuid.UUID | None, slot: PeriodSlot) -> TeacherAbsence | None:
    if teacher_id is None:
        return None
    absence = board.absences.get(teacher_id)
    if absence is None or not _covers(absence, slot.period_number):
        return None
    return absence


def _section_label_of(board: _Board, section_id: uuid.UUID) -> str:
    sec, grade = board.sections[section_id]
    return _section_label(sec, grade)


def _sub_out(db: Session, sub: PeriodSubstitution) -> SubstitutionOut:
    name = None
    if sub.substitute_teacher_id is not None:
        teacher = db.get(Teacher, sub.substitute_teacher_id)
        name = teacher.full_name if teacher else None
    return SubstitutionOut(
        id=sub.id,
        date=sub.date,
        timetable_cell_id=sub.timetable_cell_id,
        status=sub.status,
        substitute_teacher_id=sub.substitute_teacher_id,
        substitute_teacher_name=name,
        note=sub.note,
    )


def _absence_out(db: Session, absence: TeacherAbsence) -> AbsenceOut:
    teacher = db.get(Teacher, absence.teacher_id)
    return AbsenceOut(
        id=absence.id,
        teacher_id=absence.teacher_id,
        teacher_name=teacher.full_name if teacher else "",
        date=absence.date,
        is_full_day=absence.is_full_day,
        from_period_number=absence.from_period_number,
        to_period_number=absence.to_period_number,
        reason=absence.reason,
        note=absence.note,
    )


def _candidates(board: _Board, cell: TimetableCell) -> CandidatesOut:
    """Everyone who could cover this cell, split into available (ranked) and
    unavailable (with the reason). The plan's three conditions, plus the tier."""
    slot = board.slots[cell.period_slot_id]

    base_busy: dict[uuid.UUID, str] = {}
    for other in board.cells:
        if other.period_slot_id == slot.id and other.teacher_id and other.id != cell.id:
            base_busy[other.teacher_id] = _section_label_of(board, other.class_section_id)

    sub_busy: dict[uuid.UUID, str] = {}
    for sub in board.subs:
        if (
            sub.period_slot_id == slot.id
            and sub.status == "assigned"
            and sub.substitute_teacher_id
            and sub.timetable_cell_id != cell.id
        ):
            sub_busy[sub.substitute_teacher_id] = _section_label_of(board, sub.class_section_id)

    periods_today = Counter(c.teacher_id for c in board.cells if c.teacher_id)
    covers_today = Counter(
        s.substitute_teacher_id for s in board.subs if s.status == "assigned" and s.substitute_teacher_id
    )
    reserves = board.reserves.get(cell.class_section_id, set())

    available: list[CandidateOut] = []
    unavailable: list[UnavailableOut] = []
    for teacher_id, teacher in board.teachers.items():
        name = teacher.full_name
        if _absent_in(board, teacher_id, slot):
            unavailable.append(UnavailableOut(teacher_id=teacher_id, name=name, photo_url=teacher.photo_url, reason="Absent today"))
        elif teacher_id in base_busy:
            unavailable.append(
                UnavailableOut(
                    teacher_id=teacher_id,
                    name=name,
                    photo_url=teacher.photo_url,
                    reason=f"Teaching {base_busy[teacher_id]} this period",
                )
            )
        elif teacher_id in sub_busy:
            unavailable.append(
                UnavailableOut(
                    teacher_id=teacher_id,
                    name=name,
                    photo_url=teacher.photo_url,
                    reason=f"Already covering {sub_busy[teacher_id]} · P{slot.period_number}",
                )
            )
        else:
            teaches = cell.subject_id in board.teacher_subject_ids.get(teacher_id, set())
            tier = 1 if teacher_id in reserves else 2 if teaches else 3
            available.append(
                CandidateOut(
                    teacher_id=teacher_id,
                    name=name,
                    photo_url=teacher.photo_url,
                    tier=tier,
                    teaches_subject=teaches,
                    subjects=board.teacher_subject_names.get(teacher_id, []),
                    periods_today=periods_today.get(teacher_id, 0),
                    covers_today=covers_today.get(teacher_id, 0),
                )
            )

    available.sort(key=lambda c: (c.tier, c.covers_today, c.periods_today, c.name))
    unavailable.sort(key=lambda u: u.name)
    return CandidatesOut(available=available, unavailable=unavailable)


def _cell_state(board: _Board, cell: TimetableCell, sub: PeriodSubstitution | None) -> str:
    if sub is not None:
        return {"assigned": "covered", "self_study": "self_study", "cancelled": "cancelled"}[sub.status]
    if _absent_in(board, cell.teacher_id, board.slots[cell.period_slot_id]):
        return "needs_cover"
    return "normal"


def day_board(db: Session, principal: Teacher, day_date: date_) -> DayBoardOut:
    board = _load_board(db, _school_id(principal), day_date)
    sub_by_cell = {s.timetable_cell_id: s for s in board.subs}

    cells_out: list[CoverCellOut] = []
    candidates: dict[str, CandidatesOut] = {}
    needs = 0
    resolved = 0
    for cell in sorted(board.cells, key=lambda c: (board.slots[c.period_slot_id].period_number, _section_label_of(board, c.class_section_id))):
        slot = board.slots[cell.period_slot_id]
        sub = sub_by_cell.get(cell.id)
        state = _cell_state(board, cell, sub)
        if state == "needs_cover":
            needs += 1
            candidates[str(cell.id)] = _candidates(board, cell)
        elif state != "normal":
            resolved += 1
        cells_out.append(
            CoverCellOut(
                timetable_cell_id=cell.id,
                class_section_id=cell.class_section_id,
                period_slot_id=slot.id,
                subject_id=cell.subject_id,
                subject_name=board.subject_names.get(cell.subject_id, ""),
                original_teacher_id=cell.teacher_id,
                original_teacher_name=board.teacher_names.get(cell.teacher_id) if cell.teacher_id else None,
                state=state,
                substitute=_sub_out(db, sub) if sub is not None else None,
            )
        )

    return DayBoardOut(
        date=day_date,
        day_of_week=board.day,
        timetable=TimetableRefOut(id=board.timetable.id, name=board.timetable.name) if board.timetable else None,
        summary=DaySummaryOut(absent_count=len(board.absences), needs_cover=needs, resolved=resolved),
        absences=[_absence_out(db, a) for a in sorted(board.absences.values(), key=lambda a: board.teacher_names.get(a.teacher_id, ""))],
        period_slots=[_slot_out(s) for s in board.slot_list],
        class_sections=[
            SectionOut(id=sec.id, label=_section_label(sec, grade), grade_label=grade.label, section=sec.section)
            for sec, grade in board.sections.values()
        ],
        cells=cells_out,
        candidates=candidates,
    )


def candidates_for(db: Session, principal: Teacher, day_date: date_, cell_id: uuid.UUID) -> CandidatesOut:
    board = _load_board(db, _school_id(principal), day_date)
    cell = _require_cell(db, board, cell_id)
    return _candidates(board, cell)


# --- absences ---


def mark_absences(db: Session, principal: Teacher, payload: AbsenceIn) -> AbsenceResultOut:
    school_id = _school_id(principal)
    teacher = db.get(Teacher, payload.teacher_id)
    if (
        teacher is None
        or teacher.school_id != school_id
        or teacher.role != "teacher"
        or teacher.approval_status != "approved"
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Teacher not found.")

    released = 0
    touched: list[TeacherAbsence] = []
    for day_date in sorted(set(payload.dates)):
        absence = (
            db.query(TeacherAbsence)
            .filter(TeacherAbsence.teacher_id == teacher.id, TeacherAbsence.date == day_date)
            .one_or_none()
        )
        if absence is None:
            absence = TeacherAbsence(school_id=school_id, teacher_id=teacher.id, date=day_date)
            db.add(absence)
        absence.is_full_day = payload.is_full_day
        absence.from_period_number = None if payload.is_full_day else payload.from_period_number
        absence.to_period_number = None if payload.is_full_day else payload.to_period_number
        absence.reason = payload.reason
        absence.note = payload.note
        absence.marked_by = principal.id
        db.flush()
        released += _release_covers_by(db, school_id, teacher.id, absence)
        touched.append(absence)

    db.commit()
    return AbsenceResultOut(absences=[_absence_out(db, a) for a in touched], released=released)


def _release_covers_by(db: Session, school_id: uuid.UUID, teacher_id: uuid.UUID, absence: TeacherAbsence) -> int:
    """A teacher who is now absent can't cover. Their covers for the absent
    periods are removed, and those cells turn red again."""
    released = 0
    subs = (
        db.query(PeriodSubstitution)
        .filter(
            PeriodSubstitution.school_id == school_id,
            PeriodSubstitution.date == absence.date,
            PeriodSubstitution.substitute_teacher_id == teacher_id,
            PeriodSubstitution.status == "assigned",
        )
        .all()
    )
    for sub in subs:
        slot = db.get(PeriodSlot, sub.period_slot_id)
        if slot is not None and _covers(absence, slot.period_number):
            db.delete(sub)
            released += 1
    db.flush()
    return released


def unmark_absence(db: Session, principal: Teacher, absence_id: uuid.UUID, force: bool) -> None:
    school_id = _school_id(principal)
    absence = db.get(TeacherAbsence, absence_id)
    if absence is None or absence.school_id != school_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Absence not found.")

    covered = []
    for sub in (
        db.query(PeriodSubstitution)
        .filter(
            PeriodSubstitution.school_id == school_id,
            PeriodSubstitution.date == absence.date,
            PeriodSubstitution.original_teacher_id == absence.teacher_id,
        )
        .all()
    ):
        slot = db.get(PeriodSlot, sub.period_slot_id)
        if slot is not None and _covers(absence, slot.period_number):
            covered.append(sub)

    if covered and not force:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{len(covered)} period(s) already have cover. Removing the absence clears that cover too.",
        )
    for sub in covered:
        db.delete(sub)
    db.delete(absence)
    db.commit()


# --- substitutions ---


def _require_cell(db: Session, board: _Board, cell_id: uuid.UUID) -> TimetableCell:
    cell = db.get(TimetableCell, cell_id)
    if cell is None or board.timetable is None or cell.timetable_id != board.timetable.id:
        raise HTTPException(UNPROCESSABLE, "That period isn't in the published timetable.")
    if cell.period_slot_id not in board.slots:
        raise HTTPException(UNPROCESSABLE, "That period isn't on this day.")
    slot = board.slots[cell.period_slot_id]
    if _absent_in(board, cell.teacher_id, slot) is None:
        name = board.teacher_names.get(cell.teacher_id, "The teacher") if cell.teacher_id else "This period"
        raise HTTPException(UNPROCESSABLE, f"{name} isn't absent in this period, so there's nothing to cover.")
    return cell


def _upsert_sub(
    db: Session,
    board: _Board,
    cell: TimetableCell,
    principal: Teacher,
    status_value: str,
    substitute_id: uuid.UUID | None,
    note: str | None,
) -> PeriodSubstitution:
    sub = (
        db.query(PeriodSubstitution)
        .filter(PeriodSubstitution.date == board.date, PeriodSubstitution.timetable_cell_id == cell.id)
        .one_or_none()
    )
    if sub is None:
        sub = PeriodSubstitution(
            school_id=board.school_id,
            date=board.date,
            timetable_cell_id=cell.id,
            class_section_id=cell.class_section_id,
            period_slot_id=cell.period_slot_id,
            subject_id=cell.subject_id,
            original_teacher_id=cell.teacher_id,
        )
        db.add(sub)
    sub.status = status_value
    sub.substitute_teacher_id = substitute_id
    sub.note = note
    sub.assigned_by = principal.id
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That teacher is already covering another class in this period. Refresh the board and pick someone else.",
        )
    return sub


def _apply(db: Session, principal: Teacher, board: _Board, item: SubstitutionIn) -> PeriodSubstitution:
    cell = _require_cell(db, board, item.timetable_cell_id)
    if item.action == "assign":
        if item.substitute_teacher_id is None:
            raise HTTPException(UNPROCESSABLE, "Choose a teacher to cover this period.")
        result = _candidates(board, cell)
        if not any(c.teacher_id == item.substitute_teacher_id for c in result.available):
            blocked = next((u for u in result.unavailable if u.teacher_id == item.substitute_teacher_id), None)
            if blocked is not None:
                raise HTTPException(UNPROCESSABLE, f"{blocked.name} can't cover this period. {blocked.reason}.")
            raise HTTPException(UNPROCESSABLE, "That teacher isn't available for this period.")
        return _upsert_sub(db, board, cell, principal, "assigned", item.substitute_teacher_id, item.note)
    return _upsert_sub(db, board, cell, principal, "self_study" if item.action == "self_study" else "cancelled", None, item.note)


def apply_substitution(db: Session, principal: Teacher, item: SubstitutionIn) -> SubstitutionOut:
    board = _load_board(db, _school_id(principal), item.date)
    sub = _apply(db, principal, board, item)
    db.commit()
    return _sub_out(db, sub)


def apply_bulk(db: Session, principal: Teacher, day_date: date_, items: list[SubstitutionIn]) -> list[SubstitutionOut]:
    """Accept a whole proposal in one transaction. Any failure rolls it all back."""
    school_id = _school_id(principal)
    out: list[SubstitutionOut] = []
    try:
        for item in items:
            if item.date != day_date:
                raise HTTPException(UNPROCESSABLE, "Every item must be for the same date.")
            board = _load_board(db, school_id, day_date)
            out.append(_sub_out(db, _apply(db, principal, board, item)))
    except HTTPException:
        db.rollback()
        raise
    db.commit()
    return out


def clear_substitution(db: Session, principal: Teacher, sub_id: uuid.UUID) -> None:
    sub = db.get(PeriodSubstitution, sub_id)
    if sub is None or sub.school_id != _school_id(principal):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cover not found.")
    db.delete(sub)
    db.commit()


def suggest(db: Session, principal: Teacher, day_date: date_) -> SuggestionOut:
    """A proposal, never committed. Hardest periods (fewest candidates) choose
    first. Each pick is reserved for that period in the working set, and the
    load counts move with each pick, so one willing teacher doesn't get them all."""
    board = _load_board(db, _school_id(principal), day_date)
    sub_by_cell = {s.timetable_cell_id for s in board.subs}

    needing = [
        cell
        for cell in board.cells
        if cell.id not in sub_by_cell and _absent_in(board, cell.teacher_id, board.slots[cell.period_slot_id])
    ]
    options = {cell.id: _candidates(board, cell) for cell in needing}
    order = sorted(
        needing,
        key=lambda c: (len(options[c.id].available), board.slots[c.period_slot_id].period_number),
    )

    taken: set[tuple[uuid.UUID, uuid.UUID]] = set()
    extra: Counter = Counter()
    items: list[SuggestionItemOut] = []
    for cell in order:
        slot_id = cell.period_slot_id
        pool = [c for c in options[cell.id].available if (c.teacher_id, slot_id) not in taken]
        pool.sort(key=lambda c: (c.tier, c.covers_today + extra[c.teacher_id], c.periods_today, c.name))
        if pool:
            pick = pool[0]
            taken.add((pick.teacher_id, slot_id))
            extra[pick.teacher_id] += 1
            items.append(
                SuggestionItemOut(
                    timetable_cell_id=cell.id,
                    class_section_id=cell.class_section_id,
                    period_slot_id=slot_id,
                    substitute_teacher_id=pick.teacher_id,
                    substitute_teacher_name=pick.name,
                    tier=pick.tier,
                    reason=None,
                )
            )
        else:
            items.append(
                SuggestionItemOut(
                    timetable_cell_id=cell.id,
                    class_section_id=cell.class_section_id,
                    period_slot_id=slot_id,
                    substitute_teacher_id=None,
                    substitute_teacher_name=None,
                    tier=None,
                    reason="Nobody is free for this period. Mark it self-study or cancelled.",
                )
            )
    items.sort(key=lambda i: (board.slots[i.period_slot_id].period_number, _section_label_of(board, i.class_section_id)))
    return SuggestionOut(items=items)

"""The final timetable for a school day (teachers' board).

The principal finalizes a day once every period that needs cover has cover
(or is self-study or cancelled). The result is a snapshot, written to
`daily_timetables`, and the teachers' board reads that. Changing the cover
after finalizing doesn't touch the snapshot; the principal sees that it's
out of date and finalizes again.
"""

import uuid
from datetime import date as date_

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.cover.schemas import FinalDayOut, FinalStatusOut
from backend.cover.service import _Board, _cell_state, _load_board, _section_label_of
from backend.timetable_planner.service import _school_id
from backend.db.models import DailyTimetable, Teacher
from sqlalchemy import func

UNPROCESSABLE = status.HTTP_422_UNPROCESSABLE_ENTITY


def build_payload(board: _Board) -> dict:
    """Everything the teachers' board shows, as plain JSON. Deterministic, so
    the principal's 'up to date' check can compare it with the snapshot."""
    sub_by_cell = {s.timetable_cell_id: s for s in board.subs}
    periods = sorted(board.slot_list, key=lambda s: s.period_number)
    cells = []
    for cell in sorted(
        board.cells,
        key=lambda c: (board.slots[c.period_slot_id].period_number, _section_label_of(board, c.class_section_id)),
    ):
        slot = board.slots[cell.period_slot_id]
        sub = sub_by_cell.get(cell.id)
        state = _cell_state(board, cell, sub)
        if sub is not None and sub.status == "assigned":
            teacher_id = sub.substitute_teacher_id
        elif sub is not None:
            teacher_id = None  # self-study or cancelled: nobody teaches it
        else:
            teacher_id = cell.teacher_id
        cells.append(
            {
                "class_section_id": str(cell.class_section_id),
                "period_slot_id": str(slot.id),
                "subject_name": board.subject_names.get(cell.subject_id, ""),
                "base_teacher_id": str(cell.teacher_id) if cell.teacher_id else None,
                "base_teacher_name": board.teacher_names.get(cell.teacher_id) if cell.teacher_id else None,
                "teacher_id": str(teacher_id) if teacher_id else None,
                "teacher_name": board.teacher_names.get(teacher_id) if teacher_id else None,
                "state": state,
            }
        )
    return {
        "timetable_name": board.timetable.name if board.timetable else None,
        "day_of_week": board.day,
        "period_slots": [
            {
                "id": str(s.id),
                "period_number": s.period_number,
                "label": s.label,
                "starts_at": s.starts_at.strftime("%H:%M") if s.starts_at else None,
                "ends_at": s.ends_at.strftime("%H:%M") if s.ends_at else None,
                "is_break": s.is_break,
            }
            for s in periods
        ],
        "class_sections": [
            {"id": str(sec.id), "label": f"{grade.numeric_level} · {sec.section}", "grade_label": grade.label}
            for sec, grade in sorted(board.sections.values(), key=lambda v: (v[1].numeric_level, v[0].section))
        ],
        "absences": sorted(
            (
                {
                    "teacher_id": str(a.teacher_id),
                    "teacher_name": board.teacher_names.get(a.teacher_id, ""),
                    "is_full_day": a.is_full_day,
                    "from_period_number": a.from_period_number,
                    "to_period_number": a.to_period_number,
                }
                for a in board.absences.values()
            ),
            key=lambda a: a["teacher_name"],
        ),
        "cells": cells,
    }


def _needs_cover(board: _Board) -> int:
    sub_cells = {s.timetable_cell_id for s in board.subs}
    return sum(
        1
        for c in board.cells
        if c.id not in sub_cells and _cell_state(board, c, None) == "needs_cover"
    )


def _status(db: Session, school_id: uuid.UUID, board: _Board, day_date: date_) -> FinalStatusOut:
    row = db.query(DailyTimetable).filter(DailyTimetable.school_id == school_id, DailyTimetable.date == day_date).one_or_none()
    needs = _needs_cover(board)
    if row is None:
        return FinalStatusOut(date=day_date, finalized=False, needs_cover=needs)
    up_to_date = (
        board.timetable is not None
        and row.timetable_id == board.timetable.id
        and row.payload == build_payload(board)
    )
    by = db.get(Teacher, row.finalized_by) if row.finalized_by else None
    return FinalStatusOut(
        date=day_date,
        finalized=True,
        version=row.version,
        finalized_at=row.finalized_at.isoformat(timespec="minutes"),
        finalized_by_name=by.full_name if by else None,
        up_to_date=up_to_date,
        needs_cover=needs,
    )


def final_status(db: Session, principal: Teacher, day_date: date_) -> FinalStatusOut:
    school_id = _school_id(principal)
    return _status(db, school_id, _load_board(db, school_id, day_date), day_date)


def finalize(db: Session, principal: Teacher, day_date: date_) -> FinalStatusOut:
    school_id = _school_id(principal)
    board = _load_board(db, school_id, day_date)
    if board.timetable is None:
        raise HTTPException(UNPROCESSABLE, "There's no published timetable to finalize for this year.")
    needs = _needs_cover(board)
    if needs:
        raise HTTPException(
            UNPROCESSABLE,
            f"{needs} {'period still needs' if needs == 1 else 'periods still need'} cover. "
            "Cover them, or mark them self-study or cancelled, then finalize.",
        )

    payload = build_payload(board)
    row = db.query(DailyTimetable).filter(DailyTimetable.school_id == school_id, DailyTimetable.date == day_date).one_or_none()
    if row is None:
        row = DailyTimetable(school_id=school_id, date=day_date, version=1)
        db.add(row)
    else:
        row.version = (row.version or 0) + 1
    row.timetable_id = board.timetable.id
    row.payload = payload
    row.finalized_by = principal.id
    row.finalized_at = func.now()
    db.commit()
    db.refresh(row)
    return _status(db, school_id, _load_board(db, school_id, day_date), day_date)


def teacher_day(db: Session, teacher: Teacher, day_date: date_) -> FinalDayOut:
    school_id = _school_id(teacher)
    row = db.query(DailyTimetable).filter(DailyTimetable.school_id == school_id, DailyTimetable.date == day_date).one_or_none()
    if row is None:
        return FinalDayOut(date=day_date, finalized=False)
    return FinalDayOut(
        date=day_date,
        finalized=True,
        finalized_at=row.finalized_at.isoformat(timespec="minutes"),
        payload=row.payload,
    )

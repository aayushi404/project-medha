"""Bulk-create student login accounts from a principal's CSV upload.

The browser parses the file and posts its rows here twice: first as a dry run
(the preview the principal reviews), then for real. Both passes run the exact
same validation, so what the preview promised is what gets created -- and if
the roster changed in between, the real pass simply reports it.

An imported student is created the way a teacher-approved registration ends
up: `role='student'`, `approval_status='approved'`, no email or password. The
student then claims the account on the existing "Activate your account" page
by entering their class, roll number and name exactly as imported, and sets
their own credential there -- so a principal never has to hand out passwords.
"""
import re
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth.schemas import _normalize_mobile
from backend.db.models import ApprovalEvent, Grade, Teacher
from backend.principal.schemas import (
    StudentImportIn,
    StudentImportOut,
    StudentImportRowIn,
    StudentImportRowResult,
)
from backend.principal.service import _school_id

_ROMAN = {
    "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6,
    "vii": 7, "viii": 8, "ix": 9, "x": 10, "xi": 11, "xii": 12,
}

_RELATIONS = {
    "father": "father", "पिता": "father",
    "mother": "mother", "माता": "mother", "माँ": "mother", "मां": "mother",
    "guardian": "guardian", "अभिभावक": "guardian",
}


def _clean(value: str | None) -> str:
    """Trim and collapse inner runs of whitespace (spreadsheets love to leave
    double spaces and non-breaking spaces behind)."""
    return " ".join((value or "").split())


def _grade_level(raw: str) -> int | None:
    """Accept the ways a school writes a class: "8", "Class 8", "8th", "VIII",
    "कक्षा 8", and with a section tacked on ("8A", "8-A", "VIII B"). Sections
    aren't part of a login account, so a trailing one is ignored."""
    s = raw.strip().lower()
    s = re.sub(r"^(class|grade|std|standard|कक्षा)[\s.:\-]*", "", s)
    m = re.fullmatch(r"(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-/ ]?\s*[a-z])?", s)
    if m:
        return int(m.group(1))
    m = re.fullmatch(r"([ivx]+)(?:\s*[-/ ]\s*[a-z])?", s)
    if m:
        return _ROMAN.get(m.group(1))
    return None


@dataclass
class _Candidate:
    """A row that passed field validation, waiting on the roster check."""

    line: int
    full_name: str
    grade: Grade
    roll_number: str
    guardian_name: str | None
    guardian_relation: str | None
    guardian_phone: str | None


def _validate_row(
    row: StudentImportRowIn, grades_by_level: dict[int, Grade]
) -> _Candidate | str:
    """A `_Candidate`, or a message saying what to fix in the file."""
    problems: list[str] = []

    full_name = _clean(row.full_name)
    if not full_name:
        problems.append("Name is missing.")
    elif len(full_name) < 2:
        problems.append("Name is too short.")
    elif len(full_name) > 120:
        problems.append("Name is longer than 120 characters.")

    grade_raw = _clean(row.grade)
    grade: Grade | None = None
    if not grade_raw:
        problems.append("Class is missing.")
    else:
        level = _grade_level(grade_raw)
        grade = grades_by_level.get(level) if level is not None else None
        if grade is None:
            available = ", ".join(str(n) for n in sorted(grades_by_level))
            problems.append(f'Class "{grade_raw}" isn\'t on Medha (use one of: {available}).')

    roll_number = _clean(row.roll_number)
    if not roll_number:
        problems.append("Roll number is missing.")
    elif len(roll_number) > 20:
        problems.append("Roll number is longer than 20 characters.")

    guardian_phone: str | None = None
    phone_raw = _clean(row.guardian_phone)
    if phone_raw:
        try:
            guardian_phone = "+91" + _normalize_mobile(phone_raw)
        except ValueError:
            problems.append(f'Guardian phone "{phone_raw}" isn\'t a 10-digit mobile number.')

    guardian_relation: str | None = None
    relation_raw = _clean(row.guardian_relation)
    if relation_raw:
        guardian_relation = _RELATIONS.get(relation_raw.lower())
        if guardian_relation is None:
            problems.append(
                f'Relation "{relation_raw}" should be father, mother or guardian.'
            )

    guardian_name = _clean(row.guardian_name)[:120] or None

    if problems:
        return " ".join(problems)
    assert grade is not None
    return _Candidate(
        line=row.line,
        full_name=full_name,
        grade=grade,
        roll_number=roll_number,
        guardian_name=guardian_name,
        guardian_relation=guardian_relation,
        guardian_phone=guardian_phone,
    )


def _existing_message(existing: Teacher, candidate: _Candidate) -> str:
    where = f"Roll {candidate.roll_number} in {candidate.grade.label}"
    if existing.full_name.lower() != candidate.full_name.lower():
        return f"{where} already belongs to {existing.full_name}."
    if existing.approval_status == "pending":
        return "Already registered by the student — approve it from the Students screen."
    if existing.email is None:
        return "Already has an account, waiting to be activated."
    return "Already has an active account."


def import_students(
    db: Session, principal: Teacher, payload: StudentImportIn
) -> StudentImportOut:
    school_id = _school_id(principal)
    grades_by_level = {g.numeric_level: g for g in db.query(Grade).all()}

    results: dict[int, StudentImportRowResult] = {}  # keyed by position in payload
    candidates: dict[int, _Candidate] = {}
    first_seen: dict[tuple, int] = {}  # (grade_id, roll) -> line it first appeared on

    for i, row in enumerate(payload.rows):
        checked = _validate_row(row, grades_by_level)
        if isinstance(checked, str):
            results[i] = StudentImportRowResult(
                line=row.line,
                status="error",
                message=checked,
                full_name=_clean(row.full_name) or None,
                grade_label=None,
                roll_number=_clean(row.roll_number) or None,
            )
            continue
        key = (checked.grade.id, checked.roll_number)
        if key in first_seen:
            results[i] = StudentImportRowResult(
                line=row.line,
                status="error",
                message=(
                    f"Roll {checked.roll_number} in {checked.grade.label} is also on "
                    f"line {first_seen[key]} of this file."
                ),
                full_name=checked.full_name,
                grade_label=checked.grade.label,
                roll_number=checked.roll_number,
            )
            continue
        first_seen[key] = checked.line
        candidates[i] = checked

    # one query for every (class, roll) the file mentions, rather than per row
    existing_by_key: dict[tuple, Teacher] = {}
    if candidates:
        grade_ids = {c.grade.id for c in candidates.values()}
        rolls = {c.roll_number for c in candidates.values()}
        for s in (
            db.query(Teacher)
            .filter(
                Teacher.role == "student",
                Teacher.school_id == school_id,
                Teacher.grade_id.in_(grade_ids),
                Teacher.roll_number.in_(rolls),
            )
            .all()
        ):
            existing_by_key[(s.grade_id, s.roll_number)] = s

    to_create: list[tuple[_Candidate, Teacher | None]] = []
    for i, c in candidates.items():
        existing = existing_by_key.get((c.grade.id, c.roll_number))
        if existing is not None and existing.approval_status != "rejected":
            results[i] = StudentImportRowResult(
                line=c.line,
                status="exists",
                message=_existing_message(existing, c),
                full_name=c.full_name,
                grade_label=c.grade.label,
                roll_number=c.roll_number,
            )
            continue
        # a rejected registration holds the (school, class, roll) slot in the
        # partial unique index -- reuse that row, as student re-registration does
        to_create.append((c, existing))
        results[i] = StudentImportRowResult(
            line=c.line,
            status="ready" if payload.dry_run else "created",
            message=None,
            full_name=c.full_name,
            grade_label=c.grade.label,
            roll_number=c.roll_number,
        )

    if not payload.dry_run and to_create:
        now = datetime.now(timezone.utc)
        created: list[Teacher] = []
        for c, reused in to_create:
            student = reused or Teacher()
            student.role = "student"
            student.school_id = school_id
            student.grade_id = c.grade.id
            student.roll_number = c.roll_number
            student.full_name = c.full_name
            student.guardian_name = c.guardian_name
            student.guardian_relation = c.guardian_relation
            student.guardian_phone = c.guardian_phone
            student.email = None
            student.password_hash = None
            student.approval_status = "approved"
            student.approved_by = principal.id
            student.approved_at = now
            student.rejection_reason = None
            if reused is None:
                db.add(student)
            created.append(student)
        try:
            db.flush()  # assigns ids for the audit rows
            for student in created:
                db.add(
                    ApprovalEvent(
                        subject_user_id=student.id,
                        actor_user_id=principal.id,
                        action="approved",
                    )
                )
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            # someone registered one of these roll numbers between our check
            # and the insert; nothing was saved, so a fresh preview is safe
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "The student list changed while importing, so nothing was saved. "
                "Please preview the file again.",
            ) from exc

    rows = [results[i] for i in range(len(payload.rows))]
    return StudentImportOut(
        dry_run=payload.dry_run,
        total=len(rows),
        ready=len(to_create),
        created=0 if payload.dry_run else len(to_create),
        exists=sum(1 for r in rows if r.status == "exists"),
        errors=sum(1 for r in rows if r.status == "error"),
        rows=rows,
    )

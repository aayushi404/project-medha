"""Bulk-create student accounts from a principal's CSV upload.

The browser parses the file and posts its rows here twice: first as a dry run
(the preview the principal reviews), then for real. Both passes run the exact
same validation, so what the preview promised is what gets created -- and if
the roster changed in between, the real pass simply reports it.

Each valid row becomes an approved `Student` enrolled in Class + Section for
the school's current academic year (sections that don't exist yet are
created). Every row carries a `login_phone`, the number the student logs in
with; siblings may share one. Imported students have no password; they get
one of two ways in:

* the row has an email -> they're emailed a 7-day "set your password" link
  (a RESET_PASSWORD token, so the existing /reset-password page handles it);
* no email -> they claim the account on /student/claim by entering their
  school, class, section, roll number, name and login phone, and set a password.

A principal never has to hand out passwords.

Admission numbers are no longer read or written. A legacy "Admission No"
column in an old CSV is ignored.
"""
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone

from email_validator import EmailNotValidError, validate_email
from fastapi import BackgroundTasks, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth import emails, tokens
from backend.core import validators
from backend.db.models import (
    AcademicYear,
    ApprovalEvent,
    AuthSession,
    AuthToken,
    ClassSection,
    Grade,
    School,
    Student,
    StudentEnrollment,
    Teacher,
)
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

# same bound as self-registration (student/schemas.py)
_MAX_ROLL = 999


def _clean(value: str | None) -> str:
    """Trim and collapse inner runs of whitespace (spreadsheets love to leave
    double spaces and non-breaking spaces behind)."""
    return " ".join((value or "").split())


def _parse_class(raw: str) -> tuple[int | None, str | None]:
    """(grade level, section or None) from the ways a school writes a class:
    "8", "Class 8", "8th", "VIII", "कक्षा 8", optionally with the section
    attached ("8A", "8-A", "VIII B", "Class 8 A")."""
    s = raw.strip().lower()
    s = re.sub(r"^(class|grade|std|standard|कक्षा)[\s.:\-]*", "", s)
    m = re.fullmatch(r"(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-/ ]?\s*([a-z]))?", s)
    if m:
        return int(m.group(1)), m.group(2)
    m = re.fullmatch(r"([ivx]+)(?:\s*[-/ ]\s*([a-z]))?", s)
    if m and m.group(1) in _ROMAN:
        return _ROMAN[m.group(1)], m.group(2)
    return None, None


@dataclass
class _Candidate:
    """A row that passed field validation, waiting on the roster check."""

    index: int
    line: int
    full_name: str
    grade: Grade
    section: str  # upper-cased
    roll_number: int
    login_phone: str
    email: str | None
    guardian_name: str | None
    guardian_relation: str | None
    guardian_phone: str | None

    @property
    def section_key(self) -> tuple:
        return (self.grade.id, self.section)

    @property
    def class_label(self) -> str:
        return f"{self.grade.label} · {self.section}"


def _validate_row(
    index: int, row: StudentImportRowIn, grades_by_level: dict[int, Grade]
) -> _Candidate | str:
    """A `_Candidate`, or a message saying what to fix in the file."""
    problems: list[str] = []

    full_name = ""
    if not _clean(row.full_name):
        problems.append("Name is missing.")
    else:
        try:
            full_name = validators.clean_name(row.full_name or "", label="Name")
        except ValueError as exc:
            problems.append(str(exc))

    grade_raw = _clean(row.grade)
    grade: Grade | None = None
    section_from_class: str | None = None
    if not grade_raw:
        problems.append("Class is missing.")
    else:
        level, section_from_class = _parse_class(grade_raw)
        grade = grades_by_level.get(level) if level is not None else None
        if grade is None:
            available = ", ".join(str(n) for n in sorted(grades_by_level))
            problems.append(f'Class "{grade_raw}" isn\'t on Medha (use one of: {available}).')

    # an explicit Section column wins; else a section written into the class
    # ("8A"); else "A" -- the section every single-section school uses
    section = (_clean(row.section) or section_from_class or "A").upper()
    if not re.fullmatch(r"[A-Z0-9]{1,5}", section):
        problems.append(f'Section "{_clean(row.section)}" should be a letter like A or B.')

    roll_raw = _clean(row.roll_number)
    roll_number = 0
    if not roll_raw:
        problems.append("Roll number is missing.")
    # "12.0" is what some spreadsheets write for a plain 12
    elif not re.fullmatch(r"\d+(\.0+)?", roll_raw):
        problems.append(f'Roll number "{roll_raw}" must be a whole number.')
    else:
        roll_number = int(float(roll_raw))
        if not 1 <= roll_number <= _MAX_ROLL:
            problems.append(f"Roll number must be between 1 and {_MAX_ROLL}.")

    login_phone: str | None = None
    login_phone_raw = _clean(row.login_phone)
    if not login_phone_raw:
        problems.append("Login phone is missing.")
    else:
        try:
            login_phone = validators.e164_indian_mobile(login_phone_raw)
        except ValueError:
            problems.append(f'Login phone "{login_phone_raw}" isn\'t a 10-digit mobile number.')

    email: str | None = None
    email_raw = _clean(row.email)
    if email_raw:
        try:
            email = validate_email(email_raw, check_deliverability=False).normalized.lower()
        except EmailNotValidError:
            problems.append(f'Email "{email_raw}" isn\'t a valid address.')

    guardian_phone: str | None = None
    phone_raw = _clean(row.guardian_phone)
    if phone_raw:
        try:
            guardian_phone = validators.e164_indian_mobile(phone_raw)
        except ValueError:
            problems.append(f'Guardian phone "{phone_raw}" isn\'t a 10-digit mobile number.')

    guardian_relation: str | None = None
    relation_raw = _clean(row.guardian_relation)
    if relation_raw:
        guardian_relation = _RELATIONS.get(relation_raw.lower())
        if guardian_relation is None:
            problems.append(f'Relation "{relation_raw}" should be father, mother or guardian.')

    guardian_name: str | None = None
    if _clean(row.guardian_name):
        try:
            guardian_name = validators.clean_name(row.guardian_name or "", label="Guardian name")
        except ValueError as exc:
            problems.append(str(exc))

    if problems:
        return " ".join(problems)
    assert grade is not None and login_phone is not None
    return _Candidate(
        index=index,
        line=row.line,
        full_name=full_name,
        grade=grade,
        section=section,
        roll_number=roll_number,
        login_phone=login_phone,
        email=email,
        guardian_name=guardian_name,
        guardian_relation=guardian_relation,
        guardian_phone=guardian_phone,
    )


def _occupied_message(student: Student, c: _Candidate) -> str:
    if student.full_name.lower() != c.full_name.lower():
        return f"Roll {c.roll_number} in {c.class_label} already belongs to {student.full_name}."
    if student.approval_status == "pending":
        return "Already registered by the student — approve it from the Students screen."
    if student.password_hash is None:
        return "Already has an account, waiting for the student to set a password."
    return "Already has an active account."


def import_students(
    db: Session,
    principal: Teacher,
    payload: StudentImportIn,
    background: BackgroundTasks | None = None,
) -> StudentImportOut:
    school_id = _school_id(principal)
    year = (
        db.query(AcademicYear)
        .filter(AcademicYear.school_id == school_id, AcademicYear.is_current.is_(True))
        .first()
    )
    if year is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Set up your school's current academic year first (Classes → Academic year), then import.",
        )

    grades_by_level = {g.numeric_level: g for g in db.query(Grade).all()}
    results: dict[int, StudentImportRowResult] = {}  # keyed by position in payload

    def result(c: _Candidate, status_: str, message: str | None) -> StudentImportRowResult:
        return StudentImportRowResult(
            line=c.line,
            status=status_,
            message=message,
            full_name=c.full_name,
            class_label=c.class_label,
            roll_number=c.roll_number,
            email=c.email,
        )

    # --- 1. field validation + duplicates within the file -----------------
    candidates: list[_Candidate] = []
    seen_roll: dict[tuple, int] = {}
    seen_email: dict[str, int] = {}
    for i, row in enumerate(payload.rows):
        checked = _validate_row(i, row, grades_by_level)
        if isinstance(checked, str):
            results[i] = StudentImportRowResult(
                line=row.line,
                status="error",
                message=checked,
                full_name=_clean(row.full_name) or None,
                class_label=None,
                roll_number=None,
                email=None,
            )
            continue
        c = checked
        roll_key = (*c.section_key, c.roll_number)
        dup: str | None = None
        if roll_key in seen_roll:
            dup = f"Roll {c.roll_number} in {c.class_label} is also on line {seen_roll[roll_key]} of this file."
        elif c.email and c.email in seen_email:
            dup = f"Email {c.email} is also on line {seen_email[c.email]} of this file."
        if dup:
            results[i] = result(c, "error", dup)
            continue
        seen_roll[roll_key] = c.line
        if c.email:
            seen_email[c.email] = c.line
        candidates.append(c)

    # --- 2. what's already on the roster (a few set-based queries) --------
    sections = {
        (s.grade_id, s.section.upper()): s
        for s in db.query(ClassSection).filter(
            ClassSection.school_id == school_id, ClassSection.academic_year_id == year.id
        )
    }
    occupant: dict[tuple, Student] = {}  # (grade_id, SECTION, roll) -> student
    if candidates and sections:
        key_of_section = {s.id: key for key, s in sections.items()}
        for enrollment, student in (
            db.query(StudentEnrollment, Student)
            .join(Student, StudentEnrollment.student_id == Student.id)
            .filter(StudentEnrollment.class_section_id.in_(key_of_section))
        ):
            # the unique (section, roll) constraint also covers students who
            # have left, so they still hold their roll number
            if enrollment.roll_number is not None:
                occupant[(*key_of_section[enrollment.class_section_id], enrollment.roll_number)] = student

    by_email: dict[str, Student] = {}
    emails_in_file = {c.email for c in candidates if c.email}
    if emails_in_file:
        for s in db.query(Student).filter(Student.email.in_(emails_in_file)):
            by_email[s.email] = s

    # --- 3. decide each row ----------------------------------------------
    to_create: list[tuple[_Candidate, Student | None]] = []
    for c in candidates:
        holder = occupant.get((*c.section_key, c.roll_number))
        if holder is not None and holder.approval_status != "rejected":
            results[c.index] = result(c, "exists", _occupied_message(holder, c))
            continue
        # a rejected registration still holds its (section, roll) slot --
        # reuse that row, the way student re-registration does
        reuse = holder
        email_holder = by_email.get(c.email) if c.email else None
        if email_holder is not None and email_holder is not reuse:
            results[c.index] = result(c, "error", f"{c.email} is already used by another student account.")
            continue
        to_create.append((c, reuse))
        results[c.index] = result(c, "ready" if payload.dry_run else "created", None)

    new_sections: dict[tuple, _Candidate] = {}
    for c, _ in to_create:
        if c.section_key not in sections:
            new_sections.setdefault(c.section_key, c)

    # --- 4. write -----------------------------------------------------------
    invites: list[tuple[str, str, str]] = []  # (email, name, link)
    if not payload.dry_run and to_create:
        now = datetime.now(timezone.utc)
        try:
            for key in new_sections:
                grade_id, section = key
                sections[key] = ClassSection(
                    school_id=school_id, academic_year_id=year.id, grade_id=grade_id, section=section
                )
                db.add(sections[key])

            created: list[tuple[_Candidate, Student, bool]] = []
            for c, reused in to_create:
                student = reused or Student(school_id=school_id)
                if reused is not None:
                    # a fresh start for the old rejected row: no live session,
                    # no unused reset link that could take the account over
                    db.query(AuthToken).filter(
                        AuthToken.student_id == reused.id, AuthToken.used_at.is_(None)
                    ).update({AuthToken.used_at: now}, synchronize_session=False)
                    db.query(AuthSession).filter(
                        AuthSession.student_id == reused.id, AuthSession.revoked_at.is_(None)
                    ).update({AuthSession.revoked_at: now}, synchronize_session=False)
                    student.google_sub = None
                student.full_name = c.full_name
                student.phone_number = c.login_phone
                student.guardian_name = c.guardian_name
                student.guardian_relation = c.guardian_relation
                student.guardian_phone = c.guardian_phone
                student.email = c.email
                student.password_hash = None
                student.email_verified_at = None
                student.status = "active"
                student.approval_status = "approved"
                student.approved_by = principal.id
                student.approved_at = now
                student.rejection_reason = None
                if reused is None:
                    db.add(student)
                created.append((c, student, reused is not None))
            db.flush()  # ids for sections, enrollments, audit rows and tokens

            for c, student, was_reused in created:
                enrollment = None
                if was_reused:  # the rejected row already has this year's enrollment
                    enrollment = (
                        db.query(StudentEnrollment)
                        .filter(
                            StudentEnrollment.student_id == student.id,
                            StudentEnrollment.academic_year_id == year.id,
                        )
                        .first()
                    )
                if enrollment is None:
                    enrollment = StudentEnrollment(
                        student_id=student.id, academic_year_id=year.id, enrolled_on=date.today()
                    )
                    db.add(enrollment)
                enrollment.class_section_id = sections[c.section_key].id
                enrollment.roll_number = c.roll_number
                enrollment.left_on = None
                db.add(
                    ApprovalEvent(subject_student_id=student.id, actor_user_id=principal.id, action="approved")
                )
                if c.email:
                    link = tokens.issue(db, student, tokens.RESET_PASSWORD, ttl=tokens.INVITE_TTL, commit=False)
                    invites.append((c.email, c.full_name, link))
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            # someone registered one of these roll numbers / emails between our
            # check and the insert; nothing was saved, so a fresh preview is safe
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "The student list changed while importing, so nothing was saved. "
                "Please preview the file again.",
            ) from exc

        if invites and background is not None:
            school = db.get(School, school_id)
            school_name = school.name if school else "Your school"
            for to, name, link in invites:
                emails.student_invite(background, to, name, school_name, link)

    rows = [results[i] for i in range(len(payload.rows))]
    return StudentImportOut(
        dry_run=payload.dry_run,
        total=len(rows),
        ready=len(to_create),
        created=0 if payload.dry_run else len(to_create),
        invited=sum(1 for c, _ in to_create if c.email),
        exists=sum(1 for r in rows if r.status == "exists"),
        errors=sum(1 for r in rows if r.status == "error"),
        new_sections=[
            c.class_label
            for c in sorted(new_sections.values(), key=lambda c: (c.grade.numeric_level, c.section))
        ],
        academic_year_label=year.label,
        rows=rows,
    )

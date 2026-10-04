from backend.student_profile import service as student_profile_service
from backend.student_profile.schemas import StudentProfileOut
import uuid
from datetime import date as date_

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_principal
from backend.auth.schemas import ResetCodeOut
from backend.db.models import Teacher
from backend.db.session import get_db
from backend.principal import service, student_import
from backend.principal.schemas import (
    AcademicYearCreateIn,
    AcademicYearOut,
    ApprovalResult,
    ClassSectionCreateIn,
    ClassSectionSummary,
    ClassSectionUpdateIn,
    PendingTeacher,
    PrincipalStats,
    RejectIn,
    ReserveTeacherIn,
    ReserveTeacherOut,
    RosterStudentItem,
    StudentAdmissionIn,
    StudentImportIn,
    StudentImportOut,
    StudentImportRowResult,
    SchoolAttendanceSummaryOut,
    StudentRosterItem,
    SubjectTeacherIn,
    TeacherProfile,
    TeacherRosterItem,
    TeachingAssignmentIn,
    TeachingAssignmentOut,
)

router = APIRouter(
    prefix="/principal", tags=["principal"], dependencies=[Depends(require_principal)]
)


@router.get("/stats", response_model=PrincipalStats)
def stats(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> PrincipalStats:
    return service.get_stats(db, principal)


@router.get("/teachers", response_model=list[TeacherRosterItem])
def teachers(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> list[TeacherRosterItem]:
    return service.list_teachers(db, principal)


@router.get("/students", response_model=list[StudentRosterItem])
def students(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> list[StudentRosterItem]:
    return service.list_students(db, principal)


@router.get("/students/search", response_model=list[StudentRosterItem])
def search_students(
    q: str = Query(min_length=2, max_length=80),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[StudentRosterItem]:
    """Find a student of this school by name, email or login phone. Declared
    before /students/{student_id} so "search" isn't read as an id."""
    return service.search_students(db, principal, q)


@router.post("/students/import", response_model=StudentImportOut)
def import_students(
    payload: StudentImportIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> StudentImportOut:
    """Bulk admission from a CSV the browser has parsed. Send `dry_run: true`
    first for the per-row preview, then `false` to admit. Every admitted
    student is approved at once and logs in with the password in the row."""
    return student_import.import_students(db, principal, payload)


@router.post("/students/admit", response_model=StudentImportRowResult)
def admit_student(
    payload: StudentAdmissionIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> StudentImportRowResult:
    """Admit one student by hand. Approved immediately, no teacher step."""
    return student_import.admit_student(db, principal, payload)


@router.get("/sections", response_model=list[ClassSectionSummary])
def class_sections(
    academic_year_id: uuid.UUID | None = Query(default=None),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[ClassSectionSummary]:
    return service.list_class_sections(db, principal, academic_year_id)


@router.get("/sections/{section_id}", response_model=ClassSectionSummary)
def class_section_detail(
    section_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> ClassSectionSummary:
    return service.get_class_section(db, principal, section_id)


@router.get("/sections/{section_id}/students", response_model=list[RosterStudentItem])
def section_roster(
    section_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[RosterStudentItem]:
    return service.list_section_students(db, principal, section_id)


@router.get("/students/{student_id}", response_model=StudentProfileOut)
def student_profile(
    student_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> StudentProfileOut:
    """Kept for existing principal screens. The shared route is /students/{id}."""
    return student_profile_service.student_profile(db, principal, student_id)


@router.get("/academic-years", response_model=list[AcademicYearOut])
def academic_years(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> list[AcademicYearOut]:
    return service.list_academic_years(db, principal)


@router.post("/academic-years", response_model=AcademicYearOut)
def create_academic_year(
    payload: AcademicYearCreateIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> AcademicYearOut:
    return service.create_academic_year(db, principal, payload)


@router.post("/sections", response_model=ClassSectionSummary)
def create_class_section(
    payload: ClassSectionCreateIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> ClassSectionSummary:
    return service.create_class_section(db, principal, payload)


@router.patch("/sections/{section_id}", response_model=ClassSectionSummary)
def update_class_section(
    section_id: uuid.UUID,
    payload: ClassSectionUpdateIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> ClassSectionSummary:
    return service.update_class_section(db, principal, section_id, payload)


@router.get(
    "/sections/{section_id}/teaching-assignments", response_model=list[TeachingAssignmentOut]
)
def section_teaching_assignments(
    section_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[TeachingAssignmentOut]:
    return service.list_section_teaching_assignments(db, principal, section_id)


@router.post("/teaching-assignments", response_model=TeachingAssignmentOut)
def create_teaching_assignment(
    payload: TeachingAssignmentIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> TeachingAssignmentOut:
    return service.create_teaching_assignment(db, principal, payload)


@router.delete("/teaching-assignments/{assignment_id}", status_code=204)
def delete_teaching_assignment(
    assignment_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> None:
    service.delete_teaching_assignment(db, principal, assignment_id)


@router.put(
    "/sections/{section_id}/subjects/{subject_id}/teacher",
    response_model=list[TeachingAssignmentOut],
)
def set_subject_teacher(
    section_id: uuid.UUID,
    subject_id: uuid.UUID,
    payload: SubjectTeacherIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[TeachingAssignmentOut]:
    return service.set_subject_teacher(
        db, principal, section_id, subject_id, payload.teacher_id
    )


@router.get("/teachers/pending", response_model=list[PendingTeacher])
def pending_teachers(
    principal: Teacher = Depends(require_principal), db: Session = Depends(get_db)
) -> list[PendingTeacher]:
    return service.list_pending_teachers(db, principal)


@router.get("/teachers/{teacher_id}", response_model=TeacherProfile)
def teacher_profile(
    teacher_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> TeacherProfile:
    return service.get_teacher_profile(db, principal, teacher_id)


@router.post("/teachers/{teacher_id}/approve", response_model=ApprovalResult)
def approve_teacher(
    teacher_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.approve_teacher(db, principal, teacher_id)


@router.post("/teachers/{teacher_id}/reset-code", response_model=ResetCodeOut)
def reset_teacher_code(
    teacher_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> ResetCodeOut:
    return service.issue_teacher_reset_code(db, principal, teacher_id)


@router.post("/teachers/{teacher_id}/reject", response_model=ApprovalResult)
def reject_teacher(
    teacher_id: uuid.UUID,
    payload: RejectIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> ApprovalResult:
    return service.reject_teacher(db, principal, teacher_id, payload.reason)


@router.get("/attendance/summary", response_model=SchoolAttendanceSummaryOut)
def attendance_summary(
    date: date_ | None = Query(default=None, description="Defaults to today."),
    academic_year_id: uuid.UUID | None = Query(default=None),
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> SchoolAttendanceSummaryOut:
    return service.get_attendance_summary(
        db, principal, date or date_.today(), academic_year_id
    )


@router.get("/sections/{section_id}/reserve-teachers", response_model=list[ReserveTeacherOut])
def reserve_teachers(
    section_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[ReserveTeacherOut]:
    return service.list_reserve_teachers(db, principal, section_id)


@router.post("/sections/{section_id}/reserve-teachers", response_model=list[ReserveTeacherOut])
def add_reserve_teacher(
    section_id: uuid.UUID,
    payload: ReserveTeacherIn,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[ReserveTeacherOut]:
    return service.add_reserve_teacher(db, principal, section_id, payload.teacher_id)


@router.delete("/sections/{section_id}/reserve-teachers/{teacher_id}", response_model=list[ReserveTeacherOut])
def remove_reserve_teacher(
    section_id: uuid.UUID,
    teacher_id: uuid.UUID,
    principal: Teacher = Depends(require_principal),
    db: Session = Depends(get_db),
) -> list[ReserveTeacherOut]:
    return service.remove_reserve_teacher(db, principal, section_id, teacher_id)

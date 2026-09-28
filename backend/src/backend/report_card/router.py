import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from backend.core.rate_limits import by_actor, by_ip
from backend.core.uploads import read_limited, require_kind
from backend.auth.dependencies import get_current_user, require_teacher
from backend.db.models import Student, Teacher
from backend.db.session import get_db
from backend.omr.schemas import OMREvaluationResponse
from backend.report_card import service
from backend.report_card.schemas import (
    BulkReportCardMarksIn,
    BulkReportCardMarksOut,
    OMRUploadResponse,
    ReportCardMarkIn,
    ReportCardMarkOut,
    ReportCardOut,
)

router = APIRouter(prefix="/report-card", tags=["report-card"])


@router.post("/marks", response_model=ReportCardMarkOut)
def upsert_mark(
    payload: ReportCardMarkIn, teacher: Teacher = Depends(require_teacher), db: Session = Depends(get_db)
) -> ReportCardMarkOut:
    return service.upsert_mark(db, teacher, payload)


@router.post("/bulk-marks", response_model=BulkReportCardMarksOut)
def bulk_upsert_marks(
    payload: BulkReportCardMarksIn,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> BulkReportCardMarksOut:
    return service.bulk_upsert_marks(db, teacher, payload)


@router.get("/class-marks", response_model=list[ReportCardMarkOut])
def get_class_marks(
    class_section_id: uuid.UUID,
    subject_id: uuid.UUID,
    term: str,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[ReportCardMarkOut]:
    return service.get_class_marks(db, teacher, class_section_id, subject_id, term)


@router.post("/omr/upload", response_model=OMRUploadResponse, dependencies=[by_actor("omr", limit=30, window_seconds=600)])
async def upload_omr(
    file: UploadFile = File(...),
    teacher: Teacher = Depends(require_teacher),
) -> OMRUploadResponse:
    content = await read_limited(file, 10 * 1024 * 1024)
    require_kind(content, {"pdf", "png", "jpeg"}, "Unsupported file format. Please upload PDF, JPG, or PNG.")
    file_size = len(content)

    return OMRUploadResponse(
        file_name=(file.filename or 'upload')[:120],
        file_size_bytes=file_size,
        status="uploaded",
        message="OMR sheet uploaded successfully. Evaluation service boundary ready.",
    )


@router.post("/omr/evaluate", response_model=OMREvaluationResponse, dependencies=[by_actor("omr", limit=30, window_seconds=600)])
async def evaluate_omr(
    class_section_id: uuid.UUID,
    max_marks: float = Query(default=100.0, gt=0, le=1000),
    file: UploadFile = File(...),
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> OMREvaluationResponse:
    from backend.omr import service as omr_service

    return await omr_service.evaluate_omr_upload(
        db=db, teacher=teacher, file=file, class_section_id=class_section_id, max_marks=max_marks
    )



@router.get("/{student_id}", response_model=ReportCardOut)
def get_report_card(
    student_id: uuid.UUID,
    user: Teacher | Student = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportCardOut:
    return service.get_report_card(db, user, student_id)


@router.delete("/marks/{student_id}/{subject_id}/{term}")
def delete_mark(
    student_id: uuid.UUID,
    subject_id: uuid.UUID,
    term: str,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    service.delete_mark(db, teacher, student_id, subject_id, term)
    return {"status": "deleted"}



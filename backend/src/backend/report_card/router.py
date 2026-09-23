import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_user, require_teacher
from backend.db.models import Teacher
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
    grade_id: uuid.UUID,
    subject_id: uuid.UUID,
    term: str,
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[ReportCardMarkOut]:
    return service.get_class_marks(db, teacher, grade_id, subject_id, term)


@router.post("/omr/upload", response_model=OMRUploadResponse)
async def upload_omr(
    file: UploadFile = File(...),
    teacher: Teacher = Depends(require_teacher),
) -> OMRUploadResponse:
    if not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file uploaded.")

    filename_lower = file.filename.lower()
    valid_exts = (".pdf", ".png", ".jpg", ".jpeg")
    if not any(filename_lower.endswith(ext) for ext in valid_exts):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Unsupported file format. Please upload PDF, JPG, or PNG."
        )

    content = await file.read()
    file_size = len(content)
    if file_size > 10 * 1024 * 1024:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File size exceeds limit of 10MB.")

    return OMRUploadResponse(
        file_name=file.filename,
        file_size_bytes=file_size,
        status="uploaded",
        message="OMR sheet uploaded successfully. Evaluation service boundary ready.",
    )


@router.post("/omr/evaluate", response_model=OMREvaluationResponse)
async def evaluate_omr(
    grade_id: uuid.UUID,
    max_marks: float = 100.0,
    file: UploadFile = File(...),
    teacher: Teacher = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> OMREvaluationResponse:
    from backend.omr import service as omr_service

    return await omr_service.evaluate_omr_upload(
        db=db, teacher=teacher, file=file, grade_id=grade_id, max_marks=max_marks
    )



@router.get("/{student_id}", response_model=ReportCardOut)
def get_report_card(
    student_id: uuid.UUID, user: Teacher = Depends(get_current_user), db: Session = Depends(get_db)
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



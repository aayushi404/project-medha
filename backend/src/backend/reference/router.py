import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.core.rate_limits import by_actor, by_ip
from backend.db.models import AcademicYear, Block, ClassSection, District, Grade, School, Subject
from backend.db.session import get_db
from backend.reference.schemas import (
    ClassSectionOptionOut,
    GradeOut,
    SchoolSearchResult,
    SubjectOut,
)

router = APIRouter(tags=["reference"])


@router.get("/reference/grades", response_model=list[GradeOut], dependencies=[by_ip("ref", limit=600, window_seconds=900)])
def list_grades(db: Session = Depends(get_db)) -> list[Grade]:
    return db.query(Grade).order_by(Grade.numeric_level).all()


@router.get("/reference/subjects", response_model=list[SubjectOut], dependencies=[by_ip("ref", limit=600, window_seconds=900)])
def list_subjects(
    grade_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Subject]:
    """Unfiltered when `grade_id` is omitted (back-compat for callers that
    want the full catalog). With `grade_id`, only subjects whose
    min/max_grade_level range covers that grade's numeric_level -- so a Class
    6 section's subject picker doesn't offer Physics, and a Class 11 section's
    doesn't offer the 6-10 composite Science/Social Science."""
    query = db.query(Subject)
    if grade_id is not None:
        grade = db.get(Grade, grade_id)
        if grade is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Grade not found.")
        level = grade.numeric_level
        query = query.filter(
            or_(Subject.min_grade_level.is_(None), Subject.min_grade_level <= level),
            or_(Subject.max_grade_level.is_(None), Subject.max_grade_level >= level),
        )
    return query.order_by(Subject.name).all()


@router.get("/schools/search", response_model=list[SchoolSearchResult], dependencies=[by_ip("school_search", limit=300, window_seconds=900)])
def search_schools(
    q: str = Query(..., min_length=3, max_length=100),
    db: Session = Depends(get_db),
) -> list[SchoolSearchResult]:
    # escape LIKE wildcards so "%" / "_" match literally instead of dumping the table
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    like = f"%{escaped}%"
    rows = (
        db.query(School, District.name, Block.name)
        .join(District, School.district_id == District.id)
        .outerjoin(Block, School.block_id == Block.id)
        .filter(or_(School.name.ilike(like), School.udise_code.ilike(like)))
        .order_by(School.name)
        .limit(10)
        .all()
    )
    return [
        SchoolSearchResult(
            id=school.id,
            name=school.name,
            district_name=district_name,
            block_name=block_name,
            udise_code=school.udise_code,
        )
        for school, district_name, block_name in rows
    ]


@router.get("/reference/class-sections", response_model=list[ClassSectionOptionOut], dependencies=[by_ip("ref", limit=600, window_seconds=900)])
def list_class_sections(
    school_id: uuid.UUID, grade_id: uuid.UUID, db: Session = Depends(get_db)
) -> list[ClassSectionOptionOut]:
    """Sections a student can register into for this school+grade, current
    academic year only. Empty if the school hasn't set up a current year or
    hasn't created any sections for this grade yet -- the caller (the
    registration form) must block, not fall back to anything."""
    rows = (
        db.query(ClassSection)
        .join(AcademicYear, ClassSection.academic_year_id == AcademicYear.id)
        .filter(
            ClassSection.school_id == school_id,
            ClassSection.grade_id == grade_id,
            AcademicYear.is_current.is_(True),
        )
        .order_by(ClassSection.section)
        .all()
    )
    return [ClassSectionOptionOut(id=s.id, section=s.section) for s in rows]

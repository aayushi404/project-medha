from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.db.models import Block, District, Grade, School, Subject
from backend.db.session import get_db
from backend.reference.schemas import GradeOut, SchoolSearchResult, SubjectOut

router = APIRouter(tags=["reference"])


@router.get("/reference/grades", response_model=list[GradeOut])
def list_grades(db: Session = Depends(get_db)) -> list[Grade]:
    return db.query(Grade).order_by(Grade.numeric_level).all()


@router.get("/reference/subjects", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db)) -> list[Subject]:
    return db.query(Subject).order_by(Subject.name).all()


@router.get("/schools/search", response_model=list[SchoolSearchResult])
def search_schools(
    q: str = Query(..., min_length=1, max_length=100),
    db: Session = Depends(get_db),
) -> list[SchoolSearchResult]:
    like = f"%{q}%"
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

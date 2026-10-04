import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.core.images import delete_school_logo, upload_school_logo
from backend.db.models import AcademicYear, District, School, Student, Teacher
from backend.school.schemas import AcademicYearRef, SchoolCardOut


def _school_or_404(db: Session, school_id: uuid.UUID | None) -> tuple[School, str]:
    row = (
        db.query(School, District.name)
        .join(District, School.district_id == District.id)
        .filter(School.id == school_id)
        .one_or_none()
        if school_id is not None
        else None
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No school is linked to this account yet.")
    return row


def _card(db: Session, school: School, district_name: str, *, can_edit: bool) -> SchoolCardOut:
    year = (
        db.query(AcademicYear)
        .filter(AcademicYear.school_id == school.id, AcademicYear.is_current.is_(True))
        .first()
    )
    return SchoolCardOut(
        id=school.id,
        name=school.name,
        district_name=district_name,
        logo_url=school.logo_url,
        academic_year=AcademicYearRef(id=year.id, label=year.label) if year else None,
        can_edit=can_edit,
    )


def school_card(db: Session, actor: Teacher | Student) -> SchoolCardOut:
    school, district_name = _school_or_404(db, actor.school_id)
    is_principal = isinstance(actor, Teacher) and actor.role == "principal"
    return _card(db, school, district_name, can_edit=is_principal)


def _principal_school(db: Session, principal: Teacher) -> tuple[School, str]:
    return _school_or_404(db, principal.school_id)


def rename_school(db: Session, principal: Teacher, name: str) -> SchoolCardOut:
    school, district_name = _principal_school(db, principal)
    school.name = name
    db.commit()
    return _card(db, school, district_name, can_edit=True)


def set_logo(db: Session, principal: Teacher, data: bytes) -> SchoolCardOut:
    school, district_name = _principal_school(db, principal)
    school.logo_url = upload_school_logo(data, school.id)
    db.commit()
    return _card(db, school, district_name, can_edit=True)


def clear_logo(db: Session, principal: Teacher) -> SchoolCardOut:
    school, district_name = _principal_school(db, principal)
    delete_school_logo(school.id)
    school.logo_url = None
    db.commit()
    return _card(db, school, district_name, can_edit=True)

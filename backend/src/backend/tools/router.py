from fastapi import APIRouter, Depends

from backend.auth.dependencies import require_teacher
from backend.db.models import Teacher
from backend.tools import service
from backend.tools.schemas import TranslateIn, TranslateOut

router = APIRouter(prefix="/tools", tags=["tools"], dependencies=[Depends(require_teacher)])


@router.post("/translate", response_model=TranslateOut)
async def translate_text(
    payload: TranslateIn,
    teacher: Teacher = Depends(require_teacher),
) -> TranslateOut:
    _ = teacher
    return await service.translate_or_simplify(payload)

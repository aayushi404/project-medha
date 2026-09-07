import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

QuestionType = Literal["mcq", "short", "truefalse"]
Difficulty = Literal["easy", "medium", "hard"]


class PracticeQuestionIn(BaseModel):
    chapter_id: uuid.UUID
    question: str = Field(min_length=1, max_length=2000)
    type: QuestionType = "mcq"
    options: list[str] | None = None
    answer: str = Field(min_length=1, max_length=1000)
    difficulty: Difficulty = "medium"


class PracticeQuestionOut(BaseModel):
    id: uuid.UUID
    chapter_id: uuid.UUID
    question: str
    type: str
    options: list[str] | None
    answer: str
    difficulty: str
    created_at: datetime

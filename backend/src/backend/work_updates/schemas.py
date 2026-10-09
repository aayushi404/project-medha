import uuid
from datetime import date as date_
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Activity = Literal[
    "taught_chapter",
    "conducted_quiz",
    "hands_on_activity",
    "cleared_doubts",
    "homework_given",
    "revision_done",
    "used_ai_slides",
]
AiRating = Literal["very_helpful", "somewhat_helpful", "neutral", "not_needed"]
Badge = Literal["approved_great", "star_teacher", "well_done", "needs_focus"]


class WorkUpdateCreateIn(BaseModel):
    grade_id: uuid.UUID
    subject_id: uuid.UUID
    chapter_id: uuid.UUID
    activities: list[Activity] = Field(min_length=1)
    topics: list[str] = Field(default_factory=list, max_length=50)
    other_topics: str | None = Field(default=None, max_length=300)
    activity_detail: str | None = Field(default=None, max_length=300)
    ai_usefulness: AiRating
    note: str = Field(min_length=1, max_length=300)


class HomeworkRef(BaseModel):
    id: uuid.UUID
    title: str


class ReactionOut(BaseModel):
    student_id: uuid.UUID
    student_name: str
    value: Literal["approve", "disapprove"]


class WorkUpdateOut(BaseModel):
    """Teacher / principal view: includes who approved and who disapproved."""

    id: uuid.UUID
    teacher_id: uuid.UUID
    teacher_name: str
    work_date: date_
    created_at: datetime
    grade_label: str
    subject_name: str
    chapter_title: str
    activities: list[str]
    topics: list[str]
    other_topics: str | None
    activity_detail: str | None
    homework: list[HomeworkRef]
    ai_usefulness: str
    note: str
    principal_note: str | None
    principal_badge: str | None
    flagged: bool
    feedback_at: datetime | None
    reactions: list[ReactionOut]


class WorkUpdateStudentOut(BaseModel):
    """Student view: counts plus the student's own reaction (other students'
    names stay private to staff)."""

    id: uuid.UUID
    teacher_name: str
    work_date: date_
    created_at: datetime
    grade_label: str
    subject_name: str
    chapter_title: str
    activities: list[str]
    topics: list[str]
    other_topics: str | None
    activity_detail: str | None
    homework: list[HomeworkRef]
    approve_count: int
    disapprove_count: int
    my_reaction: Literal["approve", "disapprove"] | None


class ReactIn(BaseModel):
    value: Literal["approve", "disapprove"] | None


class PrincipalFeedbackIn(BaseModel):
    note: str | None = Field(default=None, max_length=500)
    flagged: bool = False
    badge: Badge | None = None

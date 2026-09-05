"""Pydantic shapes for content generation.

Two registries, keyed by generation `type`:
  - PARAM_MODELS   -- validates the teacher's form inputs (request body)
  - CONTENT_MODELS -- validates the LLM's output before it is persisted

Content models lean lenient (coerce + clamp in `mode="before"` validators,
like `backend.ppt.schema`); a hard `ValidationError` in the pipeline marks the
generation `failed`. Every shape change must bump the type's prompt VERSION.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.ppt.schema import DeckSpec  # presentation content == the slide spec

SUPPORTED_TYPES = (
    "lesson_plan",
    "presentation",
    "question_paper",
    "notes",
    "quiz",
)


def _clip(value: object, limit: int) -> str:
    return "" if value is None else str(value).strip()[:limit]


# --------------------------------------------------------------------- params


class QuizParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    question_count: int = Field(default=6, ge=3, le=20)
    difficulty: Literal["easy", "medium", "hard", "mixed"] = "mixed"
    types: list[Literal["mcq", "short", "truefalse"]] = Field(
        default_factory=lambda: ["mcq", "short", "truefalse"]
    )

    @field_validator("types")
    @classmethod
    def _non_empty(cls, v: list[str]) -> list[str]:
        return v or ["mcq", "short", "truefalse"]


class NotesParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    depth: Literal["summary", "standard", "detailed"] = "standard"
    include_key_terms: bool = True


class LessonPlanParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    periods: int = Field(default=3, ge=1, le=8)
    focus: str = Field(default="", max_length=500)


class QuestionPaperParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    total_marks: int = Field(default=20, ge=5, le=100)
    duration_min: int = Field(default=40, ge=10, le=180)
    mcq_count: int = Field(default=5, ge=0, le=40)
    short_count: int = Field(default=3, ge=0, le=30)
    long_count: int = Field(default=2, ge=0, le=15)

    @field_validator("long_count")
    @classmethod
    def _at_least_one_question(cls, v: int, info) -> int:
        counts = info.data.get("mcq_count", 0) + info.data.get("short_count", 0) + v
        if counts == 0:
            raise ValueError("at least one of mcq_count / short_count / long_count must be > 0")
        return v


class PresentationParams(BaseModel):
    model_config = ConfigDict(extra="ignore")

    slide_count: int = Field(default=8, ge=4, le=15)
    detail: Literal["simple", "detailed"] = "simple"
    include_notes: bool = True


PARAM_MODELS: dict[str, type[BaseModel]] = {
    "quiz": QuizParams,
    "notes": NotesParams,
    "lesson_plan": LessonPlanParams,
    "question_paper": QuestionPaperParams,
    "presentation": PresentationParams,
}


# -------------------------------------------------------------------- content


class QuizQuestion(BaseModel):
    model_config = ConfigDict(extra="ignore")

    q: str
    type: Literal["mcq", "short", "truefalse"] = "mcq"
    options: list[str] = Field(default_factory=list)
    answer: str = ""
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    explanation: str | None = None

    @field_validator("q", "answer", mode="before")
    @classmethod
    def _s(cls, v: object) -> str:
        return _clip(v, 600)

    @field_validator("options", mode="before")
    @classmethod
    def _opts(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        return [s for s in (_clip(i, 300) for i in v) if s][:6]

    @field_validator("explanation", mode="before")
    @classmethod
    def _expl(cls, v: object) -> str | None:
        s = _clip(v, 600)
        return s or None


class QuizContent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    questions: list[QuizQuestion] = Field(min_length=1)

    @field_validator("questions", mode="before")
    @classmethod
    def _cap(cls, v: object) -> object:
        return v[:25] if isinstance(v, list) else v


class NotesSection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    heading: str = ""
    body_md: str = ""
    key_points: list[str] = Field(default_factory=list)

    @field_validator("heading", mode="before")
    @classmethod
    def _h(cls, v: object) -> str:
        return _clip(v, 200)

    @field_validator("body_md", mode="before")
    @classmethod
    def _b(cls, v: object) -> str:
        return _clip(v, 6000)

    @field_validator("key_points", mode="before")
    @classmethod
    def _kp(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        return [s for s in (_clip(i, 400) for i in v) if s][:12]


class NotesTerm(BaseModel):
    model_config = ConfigDict(extra="ignore")

    term: str = ""
    meaning: str = ""

    @field_validator("term", "meaning", mode="before")
    @classmethod
    def _s(cls, v: object) -> str:
        return _clip(v, 500)


class NotesContent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sections: list[NotesSection] = Field(min_length=1)
    summary: str = ""
    important_terms: list[NotesTerm] = Field(default_factory=list)

    @field_validator("sections", mode="before")
    @classmethod
    def _cap(cls, v: object) -> object:
        return v[:20] if isinstance(v, list) else v

    @field_validator("summary", mode="before")
    @classmethod
    def _sum(cls, v: object) -> str:
        return _clip(v, 3000)

    @field_validator("important_terms", mode="before")
    @classmethod
    def _terms(cls, v: object) -> object:
        return v[:30] if isinstance(v, list) else []


class LessonPeriod(BaseModel):
    model_config = ConfigDict(extra="ignore")

    period_no: int = 1
    concept: str = ""
    learning_objective: str = ""
    learning_outcomes: str = ""
    teacher_learning_process: str = ""
    assessment: str = ""
    resources: str = ""

    @field_validator(
        "concept",
        "learning_objective",
        "learning_outcomes",
        "teacher_learning_process",
        "assessment",
        "resources",
        mode="before",
    )
    @classmethod
    def _s(cls, v: object) -> str:
        return _clip(v, 4000)


class LessonPlanContent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    topic: str = ""
    periods: int = 1
    periods_detail: list[LessonPeriod] = Field(min_length=1)
    homework: str | None = None

    @field_validator("topic", mode="before")
    @classmethod
    def _t(cls, v: object) -> str:
        return _clip(v, 300)

    @field_validator("periods_detail", mode="before")
    @classmethod
    def _cap(cls, v: object) -> object:
        return v[:8] if isinstance(v, list) else v

    @field_validator("homework", mode="before")
    @classmethod
    def _hw(cls, v: object) -> str | None:
        s = _clip(v, 2000)
        return s or None


class PaperQuestion(BaseModel):
    model_config = ConfigDict(extra="ignore")

    text: str = ""
    marks: int = 1
    type: Literal["mcq", "short", "long"] = "short"

    @field_validator("text", mode="before")
    @classmethod
    def _s(cls, v: object) -> str:
        return _clip(v, 1200)


class PaperSection(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = ""
    instructions: str = ""
    questions: list[PaperQuestion] = Field(default_factory=list)

    @field_validator("name", mode="before")
    @classmethod
    def _n(cls, v: object) -> str:
        return _clip(v, 200)

    @field_validator("instructions", mode="before")
    @classmethod
    def _i(cls, v: object) -> str:
        return _clip(v, 800)

    @field_validator("questions", mode="before")
    @classmethod
    def _cap(cls, v: object) -> object:
        return v[:60] if isinstance(v, list) else []


class QuestionPaperContent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    total_marks: int = 0
    duration_min: int = 0
    general_instructions: list[str] = Field(default_factory=list)
    sections: list[PaperSection] = Field(min_length=1)

    @field_validator("general_instructions", mode="before")
    @classmethod
    def _gi(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        return [s for s in (_clip(i, 400) for i in v) if s][:12]

    @field_validator("sections", mode="before")
    @classmethod
    def _cap(cls, v: object) -> object:
        return v[:12] if isinstance(v, list) else v


CONTENT_MODELS: dict[str, type[BaseModel]] = {
    "quiz": QuizContent,
    "notes": NotesContent,
    "lesson_plan": LessonPlanContent,
    "question_paper": QuestionPaperContent,
    "presentation": DeckSpec,
}

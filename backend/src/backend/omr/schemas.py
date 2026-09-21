from pydantic import BaseModel, Field


class BubbleScore(BaseModel):
    digit: int
    fill_ratio: float
    is_filled: bool


class DigitEvaluation(BaseModel):
    place: str  # "hundreds" | "tens" | "units"
    selected_digit: int | None
    confidence: float
    status: str  # "valid" | "ambiguous" | "missing"
    scores: list[BubbleScore]


class StudentOMRResult(BaseModel):
    roll_number: int
    student_id: str | None = None
    student_name: str | None = None
    hundreds: int | None = None
    tens: int | None = None
    units: int | None = None
    detected_marks: float | None = None
    max_marks: float = 100.0
    status: str  # "valid" | "ambiguous" | "missing" | "invalid_max"
    confidence: float
    issues: list[str] = Field(default_factory=list)
    digit_evaluations: dict[str, DigitEvaluation] = Field(default_factory=dict)


class OMRPipelineSummary(BaseModel):
    total_rows: int
    valid_count: int
    needs_review_count: int
    missing_count: int


class OMREvaluationResponse(BaseModel):
    processed: bool
    page_count: int
    summary: OMRPipelineSummary
    results: list[StudentOMRResult]
    debug_job_id: str | None = None
    message: str = "OMR sheet evaluated successfully."

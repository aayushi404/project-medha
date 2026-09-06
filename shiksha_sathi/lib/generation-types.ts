/**
 * Types + constants for the Content Generation domain, mirroring the backend
 * Pydantic shapes in `backend/src/backend/generation/content.py`. Kept in one
 * place so a param default or a content shape only needs updating once.
 */

export type GenerationType =
  | "lesson_plan"
  | "presentation"
  | "question_paper"
  | "notes"
  | "quiz";

/** Types the backend can actually generate today (`SUPPORTED_TYPES`). Kept
 * separate from a future full set (worksheet, notice) so a Quick Action card
 * for those can render disabled without a type error. */
export const SUPPORTED_TYPES: GenerationType[] = [
  "lesson_plan",
  "presentation",
  "question_paper",
  "quiz",
  "notes",
];

export function isGenerationType(v: string): v is GenerationType {
  return (SUPPORTED_TYPES as string[]).includes(v);
}

/** The URL segment for a type's edit route (`/{slug}/edit?id=...`), matching
 * the SAVRA reference's kebab-case route shape. */
export const TYPE_SLUG: Record<GenerationType, string> = {
  lesson_plan: "lesson-plan",
  presentation: "presentation",
  question_paper: "question-paper",
  quiz: "quiz",
  notes: "notes",
};

// --- params (form inputs; defaults mirror the backend PARAM_MODELS) --------

export type QuizParams = {
  question_count: number;
  /** UI labels the "medium" option "Standard". */
  difficulty: "easy" | "medium" | "hard" | "mixed";
  time_limit_min: number;
  focus: string;
  types: ("mcq" | "short" | "truefalse")[];
};

export type NotesParams = {
  depth: "summary" | "standard" | "detailed";
  include_key_terms: boolean;
};

export type LessonPlanParams = {
  periods: number;
  focus: string;
};

/** The five question types on the Question Paper wizard, in display order. */
export const PAPER_TYPES = [
  "mcq",
  "very_short",
  "short",
  "long",
  "case_study",
] as const;
export type PaperType = (typeof PAPER_TYPES)[number];

/** Per-type `{kind}_count` + `{kind}_marks`; a type with count 0 is omitted.
 * `total_marks` / `total_questions` are derived, not sent. */
export type QuestionPaperParams = {
  difficulty: "easy" | "medium" | "hard" | "mixed";
  focus: string;
  mcq_count: number;
  mcq_marks: number;
  very_short_count: number;
  very_short_marks: number;
  short_count: number;
  short_marks: number;
  long_count: number;
  long_marks: number;
  case_study_count: number;
  case_study_marks: number;
};

export type PresentationParams = {
  slide_count: number;
  detail: "simple" | "detailed";
  include_notes: boolean;
};

export type ParamsFor<T extends GenerationType> = T extends "quiz"
  ? QuizParams
  : T extends "notes"
    ? NotesParams
    : T extends "lesson_plan"
      ? LessonPlanParams
      : T extends "question_paper"
        ? QuestionPaperParams
        : PresentationParams;

export const DEFAULT_PARAMS: { [T in GenerationType]: ParamsFor<T> } = {
  quiz: {
    question_count: 10,
    difficulty: "medium",
    time_limit_min: 20,
    focus: "",
    types: ["mcq"],
  },
  notes: { depth: "standard", include_key_terms: true },
  lesson_plan: { periods: 3, focus: "" },
  question_paper: {
    difficulty: "mixed",
    focus: "",
    mcq_count: 5,
    mcq_marks: 1,
    very_short_count: 0,
    very_short_marks: 2,
    short_count: 3,
    short_marks: 3,
    long_count: 2,
    long_marks: 5,
    case_study_count: 0,
    case_study_marks: 4,
  },
  presentation: { slide_count: 8, detail: "simple", include_notes: true },
};

// --- content (validated LLM output) ----------------------------------------

export type QuizContent = {
  questions: {
    q: string;
    type: "mcq" | "short" | "truefalse";
    options: string[];
    answer: string;
    difficulty: "easy" | "medium" | "hard";
    explanation?: string | null;
  }[];
};

export type NotesContent = {
  sections: { heading: string; body_md: string; key_points: string[] }[];
  summary: string;
  important_terms: { term: string; meaning: string }[];
};

export type LessonPlanContent = {
  topic: string;
  periods: number;
  periods_detail: {
    period_no: number;
    concept: string;
    learning_objective: string;
    learning_outcomes: string;
    teacher_learning_process: string;
    assessment: string;
    resources: string;
  }[];
  homework: string | null;
};

export type QuestionPaperContent = {
  total_marks: number;
  duration_min: number;
  general_instructions: string[];
  sections: {
    name: string;
    instructions: string;
    questions: {
      text: string;
      marks: number;
      type: "mcq" | "short" | "long";
      /** MCQ choices as plain strings; [] for other types and legacy rows. */
      options: string[];
    }[];
  }[];
};

/** On-demand marking key for a question paper (never persisted). */
export type AnswerKey = {
  sections: {
    name: string;
    answers: { number: number; answer: string; solution: string }[];
  }[];
};

export type PresentationContent = {
  title: string;
  subtitle?: string;
  slides: { layout?: string; heading: string; bullets: string[]; notes?: string }[];
};

export type ContentFor<T extends GenerationType> = T extends "quiz"
  ? QuizContent
  : T extends "notes"
    ? NotesContent
    : T extends "lesson_plan"
      ? LessonPlanContent
      : T extends "question_paper"
        ? QuestionPaperContent
        : PresentationContent;

// --- display metadata (tint token only -- icon/label live with JSX) --------

export const TYPE_TINT: Record<GenerationType, string> = {
  lesson_plan: "tint-lesson-plan",
  presentation: "tint-presentation",
  question_paper: "tint-question-paper",
  quiz: "tint-quiz",
  notes: "tint-notes",
};

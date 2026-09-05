"""Versioned prompt builders, one per generation type.

Each entry in `GEN_PROMPTS` is `(VERSION, build)`, where
`build(*, grade_label, subject_name, topic_title, topic_description, language,
        chunks, params) -> tuple[str, list[Message]]`.

Bump the VERSION string whenever a prompt or its expected JSON shape changes;
`prompt_version` is persisted on every row and feeds `cache_key`.
"""

from collections.abc import Callable

from pydantic import BaseModel

from backend.llm.client import Message
from backend.llm.prompts import format_chunks, language_instruction

_PREAMBLE = (
    "You are Medha, a teaching assistant for Bihar BSEB government-school "
    "teachers. The teacher, not the student, is your user."
)

_JSON_RULES = (
    "Return ONLY a JSON object -- no prose, no markdown fences. All "
    "human-readable text in the teacher's language; JSON keys and enum values "
    "in English."
)


def _ctx(grade_label: str, subject_name: str, topic_title: str, desc: str | None) -> str:
    line = f"Topic: {topic_title} -- {grade_label} {subject_name}."
    return f"{line}\n{desc.strip()}" if desc else line


# ------------------------------------------------------------------- lesson_plan


def _lesson_plan(*, grade_label, subject_name, topic_title, topic_description,
                 language, chunks, params: BaseModel) -> tuple[str, list[Message]]:
    system = f"""\
{_PREAMBLE} Write a period-by-period lesson plan for this topic.

{_ctx(grade_label, subject_name, topic_title, topic_description)}
{f"Teacher's focus / notes: {params.focus}" if params.focus else ""}

{language_instruction(language)}

{_JSON_RULES} Shape:
{{
  "topic": "the lesson topic",
  "periods": {params.periods},
  "periods_detail": [
    {{
      "period_no": 1,
      "concept": "what this period covers, 2-4 sentences",
      "learning_objective": "what students will learn (bullet-style lines)",
      "learning_outcomes": "what students will be able to do, with Bloom verbs",
      "teacher_learning_process": "how the teacher runs the period: hook, explanation, blackboard work, activity",
      "assessment": "oral questions / diagram labelling / short quiz for this period",
      "resources": "blackboard, NCERT/BSEB textbook, low-cost materials"
    }}
  ],
  "homework": "one short homework task, or null"
}}

Rules:
  - Exactly {params.periods} entries in "periods_detail", period_no 1..{params.periods}.
  - Classroom-ready for 40+ first-generation learners, chalk-and-blackboard, often no electricity.
  - Draw analogies from everyday rural Bihar life (farming, cooking, the market, the river).

{format_chunks(chunks)}
"""
    ask = f"Lesson plan on {topic_title} for {grade_label}, {params.periods} periods."
    return system, [Message(role="user", content=ask)]


# ------------------------------------------------------------------------ notes


def _notes(*, grade_label, subject_name, topic_title, topic_description,
           language, chunks, params: BaseModel) -> tuple[str, list[Message]]:
    depth_word = {"summary": "a brief", "standard": "a solid", "detailed": "a thorough"}[params.depth]
    section_count = {"summary": "2-3", "standard": "3-5", "detailed": "5-8"}[params.depth]
    glossary_rule = (
        "Fill important_terms with 4-10 key words and one-line meanings."
        if params.include_key_terms
        else "Leave important_terms as an empty list."
    )
    system = f"""\
{_PREAMBLE} Write {depth_word} set of student-facing notes for this topic that a \
teacher can dictate or copy to the blackboard.

{_ctx(grade_label, subject_name, topic_title, topic_description)}

{language_instruction(language)}

{_JSON_RULES} Shape:
{{
  "sections": [
    {{
      "heading": "section heading",
      "body_md": "explanation in simple Markdown (short paragraphs, no images)",
      "key_points": ["1-line takeaway", "..."]
    }}
  ],
  "summary": "3-5 line recap of the whole topic",
  "important_terms": [{{"term": "word", "meaning": "one-line meaning"}}]
}}

Rules:
  - {section_count} sections.
  - {glossary_rule}
  - Answerable from a {grade_label} understanding of this topic.

{format_chunks(chunks)}
"""
    return system, [Message(role="user", content=f"Notes on {topic_title} for {grade_label}.")]


# --------------------------------------------------------------- question_paper


def _question_paper(*, grade_label, subject_name, topic_title, topic_description,
                    language, chunks, params: BaseModel) -> tuple[str, list[Message]]:
    system = f"""\
{_PREAMBLE} Set a written examination paper on this topic.

{_ctx(grade_label, subject_name, topic_title, topic_description)}

{language_instruction(language)}

{_JSON_RULES} Shape:
{{
  "total_marks": {params.total_marks},
  "duration_min": {params.duration_min},
  "general_instructions": ["instruction line", "..."],
  "sections": [
    {{
      "name": "Section A -- Objective",
      "instructions": "e.g. All questions compulsory. 1 mark each.",
      "questions": [{{"text": "question text", "marks": 1, "type": "mcq" | "short" | "long"}}]
    }}
  ]
}}

Rules:
  - About {params.mcq_count} mcq, {params.short_count} short, {params.long_count} long questions, grouped into sections by type.
  - Marks across all questions should sum to roughly {params.total_marks}.
  - Questions answerable from a {grade_label} understanding of this topic; increasing difficulty within each section.
  - For "mcq", put the four choices inside the "text" as (A)/(B)/(C)/(D).

{format_chunks(chunks)}
"""
    ask = f"Question paper on {topic_title} for {grade_label}, {params.total_marks} marks."
    return system, [Message(role="user", content=ask)]


# ------------------------------------------------------------------------- quiz


def _quiz(*, grade_label, subject_name, topic_title, topic_description,
          language, chunks, params: BaseModel) -> tuple[str, list[Message]]:
    diff = (
        "ordered easy -> hard"
        if params.difficulty == "mixed"
        else f"all at {params.difficulty} difficulty"
    )
    system = f"""\
{_PREAMBLE} Generate a short classroom quiz on this topic.

{_ctx(grade_label, subject_name, topic_title, topic_description)}

{language_instruction(language)}

{_JSON_RULES} Shape:
{{
  "questions": [
    {{
      "q": "the question text",
      "type": "mcq" | "short" | "truefalse",
      "options": ["A", "B", "C", "D"],
      "answer": "the correct option text, or true/false as a string",
      "difficulty": "easy" | "medium" | "hard",
      "explanation": "one line on why, optional"
    }}
  ]
}}

Rules:
  - Exactly {params.question_count} questions, {diff}.
  - Use only these question types: {", ".join(params.types)}. Omit "options" for "short";
    for "truefalse" use the teacher's language for the two options.
  - Answerable from a {grade_label} understanding of this topic.

{format_chunks(chunks)}
"""
    ask = f"Quiz on {topic_title} for {grade_label}, {params.question_count} questions."
    return system, [Message(role="user", content=ask)]


# ----------------------------------------------------------------- presentation


def _presentation(*, grade_label, subject_name, topic_title, topic_description,
                  language, chunks, params: BaseModel) -> tuple[str, list[Message]]:
    system = f"""\
{_PREAMBLE} Build a lesson slide deck for this topic that a teacher can present \
in one class.

{_ctx(grade_label, subject_name, topic_title, topic_description)}

{language_instruction(language)}

{_JSON_RULES} Shape:
{{
  "title": "deck title",
  "subtitle": "{grade_label} {subject_name}",
  "slides": [
    {{
      "layout": "bullets" | "two_column" | "summary",
      "heading": "slide heading",
      "bullets": ["short point", "..."],
      "notes": "{"1-2 lines the teacher can say aloud" if params.include_notes else "leave as an empty string"}"
    }}
  ]
}}

Rules:
  - About {params.slide_count} content slides. No title slide -- it is built from "title"/"subtitle".
  - 3 to 6 bullets per slide; each a single short line (max ~140 chars), no sub-bullets.
  - Order as a lesson: what it is -> how it works -> example -> everyday relevance -> recap (last slide "summary").
  - {"Give more depth and a worked example per slide." if params.detail == "detailed" else "Keep each slide simple and high-level."}
  - "layout": "two_column" only when a slide genuinely contrasts two things.

{format_chunks(chunks)}
"""
    ask = f"Slide deck on {topic_title} for {grade_label}, ~{params.slide_count} slides."
    return system, [Message(role="user", content=ask)]


Builder = Callable[..., tuple[str, list[Message]]]

GEN_PROMPTS: dict[str, tuple[str, Builder]] = {
    "lesson_plan": ("lesson_plan-v1", _lesson_plan),
    "notes": ("notes-v1", _notes),
    "question_paper": ("question_paper-v1", _question_paper),
    "quiz": ("quiz-v2", _quiz),
    "presentation": ("presentation-v2", _presentation),
}

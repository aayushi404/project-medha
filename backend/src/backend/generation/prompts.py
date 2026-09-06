"""Versioned prompt builders, one per generation type.

Each entry in `GEN_PROMPTS` is `(VERSION, build)`, where
`build(*, grade_label, subject_name, topic_title, topic_description, language,
        chunks, params) -> tuple[str, list[Message]]`.

Bump the VERSION string whenever a prompt or its expected JSON shape changes;
`prompt_version` is persisted on every row and feeds `cache_key`.
"""

from collections.abc import Callable

from pydantic import BaseModel

from backend.generation.content import PAPER_TYPE_LABEL
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
    objective = (
        f"Lesson objective (what the teacher wants emphasised): {params.focus}"
        if params.focus
        else ""
    )
    system = f"""\
{_PREAMBLE} Write a period-by-period lesson plan for this topic.

{_ctx(grade_label, subject_name, topic_title, topic_description)}
{objective}

{language_instruction(language)}

{_JSON_RULES} Shape:
{{
  "topic": "the specific lesson topic (may be narrower than the chapter name)",
  "periods": {params.periods},
  "periods_detail": [
    {{
      "period_no": 1,
      "concept": "2-4 sentences: what this period covers and why it matters / where it sits in the chapter",
      "learning_objective": "'Students will learn:' then bullet lines each starting with '- '",
      "learning_outcomes": "'Students will be able to:' then bullet lines each starting with '- ' and ENDING with a Bloom's level in parentheses -- one of (Remembering) (Understanding) (Applying) (Analysing) (Evaluating) (Creating)",
      "teacher_learning_process": "3-5 sentences, a runnable narrative: hook -> explanation -> blackboard work -> activity -> recap",
      "assessment": "concrete checks for this period WITH the actual question text and its Bloom's level -- a mix of oral questions, diagram labelling, and a short quiz, as bullet lines starting with '- '",
      "resources": "bullet lines starting with '- ': blackboard, the NCERT/BSEB textbook with chapter reference, low-cost materials, and a simple kit if relevant"
    }}
  ],
  "homework": "one short homework task, or null"
}}

Rules:
  - Exactly {params.periods} entries in "periods_detail", period_no 1..{params.periods}, in order.
  - Classroom-ready for 40+ first-generation learners, chalk-and-blackboard, often no electricity.
  - Draw analogies from everyday rural Bihar life (farming, cooking, the market, the river).
  - Be specific and teacher-usable -- no placeholders, no "e.g." without a real example.

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


_PAPER_CONTENT_TYPE = {
    "mcq": "mcq",
    "very_short": "short",
    "short": "short",
    "long": "long",
    "case_study": "long",
}


def _question_paper(*, grade_label, subject_name, topic_title, topic_description,
                    language, chunks, params: BaseModel) -> tuple[str, list[Message]]:
    letters = "ABCDEFGH"
    total = params.total_marks
    breakdown_lines = []
    for i, kind in enumerate(params.active_types):
        n, m = params.count_of(kind), params.marks_of(kind)
        breakdown_lines.append(
            f'  - Section {letters[i]} -- {PAPER_TYPE_LABEL[kind]}: '
            f'{n} question(s) x {m} mark(s) = {n * m}  '
            f'(use "type": "{_PAPER_CONTENT_TYPE[kind]}")'
        )
    breakdown = "\n".join(breakdown_lines)
    diff = (
        "rising in difficulty across the paper"
        if params.difficulty == "mixed"
        else f"all pitched at {params.difficulty} difficulty"
    )
    focus = (
        f"How the teacher wants this paper to feel: {params.focus}"
        if params.focus
        else ""
    )
    system = f"""\
{_PREAMBLE} Set one written examination paper on this topic.

{_ctx(grade_label, subject_name, topic_title, topic_description)}
{focus}

{language_instruction(language)}

{_JSON_RULES} Shape:
{{
  "total_marks": {total},
  "duration_min": <estimate: about 1.5 min per mark, rounded to the nearest 5, minimum 30>,
  "general_instructions": ["instruction line", "..."],
  "sections": [
    {{
      "name": "Section A -- Multiple Choice",
      "instructions": "the 'N x M = subtotal' tally plus how to answer this section",
      "questions": [
        {{"text": "the question stem only", "marks": <int>, "type": "mcq", "options": ["choice 1", "choice 2", "choice 3", "choice 4"]}}
      ]
    }}
  ]
}}

Sections, in this exact order (one section per line below):
{breakdown}

Rules:
  - Produce exactly these sections with exactly these question counts and per-question marks. Section subtotals and the grand total must equal {total}.
  - Questions {diff}, answerable from a {grade_label} understanding of this topic; order each section easy -> hard.
  - For a Multiple Choice section: "text" is the question STEM ONLY. Put the four choices in "options" as four plain strings -- no "(A)" / "A." prefixes, and do NOT repeat them in "text". Exactly one is correct.
  - For every non-MCQ question, omit "options" (or use []).
  - For a Case Study section, open "text" with a 3-5 sentence real-world passage (rural Bihar context), then 2-3 numbered sub-parts in the same "text".
  - "general_instructions": 4-6 lines -- the list of sections, "all questions are compulsory", which section is objective, the case-study section if present, and "draw neat, labelled diagrams where needed".
  - No answers, no marking scheme, no solutions anywhere in the output.

{format_chunks(chunks)}
"""
    ask = f"Question paper on {topic_title} for {grade_label}, {total} marks."
    return system, [Message(role="user", content=ask)]


# ------------------------------------------------------------------------- quiz


def _quiz(*, grade_label, subject_name, topic_title, topic_description,
          language, chunks, params: BaseModel) -> tuple[str, list[Message]]:
    mcq_only = list(params.types) == ["mcq"]
    diff = (
        "spread easy -> hard across the set"
        if params.difficulty == "mixed"
        else f"all at {params.difficulty} level"
    )
    type_rule = (
        'Every question is "type": "mcq" with exactly four entries in "options".'
        if mcq_only
        else (
            f'Use only these types: {", ".join(params.types)}. '
            'Omit "options" for "short"; for "truefalse" put the two options in the teacher\'s language.'
        )
    )
    focus = (
        f"What the teacher wants this quiz to test: {params.focus}"
        if params.focus
        else ""
    )
    system = f"""\
{_PREAMBLE} Generate a short classroom quiz on this topic.

{_ctx(grade_label, subject_name, topic_title, topic_description)}
{focus}

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
      "explanation": "one crisp line on why the answer is correct"
    }}
  ]
}}

Rules:
  - Exactly {params.question_count} questions, {diff}.
  - {type_rule}
  - Every option is plausible and mutually exclusive; exactly one is unambiguously correct. No "All of the above" / "None of the above".
  - Spread the questions across the different subtopics of this chapter -- do not cluster them on one definition.
  - Grade-appropriate reading level for {grade_label}; the class has ~{params.time_limit_min} min for all {params.question_count}, so keep each quickly answerable.

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
    "lesson_plan": ("lesson_plan-v2", _lesson_plan),
    "notes": ("notes-v1", _notes),
    "question_paper": ("question_paper-v3", _question_paper),
    "quiz": ("quiz-v3", _quiz),
    "presentation": ("presentation-v2", _presentation),
}

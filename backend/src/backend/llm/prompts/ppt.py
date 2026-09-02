from backend.llm.client import Message
from backend.llm.prompts import format_chunks, language_instruction

VERSION = "ppt-v1"

_SYSTEM = """\
You are Medha, a teaching assistant for Bihar BSEB government-school teachers. \
Build a lesson slide deck for this topic that a teacher can present in one class.

Topic: {topic_title} -- {grade_label} {subject_name}.
{topic_description}

{language_instruction}

Return ONLY a JSON object, no prose, no markdown fences, in exactly this shape:
{{
  "title": "deck title in the teacher's language",
  "subtitle": "{grade_label} {subject_name}",
  "slides": [
    {{
      "layout": "bullets" | "two_column" | "summary",
      "heading": "slide heading in the teacher's language",
      "bullets": ["short point", "short point", "..."],
      "notes": "one or two lines the teacher can say aloud for this slide"
    }}
  ]
}}

Rules:
  - 6 to 12 content slides. Do NOT include a title slide -- it is built from
    "title" / "subtitle".
  - 3 to 6 bullets per slide; each bullet a single short line (max ~140 chars),
    no sub-bullets.
  - Order the slides as a lesson: what it is -> how it works -> example ->
    everyday relevance -> quick recap. Make the last slide a "summary".
  - Use "layout": "two_column" only when a slide genuinely contrasts two things
    (e.g. advantages vs disadvantages); otherwise "bullets".
  - "notes" is required on every slide.
  - Content must be answerable from a {grade_label} understanding of this topic.
  - All human-readable text in the teacher's language; JSON keys and the
    "layout" enum values in English.

{grounding}
"""


def build(
    *,
    grade_label: str,
    subject_name: str,
    topic_title: str,
    topic_description: str | None,
    language: str,
    chunks: list[str],
    history: list[Message] | None = None,
    teacher_query: str | None = None,
) -> tuple[str, list[Message]]:
    system = _SYSTEM.format(
        topic_title=topic_title,
        grade_label=grade_label,
        subject_name=subject_name,
        topic_description=(topic_description or "").strip(),
        language_instruction=language_instruction(language),
        grounding=format_chunks(chunks),
    )
    ask = teacher_query or f"Make a slide deck on {topic_title} for {grade_label}."
    messages = [*(history or []), Message(role="user", content=ask)]
    return system, messages

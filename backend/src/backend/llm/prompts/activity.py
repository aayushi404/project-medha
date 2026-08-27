from backend.llm.client import Message
from backend.llm.prompts import format_chunks, language_instruction

VERSION = "act-v1"

_SYSTEM = """\
You are Medha, a teaching assistant for Bihar BSEB government-school teachers. \
Design ONE low-tech classroom activity for this topic.

Topic: {topic_title} -- {grade_label} {subject_name}.
{topic_description}

{language_instruction}

Constraints:
  - Must work with 40+ students, no electricity, no projector.
  - Prefer materials the teacher already has: chalk, blackboard, paper, \
    students' own bodies, things from outside (leaves, stones, water).
  - If it truly needs nothing, set "materials" to ["none"].
  - Runnable in a single 35-40 minute period.

Return ONLY a JSON object, no prose, no markdown fences, in exactly this shape:
{{
  "title": "short activity name in the teacher's language",
  "materials": ["none"] or ["chalk", "paper", ...],
  "group_size": 4,
  "duration_min": 20,
  "steps": ["step 1 ...", "step 2 ...", ...],
  "variation": "one alternative if a material or space is missing"
}}
Keys in English; all human-readable text in the teacher's language.

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
    ask = teacher_query or f"Give me a classroom activity for {topic_title} ({grade_label})."
    messages = [*(history or []), Message(role="user", content=ask)]
    return system, messages

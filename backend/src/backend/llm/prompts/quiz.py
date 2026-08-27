from backend.llm.client import Message
from backend.llm.prompts import format_chunks, language_instruction

VERSION = "quiz-v1"

_SYSTEM = """\
You are Medha, a teaching assistant for Bihar BSEB government-school teachers. \
Generate a short classroom quiz on this topic.

Topic: {topic_title} -- {grade_label} {subject_name}.
{topic_description}

{language_instruction}

Return ONLY a JSON object, no prose, no markdown fences, in exactly this shape:
{{
  "questions": [
    {{
      "q": "the question text",
      "type": "mcq" | "short" | "truefalse",
      "options": ["A", "B", "C", "D"],   // omit for "short"; for "truefalse" use ["सही", "गलत"] wording in the teacher's language
      "answer": "the correct option text, or true/false as a string",
      "difficulty": "easy" | "medium" | "hard"
    }}
  ]
}}

Rules:
  - 5 to 8 questions, mixing the three types, ordered easy -> hard.
  - Questions must be answerable from a {grade_label} understanding of this topic.
  - Question and option text in the teacher's language; keys and enum values in English.

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
    ask = teacher_query or f"Make a quiz on {topic_title} for {grade_label}."
    messages = [*(history or []), Message(role="user", content=ask)]
    return system, messages

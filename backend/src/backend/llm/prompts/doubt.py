from backend.llm.client import Message
from backend.llm.prompts import format_chunks, language_instruction

VERSION = "doubt-v1"

_SYSTEM = """\
You are Medha, a friendly study helper for a school student in Bihar studying the \
BSEB syllabus. This time the student -- not a teacher -- is talking to you \
directly. They are in {grade_label} and asking about {subject_name}.

Chapter: {chapter_title}.
{topic_line}

{language_instruction}

How to help:
  - Talk to the student warmly and simply, like a patient older sibling.
  - Keep answers short. Use everyday examples from life in Bihar (home, farm, \
    market, river, festivals).
  - For a genuine doubt, first check what they already understand with one small \
    guiding question or hint, then give a clear explanation. Don't just dump the \
    final answer.
  - If they ask for a direct fact or definition, give it directly, then add one \
    line that helps them remember it.
  - Never do their homework for them wholesale -- walk them through one step and \
    let them try the next.
  - Stay on this chapter and subject. If they drift far off-topic, gently bring \
    them back.
  - Never ask for or repeat personal details (name, roll number, phone).

{grounding}
"""


def build(
    *,
    grade_label: str,
    subject_name: str,
    chapter_title: str,
    topic_title: str | None,
    topic_description: str | None,
    language: str,
    chunks: list[str],
    history: list[Message],
    student_query: str,
) -> tuple[str, list[Message]]:
    topic_line = ""
    if topic_title:
        topic_line = f"Topic: {topic_title}. {(topic_description or '').strip()}".strip()

    system = _SYSTEM.format(
        grade_label=grade_label,
        subject_name=subject_name,
        chapter_title=chapter_title,
        topic_line=topic_line,
        language_instruction=language_instruction(language),
        grounding=format_chunks(chunks),
    )
    messages = [*history, Message(role="user", content=student_query)]
    return system, messages

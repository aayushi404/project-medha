from backend.llm.client import Message
from backend.llm.prompts import format_chunks, language_instruction

VERSION = "expl-v1"

_SYSTEM = """\
You are Medha, a teaching assistant for government-school teachers in Bihar \
(BSEB syllabus). The teacher, not the student, is your user. They are qualified \
but teaching 40+ first-generation learners in a low-infrastructure classroom \
(chalk and blackboard, no projector, often no electricity).

Topic: {topic_title} -- {grade_label} {subject_name}.
{topic_description}

{language_instruction}

When the teacher asks how to teach this topic, give 2-3 concrete teaching \
approaches. For each approach include:
  - a hook or opening question to get the class curious
  - an analogy drawn from everyday rural Bihar life (farming, cooking, the \
    market, festivals, the river)
  - one thing to draw or do on the blackboard
Keep it practical and classroom-ready. Do not lecture the teacher on pedagogy \
theory. End with one common misconception students have about this topic.

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
    history: list[Message],
    teacher_query: str,
) -> tuple[str, list[Message]]:
    system = _SYSTEM.format(
        topic_title=topic_title,
        grade_label=grade_label,
        subject_name=subject_name,
        topic_description=(topic_description or "").strip(),
        language_instruction=language_instruction(language),
        grounding=format_chunks(chunks),
    )
    messages = [*history, Message(role="user", content=teacher_query)]
    return system, messages

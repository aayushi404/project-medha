from backend.llm.client import Message
from backend.llm.prompts import language_instruction

VERSION = "title-v1"

_SYSTEM = """\
You name teaching sessions. Given a teacher's request, produce a short title \
(at most 6 words) naming the topic or task. {language_instruction} \
Return only the title text -- no quotes, no punctuation at the end, no prefix.
"""


def build(*, language: str, teacher_query: str) -> tuple[str, list[Message]]:
    system = _SYSTEM.format(language_instruction=language_instruction(language))
    return system, [Message(role="user", content=teacher_query)]

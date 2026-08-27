"""Versioned prompt builders. Each module exposes:

    VERSION: str
    build(**ctx) -> tuple[str, list[Message]]   # (system, messages)

Shared context keys used across builders:
    grade_label, subject_name, topic_title, topic_description, language,
    chunks (list[str]), history (list[Message]), teacher_query
"""

_LANGUAGE_INSTRUCTION = {
    "hi-BiharBoli": (
        "Reply in simple, everyday Hindi with a natural Bihari conversational "
        "tone. Use short sentences a Class 6-10 teacher can read aloud."
    ),
    "hi": "Reply in simple, standard Hindi. Use short, clear sentences.",
    "en": "Reply in simple English. Use short, clear sentences.",
}


def language_instruction(language: str) -> str:
    return _LANGUAGE_INSTRUCTION.get(language, _LANGUAGE_INSTRUCTION["hi"])


def format_chunks(chunks: list[str]) -> str:
    if not chunks:
        return (
            "No textbook excerpts were retrieved for this topic. Rely on your "
            "own BSEB-level knowledge and briefly note that you are doing so."
        )
    joined = "\n\n".join(f"[Excerpt {i + 1}]\n{c.strip()}" for i, c in enumerate(chunks))
    return f"BSEB textbook excerpts for grounding (use these first):\n\n{joined}"

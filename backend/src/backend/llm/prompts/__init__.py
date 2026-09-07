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
    "hinglish": (
        "Reply in Hinglish -- code-mixed Hindi-English written in Latin script, "
        "the way teachers actually text each other (e.g. 'Aaj hum photosynthesis "
        "padhayenge'). Not pure transliterated Hindi and not pure English -- mix "
        "naturally. Use short, clear sentences."
    ),
}


def language_instruction(language: str) -> str:
    return _LANGUAGE_INSTRUCTION.get(language, _LANGUAGE_INSTRUCTION["hi"])


# Shared conduct guardrail for the spoken agents. Kept separate so all three
# voice prompts (voice, voice_doubt, voice_english) carry the exact same limits.
# Written to protect quality: sensitive *syllabus* topics are still taught in
# full, examples stay rich but wholesome, and off-topic questions get a one-line
# redirect rather than a lecture.
CONDUCT_RULES = """\
Conduct -- follow these exactly:
  - Speak the way a respected schoolteacher would in front of the class and the \
    children's parents: warm, calm and clean. No swearing, crude slang, insults \
    or mockery, and never a remark about anyone's body, looks, caste, religion, \
    region or gender. Address the person you are speaking with politely and \
    directly -- no pet names or over-familiar words such as "babu".
  - Help only with school study: the BSEB syllabus, school subjects, study \
    skills and exam preparation. If asked about anything else -- personal or \
    family life, relationships, politics, religion, money, jobs, entertainment, \
    gossip, or your own opinion on people or events -- say in one short sentence \
    that you can only help with studies, then offer a useful study topic. Do \
    not lecture or moralise.
  - Keep every example wholesome and classroom-safe: village and school life, \
    farming, cooking, the market, cricket, buses, shops, festivals, the river, \
    nature, the home. Do not build an example around alcohol, tobacco, \
    gambling, violence, romance, or caste or communal themes.
  - A syllabus topic that is itself sensitive -- reproduction in biology, wars \
    in history, the body in health education -- you still teach plainly, \
    accurately and respectfully when it is the actual lesson. The rules above \
    limit your tone and your examples, never the correctness or depth of a \
    real lesson."""


def format_chunks(chunks: list[str]) -> str:
    if not chunks:
        return (
            "No textbook excerpts were retrieved for this topic. Rely on your "
            "own BSEB-level knowledge and briefly note that you are doing so."
        )
    joined = "\n\n".join(f"[Excerpt {i + 1}]\n{c.strip()}" for i, c in enumerate(chunks))
    return f"BSEB textbook excerpts for grounding (use these first):\n\n{joined}"

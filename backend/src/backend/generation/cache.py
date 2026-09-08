"""Generation cache -- serve a repeat request from an existing completed row
instead of re-billing an LLM call. The cost lever at Bihar scale.

`cache_key = sha256(type | chapter(or grade:subject) | normalized params |
language | prompt_version)`. On a hit the source row's content is copied into
a fresh teacher-owned row (`source='cache'`) so the teacher still gets their
own editable/favouritable copy.
"""

import hashlib
import json
import uuid

from sqlalchemy.orm import Session

from backend.db.models import Generation


def _canonical(params: dict) -> str:
    """Stable string form of the form inputs: keys sorted, strings casefolded,
    so trivially different requests share a key."""

    def norm(v: object) -> object:
        if isinstance(v, str):
            return v.strip().casefold()
        if isinstance(v, list):
            return [norm(x) for x in v]
        if isinstance(v, dict):
            return {k: norm(v[k]) for k in sorted(v)}
        return v

    return json.dumps(norm(params), sort_keys=True, ensure_ascii=False)


def compute_key(
    *,
    gen_type: str,
    grade_id: uuid.UUID | None,
    subject_id: uuid.UUID | None,
    chapter_id: uuid.UUID | None,
    params: dict,
    language: str,
    prompt_version: str,
) -> str:
    scope = str(chapter_id) if chapter_id else f"{grade_id}:{subject_id}"
    payload = "|".join(
        [gen_type, scope, _canonical(params), language, prompt_version]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def probe(db: Session, key: str) -> Generation | None:
    """Most recent completed row with this key, owned or curated."""
    return (
        db.query(Generation)
        .filter(
            Generation.cache_key == key,
            Generation.status == "completed",
            Generation.visibility.in_(("private", "library")),
        )
        .order_by(Generation.created_at.desc())
        .first()
    )


def copy_for(
    db: Session,
    teacher_id: uuid.UUID,
    src: Generation,
    *,
    session_id: uuid.UUID | None = None,
) -> Generation:
    """A fresh teacher-owned, completed copy of `src`. Not committed."""
    row = Generation(
        teacher_id=teacher_id,
        visibility="private",
        published=True,
        type=src.type,
        title=src.title,
        description=src.description,
        language=src.language,
        grade_id=src.grade_id,
        subject_id=src.subject_id,
        chapter_id=src.chapter_id,
        topic_id=src.topic_id,
        tags=src.tags,
        source="cache",
        session_id=session_id,
        parent_generation_id=src.id,
        input_params=src.input_params,
        content_json=src.content_json,
        status="completed",
        completed_at=src.completed_at,
        model=src.model,
        prompt_version=src.prompt_version,
        cache_key=src.cache_key,
    )
    db.add(row)
    return row

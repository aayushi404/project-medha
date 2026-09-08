"""backfill quiz + ppt module_artifacts into generations

Data-only migration -- no schema change. Turns pre-v2 `module_artifacts` rows
into real `generations` rows so History stops delegating to /modules for them.

Scope, deliberately narrow (see docs/medha-v2-schema.md and the planning
thread for the reasoning):
  - `quiz`  module_artifacts -> generations(type='quiz')
  - `ppt`   module_artifacts -> generations(type='presentation')
  - `explanation` module_artifacts (Ask Medha chat prose) -- NOT backfilled.
    Ask Medha and the "Notes" generation type are deliberately separate
    features; stuffing chat text into `notes` would conflate them.
  - `activity` module_artifacts -- NOT backfilled. Its shape (materials/
    steps/group_size) has no honest match among the 5 supported generation
    content shapes; forcing it into e.g. `lesson_plan` would render garbage.
  - `library_presentations` -- NOT touched. That table is the *student*
    library, unrelated to teacher History.

Each new `generations` row reuses its source `module_artifacts.id` as its own
primary key (`ON CONFLICT (id) DO NOTHING`), so this migration is safely
re-runnable and the downgrade is exact.

Revision ID: 0011_backfill_generations
Revises: 0010_generations
Create Date: 2026-09-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_backfill_generations"
down_revision: Union[str, Sequence[str], None] = "0010_generations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BACKFILL_TYPES = {"quiz": "quiz", "ppt": "presentation"}

_INSERT_GENERATIONS = sa.text(
    """
    insert into generations (
        id, teacher_id, visibility, type, title, language,
        grade_id, subject_id, chapter_id, topic_id,
        source, session_id, module_id, content_json,
        status, prompt_version, completed_at, created_at, updated_at
    )
    select
        ma.id, m.teacher_id, 'private', :gen_type, m.title,
        coalesce(t.preferred_language, 'hi'),
        m.grade_id, m.subject_id, m.chapter_id, m.topic_id,
        'chat', m.session_id, m.id, ma.content_json,
        'completed', :prompt_version,
        ma.created_at, ma.created_at, ma.created_at
    from module_artifacts ma
    join modules m on m.id = ma.module_id
    join teachers t on t.id = m.teacher_id
    where ma.artifact_type = :legacy_type
    on conflict (id) do nothing
    """
)

_INSERT_FEEDBACK = sa.text(
    """
    insert into generation_feedback (id, generation_id, teacher_id, rating, comment, created_at)
    select uuid_generate_v4(), g.id, mf.teacher_id, mf.rating, mf.comment, mf.created_at
    from module_feedback mf
    join generations g on g.module_id = mf.module_id
    on conflict (generation_id, teacher_id) do nothing
    """
)

_DELETE_BACKFILLED = sa.text(
    """
    delete from generations
    where id in (
        select id from module_artifacts where artifact_type in ('quiz', 'ppt')
    )
    """
)


def upgrade() -> None:
    conn = op.get_bind()

    for legacy_type, gen_type in _BACKFILL_TYPES.items():
        conn.execute(
            _INSERT_GENERATIONS,
            {
                "gen_type": gen_type,
                "prompt_version": f"legacy-{legacy_type}",
                "legacy_type": legacy_type,
            },
        )

    # Replicate each module's feedback onto every generation backfilled from
    # it (a module can have produced more than one artifact type).
    conn.execute(_INSERT_FEEDBACK)


def downgrade() -> None:
    op.get_bind().execute(_DELETE_BACKFILLED)

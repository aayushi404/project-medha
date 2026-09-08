"""voice_turns: spoken Medha conversation history + per-session voice state

Phase A of the teacher voice assistant (docs/medha-voice-assistant-plan.md §4).
Voice turns are kept in their own table rather than `chat_messages` so long typed
explanations and artifact ack-lines never end up in voice context, and vice
versa. No audio is stored -- only transcripts and per-stage metrics.
`chat_sessions` gains three columns for rolling voice state.

Revision ID: 0009_voice_turns
Revises: 0008_library_presentations
Create Date: 2026-09-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_voice_turns"
down_revision: Union[str, Sequence[str], None] = "0008_library_presentations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "voice_turns",
        sa.Column("id", sa.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("user_transcript", sa.Text(), nullable=False),
        # null on a stub row written before generation; filled when the turn ends
        sa.Column("assistant_text", sa.Text(), nullable=True),
        sa.Column("stt_language", sa.Text(), nullable=True),
        sa.Column("stt_confidence", sa.Float(), nullable=True),
        sa.Column("barge_in", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("stt_ms", sa.Integer(), nullable=True),
        sa.Column("llm_ms", sa.Integer(), nullable=True),
        sa.Column("tts_ms", sa.Integer(), nullable=True),
        sa.Column("tokens_in", sa.Integer(), nullable=True),
        sa.Column("tokens_out", sa.Integer(), nullable=True),
        sa.Column("tts_chars", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_voice_turns_session", "voice_turns", ["session_id", "created_at"], unique=False
    )

    op.add_column("chat_sessions", sa.Column("voice_summary", sa.Text(), nullable=True))
    op.add_column(
        "chat_sessions",
        sa.Column(
            "voice_reply_style", sa.Text(), server_default=sa.text("'normal'"), nullable=False
        ),
    )
    op.add_column("chat_sessions", sa.Column("voice_language", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("chat_sessions", "voice_language")
    op.drop_column("chat_sessions", "voice_reply_style")
    op.drop_column("chat_sessions", "voice_summary")

    op.drop_index("idx_voice_turns_session", table_name="voice_turns")
    op.drop_table("voice_turns")

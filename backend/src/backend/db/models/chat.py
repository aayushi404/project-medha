import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class ChatSession(Base):
    """A conversation scoped to a curriculum context (grade + subject, and
    optionally a chapter/topic). One teaching Module is derived per session."""

    __tablename__ = "chat_sessions"
    __table_args__ = (
        Index("idx_chat_sessions_teacher", "teacher_id", text("updated_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teachers.id", ondelete="CASCADE")
    )
    grade_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("grades.id"))
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subjects.id"))
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_chapters.id")
    )
    topic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("curriculum_topics.id")
    )
    title: Mapped[str | None]  # auto-derived from the first teacher message
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

    # --- voice conversation state (see docs/medha-voice-assistant-plan.md §4) ---
    # A rolling summary of older voice turns, refreshed periodically so the
    # voice prompt has context without replaying every turn.
    voice_summary: Mapped[str | None]
    # "normal" | "short" | "detail" -- set by in-conversation voice commands.
    voice_reply_style: Mapped[str] = mapped_column(server_default=text("'normal'"))
    # Reply language chosen mid-conversation ("in English" / "हिंदी में").
    voice_language: Mapped[str | None]


class VoiceTurn(Base):
    """One spoken exchange with Medha, kept apart from `chat_messages` so long
    typed explanations and artifact ack-lines never leak into voice context
    (and vice versa). No audio is stored -- STT/TTS clips are transient."""

    __tablename__ = "voice_turns"
    __table_args__ = (Index("idx_voice_turns_session", "session_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE")
    )
    user_transcript: Mapped[str]
    # Null on a stub row written before generation; filled when the turn ends.
    assistant_text: Mapped[str | None]
    stt_language: Mapped[str | None]
    stt_confidence: Mapped[float | None]
    barge_in: Mapped[bool] = mapped_column(server_default=text("false"))
    # Per-stage timings + token/char accounting, for the latency/cost dashboards.
    stt_ms: Mapped[int | None]
    llm_ms: Mapped[int | None]
    tts_ms: Mapped[int | None]
    tokens_in: Mapped[int | None]
    tokens_out: Mapped[int | None]
    tts_chars: Mapped[int | None]
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (Index("idx_messages_session", "session_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE")
    )
    role: Mapped[str]  # 'teacher' | 'assistant'
    content: Mapped[str]
    # provenance: which textbook_content_chunks grounded an assistant answer
    retrieved_chunk_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)))
    token_count: Mapped[int | None]  # output tokens, for cost tracking
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))

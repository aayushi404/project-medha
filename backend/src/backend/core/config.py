from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_WEAK_SECRETS = {"changeme", "change-me", "secret", "dev", "development", "password"}

# Backend project root is four levels up from this file (core/config.py ->
# backend/src/backend/core -> backend/). Point at this exact .env so an
# unrelated .env higher up the filesystem can't silently override this
# project's settings. load_dotenv also populates os.environ for libraries
# (e.g. Alembic's logging config) that read it directly.
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_ENV_FILE)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    environment: str = "development"  # development | production
    frontend_origin: str = "http://localhost:3000"
    database_url: str = (
        "postgresql+psycopg2://shiksha:shiksha_dev_password@localhost:5431/shiksha_sathi"
    )

    # JWT (access tokens)
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "medha-api"
    jwt_audience: str = "medha-web"
    access_token_expire_minutes: int = 30

    # Refresh tokens (opaque, stored hashed in auth_sessions)
    refresh_token_expire_days: int = 30
    # Frontend and backend live on different origins in production (Vercel <->
    # Render), so the refresh cookie must be SameSite=None; Secure to survive
    # the cross-site request. Locally, Lax is fine.
    cookie_secure: bool = True
    cookie_samesite: str = "lax"  # set to "none" in production

    # Comma-separated Host headers this API answers to (e.g. "api.medha.gov.in").
    # Empty = any host (development only; required in production).
    allowed_hosts: str = ""
    # Largest request body accepted anywhere (bytes). Uploads have their own,
    # tighter per-endpoint limits.
    max_body_bytes: int = 12 * 1024 * 1024

    # Logging
    log_level: str = "INFO"

    # Outbound email (verification + password reset). "console" just logs the
    # message -- for local development only; production must use "smtp".
    mail_backend: str = "console"  # console | smtp
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""  # e.g. "Medha <no-reply@medha.gov.in>"
    smtp_starttls: bool = True

    # --- Phase 1 ---
    # LLM -- provider is swappable behind backend.llm.client.LLMClient
    llm_provider: str = "gemini"  # "gemini" | "claude"
    # Gemini (current: free-tier access)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-flash-lite-latest"
    # Claude (kept for later; unused while llm_provider == "gemini")
    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-5"

    # Embeddings (retrieval grounding) -- see docs/phase-1/04 for provider choice
    embedding_api_key: str = ""
    embedding_model: str = "voyage-3"
    embedding_dim: int = 1024

    # Chat rate limits (per teacher)
    chat_rate_limit_per_min: int = 6
    chat_rate_limit_per_day: int = 200

    # --- Content generation (Medha v2 -- docs/medha-v2-backend.md) ---
    generation_enabled: bool = True  # kill switch for /generate/*
    generation_cache_enabled: bool = True  # serve repeat requests from an existing row
    # Transitional: fold pre-v2 module_artifacts into GET /generations. Off by
    # default now that migration 0011 has backfilled quiz/ppt rows for real;
    # kept as a flag (not deleted) in case a prod rollout needs it briefly
    # before its own 0011 runs. Remove the adapter entirely at 0012.
    generation_legacy_read: bool = False
    generation_rate_limit_per_min: int = 4
    generation_rate_limit_per_day: int = 120
    generation_max_tokens_lesson_plan: int = 4000
    generation_max_tokens_question_paper: int = 4000
    generation_max_tokens_notes: int = 1800
    generation_max_tokens_quiz: int = 2000
    generation_max_tokens_presentation: int = 2400
    # Legacy: Ask Medha still derives a Module + ModuleArtifact per turn. Flip
    # off once the frontend uses /generate/* and /generations. See
    # docs/medha-v2-backend.md §5.
    ask_writes_modules: bool = True

    # --- PPT object storage (Tier 2, unused today) ---
    # Generated slide decks are rendered from a stored spec on demand
    # (backend.ppt), so no object storage is needed while decks are text-only.
    # When decks gain images / thumbnails / cross-instance sharing, set these to
    # an S3-compatible bucket (e.g. Cloudflare R2) and switch downloads to
    # presigned URLs. See the plan's "Tier 2" section.
    ppt_storage_endpoint_url: str = ""
    ppt_storage_bucket: str = ""
    ppt_storage_access_key_id: str = ""
    ppt_storage_secret_access_key: str = ""

    # Google sign-in — the WEB client ID, used as the audience when verifying
    # ID tokens (see auth/service.py). Unset disables /auth/google (503).
    google_client_id: str = ""
    # Phone-number login (docs/phone-login-plan.md). Off during the trial: staff
    # create/approve accounts and no OTP is sent. Turning it on makes approval
    # of teachers and students wait for `phone_verified_at` (OTP not built yet).
    phone_otp_required: bool = False

    # Firebase Cloud Messaging — path to a service-account JSON (Firebase
    # console -> Project settings -> Service accounts -> Generate new private
    # key). Unset means push notifications no-op quietly; the in-app inbox
    # (notifications table) always works regardless.
    firebase_credentials_path: str = ""

    # Cloudinary — profile photo storage (backend.core.images). Unset means
    # /profile/photo returns 503 rather than crashing; required in production.
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Sarvam AI — speech (STT/TTS) for voice input and conversational mode
    sarvam_api_key: str = ""
    sarvam_stt_model: str = "saaras:v3"
    sarvam_tts_model: str = "bulbul:v3"
    sarvam_tts_speaker: str = "shubh"
    # Bihari-flavoured Hindi — warmer voice + slightly slower pace (Bulbul v3)
    sarvam_tts_speaker_bihari: str = "ritu"
    sarvam_tts_pace_bihari: float = 0.92

    # --- Absence calling: instant guardian call + AI voice conversation when a
    # teacher marks a student absent (backend.absence_calls). Off by default --
    # explicit opt-in once Exotel + Sarvam are configured, so a fresh/dev
    # deployment never dials real phone numbers by accident.
    absence_calling_enabled: bool = False
    # Which provider places the call -- "twilio" | "exotel". Twilio's trial
    # needs no business KYC (good for a quick demo, but only calls numbers
    # you've pre-verified in the Twilio console); Exotel needs KYC approved
    # first but has no such per-call restriction once it's live. See
    # backend/src/backend/absence_calls/telephony.py.
    telephony_provider: str = "twilio"
    # Twilio (https://twilio.com) -- Account SID + Auth Token from the
    # Console dashboard, and a Twilio number as the caller ID. Twilio does
    # not sell local Indian numbers, so this will usually be a US/UK number;
    # test connect quality to a real Indian mobile before relying on it.
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_caller_number: str = ""  # E.164, e.g. +14155551234
    # Exotel (Indian cloud telephony) -- see backend/src/backend/absence_calls/telephony.py
    exotel_sid: str = ""
    exotel_api_key: str = ""
    exotel_api_token: str = ""
    exotel_subdomain: str = "api.in.exotel.com"  # Mumbai; use api.exotel.com for Singapore
    exotel_caller_id: str = ""  # the ExoPhone calls are placed from
    # The Exotel "App" (Flow) that has a Voicebot Applet configured, pointed at
    # this server's /absence-calls/exotel/voicebot websocket -- see Exotel's
    # dashboard (App Bazaar). Not creatable via API; one-time manual setup.
    exotel_app_id: str = ""
    # This server's own publicly reachable origin (e.g. the Render URL), used
    # to build the webhook/websocket URLs the telephony provider calls back
    # (e.g. https://medha-backend.onrender.com, no trailing slash).
    public_base_url: str = ""
    # A separate Gemini API key/project for the absence-call conversation
    # itself, kept apart from the main app's GEMINI_API_KEY (llm_provider /
    # llm.get_llm_client) so this feature's usage, quota and billing are
    # trackable on their own -- it's a live phone call, not a chat reply, and
    # a quota clash with the rest of the app shouldn't ever drop a call (or
    # vice versa). See backend/src/backend/absence_calls/conversation.py.
    absence_call_gemini_api_key: str = ""
    absence_call_gemini_model: str = "gemini-flash-lite-latest"
    # Demo-only safety valve: when set, EVERY absence call is dialed to this
    # number instead of the student's real (or fallback) guardian_phone --
    # for showcasing the feature without risking a call to a real guardian.
    # Empty (default) = off, normal per-student number is used.
    absence_call_force_phone: str = ""

    # --- Voice assistant (/speech/converse) — see docs/medha-voice-assistant-plan.md ---
    voice_enabled: bool = True  # kill switch; hides the FE launcher when false
    # Spoken replies are short by contract; caps keep TTS latency + cost down.
    voice_max_reply_tokens: int = 200  # "normal" / "short" styles
    voice_detail_reply_tokens: int = 450  # when the teacher asks to go deeper
    voice_history_turns: int = 6  # prior voice turns fed back as context
    # Per-teacher caps on this LLM+TTS-spending endpoint (DB-count, like chat).
    voice_rate_limit_per_min: int = 20
    voice_rate_limit_per_day: int = 400

    @model_validator(mode="after")
    def _security_guard(self) -> "Settings":
        # Always-on checks: these are wrong in every environment.
        if self.jwt_algorithm != "HS256":
            raise ValueError("JWT_ALGORITHM must be HS256.")
        if self.cookie_samesite.lower() not in {"lax", "strict", "none"}:
            raise ValueError("COOKIE_SAMESITE must be lax, strict or none.")
        if self.cookie_samesite.lower() == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true.")
        origin = urlparse(self.frontend_origin)
        if (
            origin.scheme not in {"http", "https"}
            or not origin.netloc
            or origin.path != ""
        ):
            raise ValueError(
                "FRONTEND_ORIGIN must be a bare origin like https://app.example.gov.in (no path, no trailing slash)."
            )

        # Production-only checks: fail fast instead of running insecurely.
        if self.environment.lower() == "production":
            if len(self.jwt_secret_key) < 32 or self.jwt_secret_key.lower() in _WEAK_SECRETS:
                raise ValueError("JWT_SECRET_KEY must be at least 32 characters and not a placeholder in production.")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production.")
            if origin.scheme != "https":
                raise ValueError("FRONTEND_ORIGIN must be https in production.")
            if not self.allowed_hosts.strip():
                raise ValueError("ALLOWED_HOSTS must list the API's hostname(s) in production.")
            if self.mail_backend != "smtp" or not (self.smtp_host and self.smtp_from):
                raise ValueError("MAIL_BACKEND=smtp with SMTP_HOST and SMTP_FROM is required in production.")
            if not (self.cloudinary_cloud_name and self.cloudinary_api_key and self.cloudinary_api_secret):
                raise ValueError(
                    "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required in production."
                )
            if self.absence_call_force_phone:
                raise ValueError("ABSENCE_CALL_FORCE_PHONE is a demo-only override and must be empty in production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

# Back-compat aliases -- existing modules import these UPPER_CASE names directly.
# New code should import `settings` and read attributes off it.
FRONTEND_ORIGIN = settings.frontend_origin
DATABASE_URL = settings.database_url
JWT_SECRET_KEY = settings.jwt_secret_key
JWT_ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.refresh_token_expire_days

from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

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
    access_token_expire_minutes: int = 15

    # Refresh tokens (opaque, stored hashed in auth_sessions)
    refresh_token_expire_days: int = 30
    # Frontend and backend live on different origins in production (Vercel <->
    # Render), so the refresh cookie must be SameSite=None; Secure to survive
    # the cross-site request. Locally, Lax is fine.
    cookie_secure: bool = True
    cookie_samesite: str = "lax"  # set to "none" in production

    # Logging
    log_level: str = "INFO"

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

    # Sarvam AI — speech (STT/TTS) for voice input and conversational mode
    sarvam_api_key: str = ""
    sarvam_stt_model: str = "saaras:v3"
    sarvam_tts_model: str = "bulbul:v3"
    sarvam_tts_speaker: str = "shubh"


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

# 01 — Skeleton Hardening

**`../phase-1.md` §7 step 1** — "Wire `main.py`, `config.py`, `db.py`,
`dependencies.py` — the skeleton."

Phase 0 already has `app.py`, `db/session.py`, `db/base.py`, and
`auth/dependencies.py`. This step closes the three gaps that the generation
loop will lean on: typed config, a global error shape, and request-scoped
logging.

## Purpose

- Replace ad-hoc `os.environ` config with a validated Pydantic `Settings`
  object so every new Phase 1 env var (LLM key, embedding model, rate limits)
  has one typed home.
- Add a global exception handler so clients get a consistent JSON error shape
  and never see a traceback.
- Add request-ID + structured logging so an LLM call ("it gave a bad answer")
  can be reconstructed from logs.

## Files

| File | Change |
|---|---|
| `backend/src/backend/core/config.py` | rewrite as `pydantic-settings` `Settings` |
| `backend/src/backend/core/logging.py` | **new** — `dictConfig` + request-id filter/formatter |
| `backend/src/backend/core/errors.py` | **new** — error model + exception handlers |
| `backend/src/backend/core/context.py` | **new** — `ContextVar` holding the current request id |
| `backend/src/backend/app.py` | install middleware, handlers, `configure_logging()` |
| `backend/pyproject.toml` | add `pydantic-settings` |
| `backend/.env.example` | add the Phase 1 vars from doc 00 §3 |

## Config — `core/config.py`

```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    frontend_origin: str = "http://localhost:3000"
    database_url: str = "postgresql+psycopg2://shiksha:shiksha_dev_password@localhost:5431/shiksha_sathi"

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    otp_expire_minutes: int = 5
    otp_max_verify_attempts: int = 5
    otp_max_requests_per_window: int = 3
    otp_request_window_minutes: int = 10

    # Phase 1
    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-5"
    embedding_api_key: str = ""
    embedding_model: str = "voyage-3"
    embedding_dim: int = 1024
    chat_rate_limit_per_min: int = 6
    chat_rate_limit_per_day: int = 200

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

**Back-compat:** keep the module-level UPPER_CASE names other modules already
import, as thin aliases, to keep this diff small:

```python
DATABASE_URL = settings.database_url
JWT_SECRET_KEY = settings.jwt_secret_key
JWT_ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.refresh_token_expire_days
OTP_EXPIRE_MINUTES = settings.otp_expire_minutes
OTP_MAX_VERIFY_ATTEMPTS = settings.otp_max_verify_attempts
OTP_MAX_REQUESTS_PER_WINDOW = settings.otp_max_requests_per_window
OTP_REQUEST_WINDOW_MINUTES = settings.otp_request_window_minutes
FRONTEND_ORIGIN = settings.frontend_origin
```

Existing `load_dotenv(...parents[3] / ".env")` behaviour is preserved by
pointing `env_file` at the same path (compute it the same way, pass an absolute
`Path`). New code imports `from backend.core.config import settings`.

## Request id — `core/context.py`

```python
from contextvars import ContextVar
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")
```

## Middleware — in `app.py`

```python
@app.middleware("http")
async def request_id_mw(request, call_next):
    rid = request.headers.get("x-request-id") or uuid4().hex
    token = request_id_ctx.set(rid)
    try:
        response = await call_next(request)
    finally:
        request_id_ctx.reset(token)
    response.headers["X-Request-ID"] = rid
    return response
```

Ordering: add this **before** `CORSMiddleware` in source (so it runs
outermost) — or use `@app.middleware` which is fine alongside the existing
`add_middleware(CORSMiddleware, ...)`.

## Logging — `core/logging.py`

- `configure_logging()` calls `logging.config.dictConfig` with one formatter
  that prints:
  `2026-08-27T12:00:00Z INFO backend.chat rid=ab12… message`
- A `logging.Filter` injects `record.request_id = request_id_ctx.get()`.
- Keep it stdlib-only (no `structlog` dep). Level from an optional `LOG_LEVEL`
  env (default `INFO`).
- Call `configure_logging()` at the top of `app.py`, replacing the current
  `logging.basicConfig(level=logging.INFO)`.

## Errors — `core/errors.py`

```python
class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str

def _payload(code, message):
    return {"error": {"code": code, "message": message,
                      "request_id": request_id_ctx.get()},
            # keep `detail` so the existing frontend extractErrorMessage keeps working
            "detail": message}

def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def _http(request, exc):
        code = {400: "bad_request", 401: "unauthorized", 403: "forbidden",
                404: "not_found", 409: "conflict", 429: "rate_limited"}.get(
                exc.status_code, "error")
        return JSONResponse(exc.status_code, _payload(code, exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation(request, exc):
        body = _payload("validation_error", "Request validation failed.")
        body["detail"] = exc.errors()   # preserve FastAPI's array shape
        return JSONResponse(422, body)

    @app.exception_handler(Exception)
    async def _unhandled(request, exc):
        logging.getLogger("backend").exception("unhandled error")
        return JSONResponse(500, _payload("internal_error",
                            "Something went wrong. Please try again."))
```

`app.py` calls `install_error_handlers(app)` after router registration.

## Key decisions

- **Pydantic Settings, but keep UPPER_CASE aliases** — avoids touching every
  existing `from backend.core.config import X` import in this step.
- **`detail` kept in every error body** — the shipped frontend
  (`lib/api.ts` `extractErrorMessage`) reads `detail`; not breaking it now
  keeps this step isolated. Doc 07 can migrate the frontend to `error.message`
  later.
- **DB-count rate limiting, stdlib logging** — no Redis, no `structlog` in
  Phase 1 (doc 00 §1.3).

## How to test

1. `cd backend && uv sync` (picks up `pydantic-settings`).
2. Unset `JWT_SECRET_KEY` → app fails fast with a clear Pydantic error.
   Restore it.
3. `uv run uvicorn backend.app:app --reload` → `GET /health` returns
   `{"status":"ok"}` and an `X-Request-ID` response header.
4. `GET /auth/me` with no token → `401` body
   `{"error":{"code":"unauthorized",...},"detail":"..."}`.
5. `POST /auth/otp/request` with `{"phone_number":"abc"}` → `422` with
   `error.code == "validation_error"` and `detail` still an array.
6. Existing auth + onboarding + reference flows unchanged (regression).

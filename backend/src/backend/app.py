import re
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.datastructures import Headers, MutableHeaders

from backend.absence_calls.router import router as absence_calls_router
from backend.admin.router import router as admin_router
from backend.ask.router import router as ask_router
from backend.attendance.router import router as attendance_router
from backend.auth.router import router as auth_router
from backend.core.api_prefix import ApiPrefixMiddleware
from backend.core.config import settings
from backend.core.context import request_id_ctx
from backend.core.errors import install_error_handlers
from backend.core.logging import configure_logging
from backend.curriculum.router import router as curriculum_router
from backend.english.router import router as english_router
from backend.fees.router import router as fees_router
from backend.generation.router import router as generation_router
from backend.homework.router import router as homework_router
from backend.work_updates.router import router as work_updates_router
from backend.library.router import router as library_router
from backend.modules.router import router as modules_router
from backend.notes.router import router as notes_router
from backend.notifications.router import router as notifications_router
from backend.onboarding.router import router as onboarding_router
from backend.practice.router import router as practice_router
from backend.principal.router import router as principal_router
from backend.profile.router import router as profile_router
from backend.reference.router import router as reference_router
from backend.report_card.router import router as report_card_router
from backend.speech.router import router as speech_router
from backend.timetable.router import router as timetable_router
from backend.timetable_planner.router import router as timetable_planner_router
from backend.cover.router import day_board_router, router as cover_router
from backend.school.router import router as school_router
from backend.tools.router import router as tools_router
from backend.student.router import router as student_router
from backend.teacher.router import router as teacher_router
from backend.student_profile.router import router as student_profile_router
from backend.tutor.router import router as tutor_router

configure_logging()

_IS_DEV = settings.environment.lower() == "development"

# Interactive docs/schema are a map of every endpoint -- development only.
app = FastAPI(
    title="Medha API",
    docs_url="/docs" if _IS_DEV else None,
    redoc_url="/redoc" if _IS_DEV else None,
    openapi_url="/openapi.json" if _IS_DEV else None,
)


_SAFE_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{8,64}")


class _RequestIdMiddleware:
    """Give every request an id: honour an inbound X-Request-ID (from a proxy)
    or mint one, expose it on the ContextVar for logging/error bodies, and
    echo it back on the response.

    Pure ASGI, like the other middleware here: `@app.middleware("http")` starts an
    extra task and memory stream per request, which adds up at high request rates."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        inbound = Headers(scope=scope).get("x-request-id", "")
        # only trust a short, log-safe id from a proxy; anything else (newlines,
        # huge values) could forge log lines or poison caches keyed on the header
        rid = inbound if _SAFE_REQUEST_ID.fullmatch(inbound) else uuid4().hex

        async def send_with_id(message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)["X-Request-ID"] = rid
            await send(message)

        token = request_id_ctx.set(rid)
        try:
            await self.app(scope, receive, send_with_id)
        finally:
            request_id_ctx.reset(token)


app.add_middleware(_RequestIdMiddleware)


class _BodyLimitMiddleware:
    """Reject request bodies over `max_body_bytes` -- by Content-Length up
    front, and by counting streamed bytes for chunked uploads that lie or omit
    it -- before any route code buffers them."""

    def __init__(self, app, max_bytes: int) -> None:
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        declared = dict(scope["headers"]).get(b"content-length")
        if declared and declared.isdigit() and int(declared) > self.max_bytes:
            return await _too_large(send)

        seen = 0

        async def limited_receive():
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.max_bytes:
                    raise _BodyTooLarge()
            return message

        try:
            await self.app(scope, limited_receive, send)
        except _BodyTooLarge:
            await _too_large(send)


class _BodyTooLarge(Exception):
    pass


async def _too_large(send) -> None:
    body = b'{"error":{"code":"payload_too_large","message":"Request body is too large."}}'
    await send({"type": "http.response.start", "status": 413, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})


class _SecurityHeadersMiddleware:
    """Defensive headers on every API response. (The frontend sets its own
    CSP; these cover the API origin, e.g. if a response is ever opened directly.)"""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_with_headers(message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.setdefault("X-Content-Type-Options", "nosniff")
                headers.setdefault("X-Frame-Options", "DENY")
                headers.setdefault("Referrer-Policy", "no-referrer")
                headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
                headers.setdefault("Cache-Control", "no-store")
                if not _IS_DEV:
                    headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
            await send(message)

        await self.app(scope, receive, send_with_headers)


app.add_middleware(_SecurityHeadersMiddleware)


# allow_credentials=True requires an exact origin (not "*") -- the browser
# rejects credentialed responses ("Set-Cookie" for the refresh token, or a
# request sent with credentials: 'include') from a wildcard-CORS response.
# Added after the request-id middleware so CORS sits outermost and still
# annotates error responses.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)
# Outermost: strips an optional "/api" prefix before anything routes on the
# path (see core/api_prefix.py).
app.add_middleware(ApiPrefixMiddleware)

if settings.allowed_hosts.strip():
    from starlette.middleware.trustedhost import TrustedHostMiddleware

    app.add_middleware(TrustedHostMiddleware, allowed_hosts=[h.strip() for h in settings.allowed_hosts.split(",") if h.strip()])
app.add_middleware(_BodyLimitMiddleware, max_bytes=settings.max_body_bytes)

install_error_handlers(app)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(principal_router)
app.include_router(teacher_router)
app.include_router(student_profile_router)
app.include_router(student_router)
app.include_router(reference_router)
app.include_router(onboarding_router)
app.include_router(curriculum_router)
app.include_router(profile_router)
app.include_router(ask_router, prefix="/ask")
# Deprecated alias: the frontend still calls /chat/*. Drop once it uses /ask/*.
app.include_router(ask_router, prefix="/chat")
app.include_router(tutor_router)
app.include_router(english_router)
app.include_router(speech_router)
app.include_router(tools_router)
app.include_router(modules_router)
app.include_router(library_router)
app.include_router(generation_router)
app.include_router(attendance_router)
app.include_router(absence_calls_router)
app.include_router(notifications_router)
app.include_router(homework_router)
app.include_router(work_updates_router)
app.include_router(timetable_router)
app.include_router(timetable_planner_router)
app.include_router(cover_router)
app.include_router(day_board_router)
app.include_router(report_card_router)
app.include_router(school_router)
app.include_router(fees_router)
app.include_router(notes_router)
app.include_router(practice_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

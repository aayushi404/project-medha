from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.admin.router import router as admin_router
from backend.attendance.router import router as attendance_router
from backend.auth.router import router as auth_router
from backend.core.config import settings
from backend.core.context import request_id_ctx
from backend.core.errors import install_error_handlers
from backend.core.logging import configure_logging
from backend.chat.router import router as chat_router
from backend.curriculum.router import router as curriculum_router
from backend.english.router import router as english_router
from backend.fees.router import router as fees_router
from backend.homework.router import router as homework_router
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
from backend.tools.router import router as tools_router
from backend.student.router import router as student_router
from backend.teacher.router import router as teacher_router
from backend.tutor.router import router as tutor_router

configure_logging()

app = FastAPI(title="Medha API")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Give every request an id: honour an inbound X-Request-ID (from a proxy)
    or mint one, expose it on the ContextVar for logging/error bodies, and
    echo it back on the response."""
    rid = request.headers.get("x-request-id") or uuid4().hex
    token = request_id_ctx.set(rid)
    try:
        response = await call_next(request)
    finally:
        request_id_ctx.reset(token)
    response.headers["X-Request-ID"] = rid
    return response


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

install_error_handlers(app)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(principal_router)
app.include_router(teacher_router)
app.include_router(student_router)
app.include_router(reference_router)
app.include_router(onboarding_router)
app.include_router(curriculum_router)
app.include_router(profile_router)
app.include_router(chat_router)
app.include_router(tutor_router)
app.include_router(english_router)
app.include_router(speech_router)
app.include_router(tools_router)
app.include_router(modules_router)
app.include_router(attendance_router)
app.include_router(notifications_router)
app.include_router(homework_router)
app.include_router(timetable_router)
app.include_router(report_card_router)
app.include_router(library_router)
app.include_router(fees_router)
app.include_router(notes_router)
app.include_router(practice_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

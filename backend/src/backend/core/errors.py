import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException

from backend.core.context import request_id_ctx

logger = logging.getLogger("backend.errors")

_CODE_BY_STATUS = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    429: "rate_limited",
}


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorBody


def _payload(code: str, message: str, *, detail: object | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id_ctx.get(),
        },
        # `detail` is kept so the shipped frontend's extractErrorMessage
        # (lib/api.ts) keeps working: it reads data.detail, string or array.
        "detail": detail if detail is not None else message,
    }


def install_error_handlers(app: FastAPI) -> None:
    # Registered against the Starlette base (not fastapi.HTTPException) so it
    # also catches framework-raised 404/405s for unmatched routes. fastapi's
    # HTTPException is a subclass, so app-raised errors are covered too.
    @app.exception_handler(HTTPException)
    async def _http_exc(request: Request, exc: HTTPException) -> JSONResponse:
        code = _CODE_BY_STATUS.get(exc.status_code, "error")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload(code, message, detail=exc.detail),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_exc(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_payload(
                "validation_error",
                "Request validation failed.",
                detail=jsonable_encoder(exc.errors()),
            ),
        )

    @app.exception_handler(Exception)
    async def _unhandled_exc(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error")
        return JSONResponse(
            status_code=500,
            content=_payload("internal_error", "Something went wrong. Please try again."),
        )

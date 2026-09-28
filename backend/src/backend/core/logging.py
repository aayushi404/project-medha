import logging
import re
from logging.config import dictConfig

from backend.core.config import settings
from backend.core.context import request_id_ctx


class RequestIdFilter(logging.Filter):
    """Injects the current request id onto every record so the formatter can
    print it. Records emitted outside a request get the ContextVar default."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


_SECRET_QUERY = re.compile(r"([?&](?:t|token|access_token|refresh_token|password|code)=)[^&\s\"]+", re.IGNORECASE)


def _redact(text: str) -> str:
    return _SECRET_QUERY.sub(r"\1[redacted]", text)


class RedactSecretsFilter(logging.Filter):
    """Scrubs credential-bearing query parameters (per-call webhook tokens,
    etc.) from log lines, so a token in a URL never lands in the access log."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = _redact(record.msg)
        if record.args:
            record.args = tuple(_redact(a) if isinstance(a, str) else a for a in record.args)
        return True


_FORMAT = "%(asctime)s %(levelname)s %(name)s rid=%(request_id)s %(message)s"
_DATEFMT = "%Y-%m-%dT%H:%M:%S%z"


def configure_logging() -> None:
    """Replace the default logging config with one structured line format that
    carries the request id. Called once at app import time."""
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {
                "request_id": {"()": "backend.core.logging.RequestIdFilter"},
                "redact": {"()": "backend.core.logging.RedactSecretsFilter"},
            },
            "formatters": {
                "default": {"format": _FORMAT, "datefmt": _DATEFMT},
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "filters": ["request_id"],
                },
            },
            "root": {"handlers": ["console"], "level": settings.log_level},
            "loggers": {
                # Route uvicorn's own loggers through our handler and stop them
                # propagating so each line is printed once, in our format.
                "uvicorn": {"handlers": ["console"], "level": "INFO", "propagate": False},
                "uvicorn.error": {"handlers": ["console"], "level": "INFO", "propagate": False},
                "uvicorn.access": {"handlers": ["console"], "level": "INFO", "propagate": False, "filters": ["redact"]},
            },
        }
    )

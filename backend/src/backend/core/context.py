from contextvars import ContextVar

# Set per request by the request-id middleware in app.py; read by the logging
# filter (core/logging.py) and the error handlers (core/errors.py). Defaults to
# "-" for code paths outside an HTTP request (scripts, startup).
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

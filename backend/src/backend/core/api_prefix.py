"""Serve every route under an optional `/api` prefix as well as at the root.

The website reaches this API through its own domain (a rewrite from
`www.projectmedha.online/api/*` to here), which makes the refresh cookie
first-party: browsers that block third-party cookies (Safari, iOS, privacy
modes) would otherwise drop it and log people out on every reload. Clients
that call Render directly (the Flutter app, local dev) keep using the bare
paths.

Pure ASGI rather than BaseHTTPMiddleware so streamed (SSE) responses pass
through untouched.
"""

from starlette.requests import Request
from starlette.types import ASGIApp, Receive, Scope, Send

API_PREFIX = "/api"


class ApiPrefixMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket"):
            path: str = scope["path"]
            if path == API_PREFIX or path.startswith(API_PREFIX + "/"):
                scope = dict(scope)
                scope["path"] = path[len(API_PREFIX) :] or "/"
                raw_path = scope.get("raw_path")
                if raw_path:
                    scope["raw_path"] = raw_path[len(API_PREFIX) :] or b"/"
                scope["state"] = {**scope.get("state", {}), "api_prefix": API_PREFIX}
        await self.app(scope, receive, send)


def api_prefix(request: Request) -> str:
    """"/api" when the request came in under the prefix, else ""."""
    return getattr(request.state, "api_prefix", "")

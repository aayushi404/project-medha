"""Best-effort FCM push delivery. Quietly no-ops if Firebase isn't
configured (`FIREBASE_CREDENTIALS_PATH` unset) -- the in-app notifications
table is always the source of truth; push is a convenience on top."""

import logging
from functools import lru_cache

from backend.core.config import settings

logger = logging.getLogger("backend.notifications.push")

_DEAD_TOKEN_CODES = {"NOT_FOUND", "UNREGISTERED", "INVALID_ARGUMENT", "SENDER_ID_MISMATCH"}


@lru_cache
def _app():
    if not settings.firebase_credentials_path:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials

        cred = credentials.Certificate(settings.firebase_credentials_path)
        return firebase_admin.initialize_app(cred)
    except Exception:
        logger.warning("firebase_init_failed", exc_info=True)
        return None


def send_push(tokens: list[str], *, title: str, body: str, data: dict | None = None) -> list[str]:
    """Sends to up to len(tokens) devices. Returns the subset FCM reported as
    dead (unregistered/invalid), for the caller to prune from `device_tokens`."""
    app = _app()
    if app is None or not tokens:
        return []

    from firebase_admin import messaging

    dead: list[str] = []
    for i in range(0, len(tokens), 500):  # FCM multicast cap
        batch = tokens[i : i + 500]
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            tokens=batch,
        )
        try:
            response = messaging.send_each_for_multicast(message, app=app)
        except Exception:
            logger.warning("push_send_failed", exc_info=True)
            continue
        for token, result in zip(batch, response.responses):
            if not result.success and getattr(result.exception, "code", None) in _DEAD_TOKEN_CODES:
                dead.append(token)
    return dead

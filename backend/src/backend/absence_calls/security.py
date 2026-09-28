"""Authentication for the endpoints the telephony provider (not our own
frontend) calls: status webhooks, the TwiML fetch and the voicebot websocket.

Each outbound call gets its own short-lived HMAC token bound to that call's
id and a purpose, so a token leaked through a log line or a provider dashboard
can only ever touch one call, for a narrow purpose, for a short time -- unlike
one long-lived shared secret. Twilio requests are additionally verified with
Twilio's own X-Twilio-Signature. Everything here fails closed: no secret,
no valid token, no signature -> rejected.
"""

import base64
import hashlib
import hmac
import time

from backend.core.config import settings

_TOKEN_TTL_SECONDS = 60 * 60  # a guardian call is over in minutes; 1h covers retries/delays
_PURPOSES = {"status", "twiml", "stream"}


def _key() -> bytes:
    # Derived from the JWT secret so no extra secret has to be provisioned, and
    # domain-separated so it can never be confused with a JWT signature.
    return hmac.new(settings.jwt_secret_key.encode(), b"medha/absence-call/v1", hashlib.sha256).digest()


def _mac(call_id: str, purpose: str, exp: int) -> str:
    msg = f"{purpose}:{call_id}:{exp}".encode()
    return hmac.new(_key(), msg, hashlib.sha256).hexdigest()


def sign_call_token(call_id: str, purpose: str, ttl: int = _TOKEN_TTL_SECONDS) -> str:
    if purpose not in _PURPOSES:
        raise ValueError(f"unknown purpose {purpose!r}")
    exp = int(time.time()) + ttl
    return f"{exp}.{_mac(call_id, purpose, exp)}"


def verify_call_token(token: str | None, call_id: str, purpose: str) -> bool:
    if not token or purpose not in _PURPOSES or "." not in token:
        return False
    exp_s, _, mac = token.partition(".")
    try:
        exp = int(exp_s)
    except ValueError:
        return False
    if exp < time.time():
        return False
    return hmac.compare_digest(mac, _mac(call_id, purpose, exp))


def verify_twilio_signature(url: str, params: dict[str, str], signature: str | None) -> bool:
    """https://www.twilio.com/docs/usage/security#validating-requests --
    HMAC-SHA1 (base64) over the full request URL followed by each POST
    parameter name+value, sorted by name, keyed with the account auth token."""
    if not signature or not settings.twilio_auth_token:
        return False
    data = url + "".join(f"{k}{params[k]}" for k in sorted(params))
    digest = hmac.new(settings.twilio_auth_token.encode(), data.encode(), hashlib.sha1).digest()
    expected = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, signature)

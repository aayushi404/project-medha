"""Vendor-neutral outbound-call interface, mirroring backend.llm.client's
shape: absence_calls/service.py depends only on this module, never on an
Exotel SDK or REST shape directly, so the provider is swappable later
(Twilio, Knowlarity, ...) without touching the calling logic itself."""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from backend.core.config import settings

logger = logging.getLogger("backend.absence_calls")


class TelephonyError(RuntimeError):
    """Raised for any upstream telephony failure so callers don't import the
    provider SDK/REST shape."""


class TelephonyNotConfigured(TelephonyError):
    """No provider credentials are set -- distinct from a real call failure
    so the caller can log a quiet 'not configured' outcome instead of an
    alarming error."""


@dataclass
class PlacedCall:
    provider_call_sid: str


def _status_callback_url(path: str, token: str) -> str:
    """Build a `{PUBLIC_BASE_URL}/absence-calls/{path}/status-callback` URL,
    with the shared-secret token appended when set. Registering this with
    the provider on every outbound call is what makes ringing/no-answer/busy/
    failed actually reach us -- without it, a call that's never answered (so
    the voicebot websocket never even connects) stays stuck at whatever
    status place_call() set, forever."""
    url = f"{settings.public_base_url}/absence-calls/{path}/status-callback"
    return f"{url}?token={token}" if token else url


class TelephonyProvider(ABC):
    @abstractmethod
    async def place_call(self, *, to_number: str, correlation_id: str) -> PlacedCall:
        """Dial `to_number`, connecting the answered call into whatever
        real-time voice flow the provider has configured (see the concrete
        implementation's docstring). `correlation_id` is passed through as a
        custom parameter so the voicebot websocket can match the call back to
        our AbsenceCall row without waiting on the status callback."""
        ...


class ExotelProvider(TelephonyProvider):
    """Places the call via Exotel's Connect API
    (https://developer.exotel.com/api/make-a-call-api), pointed at an Exotel
    "App" (Flow) that already has a Voicebot Applet configured in the Exotel
    dashboard -- see backend.absence_calls.router for the websocket that
    applet streams audio to. Creating that Flow is a one-time manual step in
    Exotel's App Bazaar; there's no API for it, so EXOTEL_APP_ID must already
    exist and point its Voicebot Applet at
    `{PUBLIC_BASE_URL}/absence-calls/exotel/voicebot`.
    """

    def __init__(self) -> None:
        if not (
            settings.exotel_sid
            and settings.exotel_api_key
            and settings.exotel_api_token
            and settings.exotel_caller_id
            and settings.exotel_app_id
            and settings.public_base_url
        ):
            raise TelephonyNotConfigured(
                "Exotel isn't configured (EXOTEL_SID / EXOTEL_API_KEY / "
                "EXOTEL_API_TOKEN / EXOTEL_CALLER_ID / EXOTEL_APP_ID / PUBLIC_BASE_URL)."
            )
        self._base = (
            f"https://{settings.exotel_api_key}:{settings.exotel_api_token}"
            f"@{settings.exotel_subdomain}/v1/Accounts/{settings.exotel_sid}"
        )

    async def place_call(self, *, to_number: str, correlation_id: str) -> PlacedCall:
        # Exotel's own naming: "From" is the number that gets dialed first
        # (the guardian here), "CallerId" is our ExoPhone. Once the guardian
        # answers, Exotel connects them into the App/Flow at `Url`, which
        # runs the Voicebot Applet.
        data = {
            "From": to_number,
            "CallerId": settings.exotel_caller_id,
            "CallType": "trans",
            "Url": f"http://my.exotel.in/exoml/start/{settings.exotel_app_id}",
            # surfaced to the voicebot websocket as a custom_parameter on
            # the `start` event (max 3 custom params, ≤256 chars total)
            "CustomField": correlation_id,
            # fires on call completion (ringing/answered/etc are best-effort
            # -- Exotel's docs only firmly document the completion callback)
            "StatusCallback": _status_callback_url("exotel", settings.exotel_webhook_token),
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0)) as client:
            try:
                resp = await client.post(f"{self._base}/Calls/connect.json", data=data)
            except httpx.HTTPError as exc:
                logger.warning("exotel_network_error: %s", exc)
                raise TelephonyError("Could not reach Exotel.") from exc

        if resp.status_code >= 400:
            logger.warning("exotel_call_error status=%s body=%s", resp.status_code, resp.text[:400])
            raise TelephonyError(f"Exotel rejected the call (HTTP {resp.status_code}).")

        try:
            call = resp.json()["Call"]
            sid = call["Sid"]
        except (KeyError, ValueError) as exc:
            raise TelephonyError("Unexpected response shape from Exotel.") from exc

        return PlacedCall(provider_call_sid=sid)


class TwilioProvider(TelephonyProvider):
    """Places the call via Twilio's Calls API
    (https://www.twilio.com/docs/voice/api/call-resource), pointed straight
    at our own `/absence-calls/twilio/twiml` endpoint -- unlike Exotel,
    Twilio needs no pre-built dashboard flow; the TwiML that starts the
    bidirectional stream is generated by us, per call, on the fly.

    Twilio's free trial needs no business KYC, but a trial account can only
    call numbers you've verified first in the Twilio console (Phone Numbers
    -> Verified Caller IDs) -- fine for a controlled demo, not for real
    unknown guardian numbers.
    """

    _API_BASE = "https://api.twilio.com/2010-04-01"

    def __init__(self) -> None:
        if not (
            settings.twilio_account_sid
            and settings.twilio_auth_token
            and settings.twilio_caller_number
            and settings.public_base_url
        ):
            raise TelephonyNotConfigured(
                "Twilio isn't configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / "
                "TWILIO_CALLER_NUMBER / PUBLIC_BASE_URL)."
            )

    async def place_call(self, *, to_number: str, correlation_id: str) -> PlacedCall:
        # `correlation_id` isn't needed in the TwiML URL -- the voicebot
        # websocket correlates by call_sid, which Twilio sends in every
        # `start` event regardless (see router.py's `_TwilioWire`).
        data = {
            "To": to_number,
            "From": settings.twilio_caller_number,
            "Url": f"{settings.public_base_url}/absence-calls/twilio/twiml",
            "StatusCallback": _status_callback_url("twilio", settings.twilio_webhook_token),
            "StatusCallbackEvent": ["initiated", "ringing", "answered", "completed"],
            "StatusCallbackMethod": "POST",
        }
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0)) as client:
            try:
                resp = await client.post(
                    f"{self._API_BASE}/Accounts/{settings.twilio_account_sid}/Calls.json",
                    data=data,
                    auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                )
            except httpx.HTTPError as exc:
                logger.warning("twilio_network_error: %s", exc)
                raise TelephonyError("Could not reach Twilio.") from exc

        if resp.status_code >= 400:
            logger.warning("twilio_call_error status=%s body=%s", resp.status_code, resp.text[:400])
            raise TelephonyError(f"Twilio rejected the call (HTTP {resp.status_code}).")

        try:
            sid = resp.json()["sid"]
        except (KeyError, ValueError) as exc:
            raise TelephonyError("Unexpected response shape from Twilio.") from exc

        return PlacedCall(provider_call_sid=sid)


_PROVIDERS = {"exotel": ExotelProvider, "twilio": TwilioProvider}


def get_telephony_provider() -> TelephonyProvider:
    provider = settings.telephony_provider.lower()
    cls = _PROVIDERS.get(provider)
    if cls is None:
        raise TelephonyError(f"Unknown TELEPHONY_PROVIDER: {settings.telephony_provider!r}")
    return cls()

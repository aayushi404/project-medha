"""Security tests for the provider-facing absence-call endpoints: per-call
HMAC tokens, Twilio signature verification, and the fail-closed webhook/
websocket behaviour. No database rows are needed -- every rejection here
happens before any call lookup."""

import base64
import hashlib
import hmac
import os
import sys
import time
import unittest
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from backend.absence_calls import security
from backend.app import app
from backend.core.config import settings

client = TestClient(app)


class TestCallTokens(unittest.TestCase):
    def test_roundtrip_and_binding(self):
        cid = str(uuid.uuid4())
        tok = security.sign_call_token(cid, "status")
        self.assertTrue(security.verify_call_token(tok, cid, "status"))
        # bound to the call and to the purpose
        self.assertFalse(security.verify_call_token(tok, str(uuid.uuid4()), "status"))
        self.assertFalse(security.verify_call_token(tok, cid, "stream"))

    def test_expired_tampered_and_garbage(self):
        cid = str(uuid.uuid4())
        self.assertFalse(security.verify_call_token(security.sign_call_token(cid, "stream", ttl=-5), cid, "stream"))
        exp, _, mac = security.sign_call_token(cid, "stream").partition(".")
        self.assertFalse(security.verify_call_token(f"{int(exp) + 999}.{mac}", cid, "stream"))
        for bad in (None, "", "x", "abc.def", "123."):
            self.assertFalse(security.verify_call_token(bad, cid, "stream"))


class TestTwilioSignature(unittest.TestCase):
    def test_valid_and_invalid(self):
        original = settings.twilio_auth_token
        settings.twilio_auth_token = "test-auth-token"
        try:
            url = "https://api.example.gov.in/absence-calls/twilio/status-callback?cid=1&t=2"
            params = {"CallSid": "CA123", "CallStatus": "completed"}
            data = url + "".join(f"{k}{params[k]}" for k in sorted(params))
            sig = base64.b64encode(hmac.new(b"test-auth-token", data.encode(), hashlib.sha1).digest()).decode()
            self.assertTrue(security.verify_twilio_signature(url, params, sig))
            self.assertFalse(security.verify_twilio_signature(url, {**params, "CallStatus": "failed"}, sig))
            self.assertFalse(security.verify_twilio_signature(url, params, None))
            settings.twilio_auth_token = ""  # unconfigured -> fail closed
            self.assertFalse(security.verify_twilio_signature(url, params, sig))
        finally:
            settings.twilio_auth_token = original


class TestEndpointsFailClosed(unittest.TestCase):
    def test_exotel_webhook_without_token_is_forbidden(self):
        r = client.post("/absence-calls/exotel/status-callback", data={"CallSid": "x", "Status": "completed"})
        self.assertEqual(r.status_code, 403)

    def test_exotel_webhook_with_forged_token_is_forbidden(self):
        cid = uuid.uuid4()
        r = client.post(
            f"/absence-calls/exotel/status-callback?cid={cid}&t={int(time.time()) + 100}.deadbeef",
            data={"CallSid": "x", "Status": "completed"},
        )
        self.assertEqual(r.status_code, 403)

    def test_twilio_endpoints_require_signature(self):
        cid = str(uuid.uuid4())
        tok = security.sign_call_token(cid, "status")  # valid token, but no Twilio signature
        r = client.post(f"/absence-calls/twilio/status-callback?cid={cid}&t={tok}", data={"CallSid": "x"})
        self.assertEqual(r.status_code, 403)
        r = client.get(f"/absence-calls/twilio/twiml?cid={cid}&t={security.sign_call_token(cid, 'twiml')}")
        self.assertEqual(r.status_code, 403)

    def test_voicebot_rejects_bad_first_frame(self):
        with client.websocket_connect("/absence-calls/twilio/voicebot") as ws:
            ws.send_text('{"event":"media","media":{"payload":"AAAA"}}')
            with self.assertRaises(WebSocketDisconnect):
                ws.receive_text()

    def test_voicebot_rejects_start_without_valid_token(self):
        with client.websocket_connect("/absence-calls/twilio/voicebot") as ws:
            ws.send_text('{"event":"start","start":{"streamSid":"MZ1","callSid":"CA1","customParameters":{"cid":"%s","t":"1.aa"}}}' % uuid.uuid4())
            with self.assertRaises(WebSocketDisconnect):
                ws.receive_text()

    def test_voicebot_rejects_oversized_frame(self):
        with client.websocket_connect("/absence-calls/exotel/voicebot") as ws:
            ws.send_text("x" * (70 * 1024))
            with self.assertRaises(WebSocketDisconnect):
                ws.receive_text()


if __name__ == "__main__":
    unittest.main()

"""The request-id and security-header middleware must behave as they did when they were
`@app.middleware("http")` functions. Needs no database."""

import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
os.environ.setdefault("JWT_SECRET_KEY", "x" * 40)

from fastapi import Response  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sse_starlette.sse import EventSourceResponse  # noqa: E402

from backend.app import app  # noqa: E402
from backend.core.context import request_id_ctx  # noqa: E402


@app.get("/__test/custom-cache")
def _custom_cache() -> Response:
    return Response("x", headers={"Cache-Control": "max-age=60"})


@app.get("/__test/request-id")
def _request_id() -> dict:
    return {"rid": request_id_ctx.get()}


@app.get("/__test/stream")
async def _stream() -> EventSourceResponse:
    async def events():
        yield {"event": "done", "data": request_id_ctx.get() or ""}

    return EventSourceResponse(events())


class HeaderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def _assert_security_headers(self, response):
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertEqual(response.headers["x-frame-options"], "DENY")
        self.assertEqual(response.headers["referrer-policy"], "no-referrer")
        self.assertIn("frame-ancestors 'none'", response.headers["content-security-policy"])

    def test_normal_response_has_every_header(self):
        response = self.client.get("/health")
        self._assert_security_headers(response)
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertRegex(response.headers["x-request-id"], r"^[0-9a-f]{32}$")

    def test_errors_get_them_too(self):
        response = self.client.get("/no/such/route")
        self.assertEqual(response.status_code, 404)
        self._assert_security_headers(response)
        self.assertIn("x-request-id", response.headers)

    def test_safe_inbound_id_is_kept_and_visible_to_the_route(self):
        response = self.client.get("/__test/request-id", headers={"X-Request-ID": "proxy-id.1234"})
        self.assertEqual(response.headers["x-request-id"], "proxy-id.1234")
        self.assertEqual(response.json()["rid"], "proxy-id.1234")

    def test_unsafe_inbound_id_is_replaced(self):
        response = self.client.get("/health", headers={"X-Request-ID": "bad id with spaces"})
        self.assertRegex(response.headers["x-request-id"], r"^[0-9a-f]{32}$")

    def test_a_route_can_set_its_own_cache_header(self):
        response = self.client.get("/__test/custom-cache")
        self.assertEqual(response.headers["cache-control"], "max-age=60")

    def test_only_one_of_each_header(self):
        response = self.client.get("/health")
        names = [name.lower() for name, _ in response.headers.raw] if hasattr(response.headers, "raw") else []
        decoded = [n.decode() if isinstance(n, bytes) else n for n in names]
        self.assertEqual(decoded.count("x-request-id"), 1)

    def test_streaming_response_has_headers_and_the_id(self):
        with self.client.stream("GET", "/__test/stream", headers={"X-Request-ID": "stream-id-123"}) as response:
            body = "".join(response.iter_text())
        self._assert_security_headers(response)
        self.assertEqual(response.headers["x-request-id"], "stream-id-123")
        self.assertIn("stream-id-123", body)


if __name__ == "__main__":
    unittest.main()

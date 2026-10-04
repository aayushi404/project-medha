import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from backend.app import app  # noqa: E402
from backend.db.session import get_db  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def _logout_without_database():
    # Logout without a cookie never touches the database. Scoped to this module:
    # setting it globally at import time poisoned every other test's app.
    app.dependency_overrides[get_db] = lambda: None
    yield
    app.dependency_overrides.pop(get_db, None)


def test_health_served_with_and_without_api_prefix():
    assert client.get("/health").status_code == 200
    assert client.get("/api/health").status_code == 200


def test_unprefixed_lookalike_path_is_not_stripped():
    # "/apiary" must not be treated as "/api" + "ary"
    assert client.get("/apiary").status_code == 404


def test_refresh_cookie_path_follows_the_prefix():
    direct = client.post("/auth/logout")
    proxied = client.post("/api/auth/logout")
    assert direct.status_code == proxied.status_code == 204
    assert "Path=/auth;" in direct.headers["set-cookie"]
    assert "Path=/api/auth;" in proxied.headers["set-cookie"]

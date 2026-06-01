"""Integration coverage for curriculum-svc (the @aivo/curriculum-svc app).

Drives the real FastAPI app via TestClient end-to-end: public health, the
service-token auth gate, ZIP→district resolution, and a district-scoped skill
lookup. Lives under tests/integration/ so the cross-service readiness gate
(backend:parity) sees curriculum-svc integration coverage; runnable with:

    PYTHONPATH=services/curriculum-svc/src \
      pytest tests/integration/python/test_curriculum_svc_integration.py -v
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Make the curriculum-svc package importable without an install step.
_SRC = Path(__file__).resolve().parents[3] / "services" / "curriculum-svc" / "src"
sys.path.insert(0, str(_SRC))

try:
    from fastapi.testclient import TestClient
    from curriculum_svc.main import app
except Exception as exc:  # pragma: no cover - skip when deps not installed
    pytest.skip(f"curriculum-svc deps unavailable: {exc}", allow_module_level=True)

client = TestClient(app)
SERVICE_TOKEN = {"X-Service-Token": "aivo-internal-dev-token"}


def test_health_is_public():
    r = client.get("/api/curriculum/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_lookup_requires_auth():
    # No service token / user → the auth dependency rejects the request.
    r = client.get("/api/curriculum/lookup", params={"zipCode": "55104", "subject": "math"})
    assert r.status_code in (401, 403)


def test_district_resolution_by_zip():
    r = client.get(
        "/api/curriculum/districts/resolve",
        params={"zipCode": "55104"},
        headers=SERVICE_TOKEN,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["district"]["id"] == "mn-stpaul-public-schools"


def test_lookup_returns_district_scoped_skills():
    r = client.get(
        "/api/curriculum/lookup",
        params={"zipCode": "55104", "subject": "math"},
        headers=SERVICE_TOKEN,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["district"]["id"] == "mn-stpaul-public-schools"
    assert isinstance(body.get("skills", []), list)
    assert len(body["skills"]) >= 1

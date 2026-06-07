"""Load / latency budget for the hot read paths (Sprint 8).

Drives many lookup + validate requests through the in-process app and
asserts a p95 latency budget. This guards the handler/catalogue cost
(network/transport is out of scope here); the documented service-level
budget lives in docs/curriculum/PROMISES_TRACEABILITY.md.

Run with:
    PYTHONPATH=services/curriculum-svc/src pytest services/curriculum-svc/tests/test_load_lookup.py -v
"""
from __future__ import annotations

import time

from fastapi.testclient import TestClient

from curriculum_svc.catalogue import get_catalogue
from curriculum_svc.main import app

client = TestClient(app)
DEV = {"X-Service-Token": "aivo-internal-dev-token"}

# In-process handler budget. Generous enough to be stable in CI while still
# catching a pathological regression (e.g. an accidental O(n^2) scan).
P95_BUDGET_MS = 50.0
ITERATIONS = 300


def _p95(samples_ms: list[float]) -> float:
    ordered = sorted(samples_ms)
    idx = max(0, int(round(0.95 * (len(ordered) - 1))))
    return ordered[idx]


def test_lookup_p95_within_budget():
    get_catalogue()  # warm the memoized catalogue before timing
    samples: list[float] = []
    for _ in range(ITERATIONS):
        t0 = time.perf_counter()
        r = client.get(
            "/api/curriculum/lookup",
            params={"subject": "math", "gradeBand": "K", "zipCode": "55104"},
            headers=DEV,
        )
        samples.append((time.perf_counter() - t0) * 1000)
        assert r.status_code == 200
    p95 = _p95(samples)
    assert p95 < P95_BUDGET_MS, f"lookup p95 {p95:.1f}ms exceeded budget {P95_BUDGET_MS}ms"


def test_validate_p95_within_budget():
    get_catalogue()
    payload = {
        "country": "NG",
        "region": "Lagos",
        "subject": "math",
        "gradeBand": "Primary-3",
        "topics": ["Whole numbers up to 999", "Photosynthesis"],
        "standards": ["ng-nerdc.math.p3.number.addition", "3.NF.A.1"],
    }
    samples: list[float] = []
    for _ in range(ITERATIONS):
        t0 = time.perf_counter()
        r = client.post("/api/curriculum/validate", json=payload, headers=DEV)
        samples.append((time.perf_counter() - t0) * 1000)
        assert r.status_code == 200
    p95 = _p95(samples)
    assert p95 < P95_BUDGET_MS, f"validate p95 {p95:.1f}ms exceeded budget {P95_BUDGET_MS}ms"

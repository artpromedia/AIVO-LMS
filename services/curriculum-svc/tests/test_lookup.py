"""End-to-end tests for curriculum-svc — exercise the FastAPI app and
the underlying Catalogue logic.

Run with:
    PYTHONPATH=services/curriculum-svc/src pytest services/curriculum-svc/tests/ -v
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from curriculum_svc.catalogue import (
    get_catalogue,
    load_catalogue_from_dict,
)
from curriculum_svc.main import app

# Default headers carry the dev service token so authenticated routes
# accept the request in unit tests. Add ``DEV_TOKEN_HEADERS`` to every
# call to a protected route; ``/api/curriculum/health`` remains public.
DEV_TOKEN_HEADERS = {"X-Service-Token": "aivo-internal-dev-token"}

client = TestClient(app)


# ── Catalogue (pure) ──────────────────────────────────────────────────

def test_catalogue_loads_from_bundled_snapshot():
    cat = get_catalogue()
    assert cat.get_skill("ccss.math.k.cc.a.1") is not None
    assert cat.resolve_district_by_zip("55104").id == "mn-stpaul-public-schools"
    assert cat.resolve_district_by_zip("98405").id == "wa-tacoma-public-schools"
    assert len(cat.list_skills(subject="math", district_id="mn-stpaul-public-schools")) >= 4
    assert len(cat.list_packs(subject="ela", grade_band="K", district_id="mn-stpaul-public-schools")) >= 1


def test_catalogue_filters_packs_by_district():
    cat = get_catalogue()
    saint_paul_pack_ids = [p.id for p in cat.list_packs(subject="math", grade_band="K", district_id="mn-stpaul-public-schools")]
    tacoma_pack_ids = [p.id for p in cat.list_packs(subject="math", grade_band="K", district_id="wa-tacoma-public-schools")]
    assert saint_paul_pack_ids == ["mn-stpaul-k-math-fall-2026"]
    assert tacoma_pack_ids == ["wa-tacoma-k-math-fall-2026"]


def test_prerequisite_path_returns_topologically_sorted_chain():
    cat = get_catalogue()
    path = cat.prerequisite_path("ccss.math.1.oa.a.1")
    ids = [s.id for s in path]
    assert "ccss.math.k.cc.a.1" in ids
    assert "ccss.math.k.cc.b.4" in ids
    # CC.B.4 depends on CC.A.1 — A.1 must precede B.4.
    assert ids.index("ccss.math.k.cc.a.1") < ids.index("ccss.math.k.cc.b.4")
    # The target itself is not included in the path.
    assert "ccss.math.1.oa.a.1" not in ids


def test_prerequisite_path_handles_cycles_gracefully():
    cat = load_catalogue_from_dict(
        {
            "districts": [{"id": "d", "name": "District", "state": "MN", "zipCodes": ["55104"]}],
            "skills": [
                {"id": "a", "subject": "math", "gradeBand": "K", "label": "", "summary": "", "prerequisites": ["b"]},
                {"id": "b", "subject": "math", "gradeBand": "K", "label": "", "summary": "", "prerequisites": ["a"]},
            ],
            "contentPacks": [{"id": "p", "subject": "math", "gradeBand": "K", "districtIds": ["d"], "skillIds": ["a", "b"]}],
        }
    )
    # Should terminate (no recursion blowup) and return one of the two
    # skills as the prerequisite chain.
    path = cat.prerequisite_path("a")
    assert len(path) == 1
    assert path[0].id in {"a", "b"}


# ── HTTP ──────────────────────────────────────────────────────────────

def test_health_endpoint():
    r = client.get("/api/curriculum/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_resolve_district_from_enrollment_zip_code():
    r = client.get(
        "/api/curriculum/districts/resolve",
        params={"zipCode": "55104-1234"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["zipCode"] == "55104"
    assert body["district"]["id"] == "mn-stpaul-public-schools"


def test_resolve_district_404s_for_unmapped_zip_code():
    r = client.get(
        "/api/curriculum/districts/resolve",
        params={"zipCode": "00000"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 404


def test_lookup_requires_at_least_one_filter():
    r = client.get("/api/curriculum/lookup", params={"zipCode": "55104"}, headers=DEV_TOKEN_HEADERS)
    assert r.status_code == 400


def test_lookup_requires_enrollment_zip_code():
    r = client.get(
        "/api/curriculum/lookup",
        params={"subject": "math", "gradeBand": "K"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 422


def test_lookup_by_subject_grade_and_zip_serves_only_that_district():
    r = client.get(
        "/api/curriculum/lookup",
        params={"subject": "math", "gradeBand": "K", "zipCode": "55104"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["district"]["id"] == "mn-stpaul-public-schools"
    skill_ids = [s["id"] for s in body["skills"]]
    assert "ccss.math.k.cc.a.1" in skill_ids
    # No K-math skill belongs to grade 1 — filter must hold.
    for s in body["skills"]:
        assert s["gradeBand"] == "K"
        assert s["subject"] == "math"
    pack_ids = [p["id"] for p in body["contentPacks"]]
    assert pack_ids == ["mn-stpaul-k-math-fall-2026"]
    assert body["contentPacks"][0]["districtIds"] == ["mn-stpaul-public-schools"]


def test_lookup_different_zip_serves_different_district_curriculum():
    r = client.get(
        "/api/curriculum/lookup",
        params={"subject": "math", "gradeBand": "K", "zipCode": "98405"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["district"]["id"] == "wa-tacoma-public-schools"
    assert [p["id"] for p in body["contentPacks"]] == ["wa-tacoma-k-math-fall-2026"]
    # Tacoma's current sample pack intentionally excludes this Saint Paul skill.
    assert "ccss.math.k.cc.a.3" not in [s["id"] for s in body["skills"]]


def test_lookup_by_skill_id_returns_skill_and_immediate_prereqs_for_district():
    r = client.get(
        "/api/curriculum/lookup",
        params={"skillId": "ccss.math.k.cc.b.4", "zipCode": "55104"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 200
    body = r.json()
    ids = [s["id"] for s in body["skills"]]
    assert ids[0] == "ccss.math.k.cc.b.4"
    assert "ccss.math.k.cc.a.1" in ids
    assert "ccss.math.k.cc.a.2" in ids


def test_lookup_by_skill_id_403s_when_skill_not_in_district_curriculum():
    r = client.get(
        "/api/curriculum/lookup",
        params={"skillId": "ccss.math.k.cc.a.3", "zipCode": "98405"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 403


def test_lookup_by_unknown_skill_id_404s():
    r = client.get(
        "/api/curriculum/lookup",
        params={"skillId": "no-such-skill", "zipCode": "55104"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 404


def test_prereq_path_endpoint():
    r = client.get(
        "/api/curriculum/skills/ccss.math.1.oa.a.1/path",
        params={"zipCode": "55104"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 403


def test_prereq_path_endpoint_for_district_available_skill():
    r = client.get(
        "/api/curriculum/skills/ccss.math.k.cc.b.4/path",
        params={"zipCode": "55104"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["skillId"] == "ccss.math.k.cc.b.4"
    assert body["district"]["id"] == "mn-stpaul-public-schools"
    ids = [s["id"] for s in body["path"]]
    assert "ccss.math.k.cc.a.1" in ids


def test_prereq_path_endpoint_404s_for_unknown_skill():
    r = client.get(
        "/api/curriculum/skills/no-such/path",
        params={"zipCode": "55104"},
        headers=DEV_TOKEN_HEADERS,
    )
    assert r.status_code == 404


# ── Auth ──────────────────────────────────────────────────────────────


def test_lookup_rejects_request_without_credentials():
    r = client.get(
        "/api/curriculum/lookup",
        params={"subject": "math", "gradeBand": "K", "zipCode": "55104"},
    )
    assert r.status_code == 401


def test_lookup_rejects_wrong_service_token():
    r = client.get(
        "/api/curriculum/lookup",
        params={"subject": "math", "gradeBand": "K", "zipCode": "55104"},
        headers={"X-Service-Token": "wrong"},
    )
    assert r.status_code == 401


def test_lookup_accepts_bearer_token():
    r = client.get(
        "/api/curriculum/lookup",
        params={"subject": "math", "gradeBand": "K", "zipCode": "55104"},
        headers={"Authorization": "Bearer a-bearer-longer-than-16-chars"},
    )
    assert r.status_code == 200


def test_prereq_path_rejects_request_without_credentials():
    r = client.get("/api/curriculum/skills/ccss.math.k.cc.b.4/path", params={"zipCode": "55104"})
    assert r.status_code == 401


def test_health_endpoint_remains_public():
    r = client.get("/api/curriculum/health")
    assert r.status_code == 200

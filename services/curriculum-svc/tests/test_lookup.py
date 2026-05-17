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

client = TestClient(app)


# ── Catalogue (pure) ──────────────────────────────────────────────────

def test_catalogue_loads_from_bundled_snapshot():
    cat = get_catalogue()
    assert cat.get_skill("ccss.math.k.cc.a.1") is not None
    assert len(cat.list_skills(subject="math")) >= 4
    assert len(cat.list_packs(subject="ela", grade_band="K")) >= 1


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
            "skills": [
                {"id": "a", "subject": "math", "gradeBand": "K", "label": "", "summary": "", "prerequisites": ["b"]},
                {"id": "b", "subject": "math", "gradeBand": "K", "label": "", "summary": "", "prerequisites": ["a"]},
            ],
            "contentPacks": [],
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


def test_lookup_requires_at_least_one_filter():
    r = client.get("/api/curriculum/lookup")
    assert r.status_code == 400


def test_lookup_by_subject_and_grade_band():
    r = client.get("/api/curriculum/lookup", params={"subject": "math", "gradeBand": "K"})
    assert r.status_code == 200
    body = r.json()
    skill_ids = [s["id"] for s in body["skills"]]
    assert "ccss.math.k.cc.a.1" in skill_ids
    # No K-math skill belongs to grade 1 — filter must hold.
    for s in body["skills"]:
        assert s["gradeBand"] == "K"
        assert s["subject"] == "math"
    pack_ids = [p["id"] for p in body["contentPacks"]]
    assert "k-math-fall-2026" in pack_ids


def test_lookup_by_skill_id_returns_skill_and_immediate_prereqs():
    r = client.get("/api/curriculum/lookup", params={"skillId": "ccss.math.k.cc.b.4"})
    assert r.status_code == 200
    body = r.json()
    ids = [s["id"] for s in body["skills"]]
    assert ids[0] == "ccss.math.k.cc.b.4"
    assert "ccss.math.k.cc.a.1" in ids
    assert "ccss.math.k.cc.a.2" in ids


def test_lookup_by_unknown_skill_id_404s():
    r = client.get("/api/curriculum/lookup", params={"skillId": "no-such-skill"})
    assert r.status_code == 404


def test_prereq_path_endpoint():
    r = client.get("/api/curriculum/skills/ccss.math.1.oa.a.1/path")
    assert r.status_code == 200
    body = r.json()
    assert body["skillId"] == "ccss.math.1.oa.a.1"
    ids = [s["id"] for s in body["path"]]
    assert "ccss.math.k.cc.a.1" in ids


def test_prereq_path_endpoint_404s_for_unknown_skill():
    r = client.get("/api/curriculum/skills/no-such/path")
    assert r.status_code == 404

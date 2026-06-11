"""Syllabus ↔ jurisdiction validation tests (Sprint 7, G8).

Proves off-curriculum topics/standards are flagged (not silently accepted)
and in-curriculum topics map to real skill ids — at the pure-logic level
and over the HTTP route.

Run with:
    PYTHONPATH=services/curriculum-svc/src pytest services/curriculum-svc/tests/test_validate.py -v
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from curriculum_svc.catalogue import get_catalogue
from curriculum_svc.main import app
from curriculum_svc.validation import validate_topics_and_standards

client = TestClient(app)
DEV = {"X-Service-Token": "aivo-internal-dev-token"}
_VALIDATE = "/api/curriculum/validate"


# ── Pure validation ───────────────────────────────────────────────────


def _ng_p3_math_skills():
    return get_catalogue().list_skills(
        subject="math", grade_band="Primary-3", district_id="ng-lagos-state"
    )


def test_exact_standard_in_packs_matches():
    skills = _ng_p3_math_skills()
    result = validate_topics_and_standards(
        skills, topics=[], standards=["ng-nerdc.math.p3.number.addition"]
    )
    assert [m.skillId for m in result.matched] == ["ng-nerdc.math.p3.number.addition"]
    assert result.unmatched == ()


def test_foreign_standard_is_flagged():
    skills = _ng_p3_math_skills()
    # A CCSS code is not in NG NERDC packs.
    result = validate_topics_and_standards(skills, topics=[], standards=["3.NF.A.1"])
    assert result.matched == ()
    assert result.unmatched[0].input == "3.NF.A.1"
    assert result.unmatched[0].reason == "not_in_jurisdiction_packs"


def test_in_curriculum_topic_maps_to_skill_id():
    skills = _ng_p3_math_skills()
    result = validate_topics_and_standards(
        skills, topics=["Whole numbers up to 999"], standards=[]
    )
    assert len(result.matched) == 1
    assert result.matched[0].kind == "topic"
    assert result.matched[0].skillId == "ng-nerdc.math.p3.number.whole-numbers"


def test_off_curriculum_topic_is_flagged_with_suggestions():
    skills = _ng_p3_math_skills()
    result = validate_topics_and_standards(
        skills, topics=["Photosynthesis in plants"], standards=[]
    )
    assert result.matched == ()
    assert result.unmatched[0].reason == "off_curriculum"
    # A suggestion list is returned (possibly empty when nothing is close).
    assert len(result.suggestions) == 1


def test_mixed_batch_partitions_correctly():
    skills = _ng_p3_math_skills()
    result = validate_topics_and_standards(
        skills,
        topics=["Subtraction of 3-digit numbers", "Dinosaurs"],
        standards=["ng-nerdc.math.p3.number.fractions", "TEKS.3.4A"],
    )
    matched_inputs = {m.input for m in result.matched}
    unmatched_inputs = {u.input for u in result.unmatched}
    assert "ng-nerdc.math.p3.number.fractions" in matched_inputs
    assert "Subtraction of 3-digit numbers" in matched_inputs
    assert "TEKS.3.4A" in unmatched_inputs
    assert "Dinosaurs" in unmatched_inputs


# ── HTTP route ────────────────────────────────────────────────────────


def test_route_flags_off_curriculum_for_ng():
    r = client.post(
        _VALIDATE,
        headers=DEV,
        json={
            "country": "NG",
            "region": "Lagos",
            "subject": "math",
            "gradeBand": "Primary-3",
            "topics": ["Whole numbers up to 999", "Photosynthesis"],
            "standards": ["3.NF.A.1"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["jurisdictionDistrictId"] == "ng-lagos-state"
    assert body["frameworkCode"] == "NG-NERDC"
    assert body["offCurriculumCount"] >= 2  # Photosynthesis topic + CCSS standard
    matched_skill_ids = {m["skillId"] for m in body["matched"]}
    assert "ng-nerdc.math.p3.number.whole-numbers" in matched_skill_ids


def test_route_us_zip_backcompat():
    r = client.post(
        _VALIDATE,
        headers=DEV,
        json={
            "zipCode": "55104",
            "subject": "math",
            "gradeBand": "K",
            "standards": ["ccss.math.k.cc.a.1", "ng-nerdc.math.p3.number.addition"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["jurisdictionDistrictId"] == "mn-stpaul-public-schools"
    assert any(m["skillId"] == "ccss.math.k.cc.a.1" for m in body["matched"])
    assert any(u["input"] == "ng-nerdc.math.p3.number.addition" for u in body["unmatched"])


def test_route_requires_topics_or_standards():
    r = client.post(
        _VALIDATE,
        headers=DEV,
        json={"country": "NG", "region": "Lagos", "subject": "math", "gradeBand": "Primary-3"},
    )
    assert r.status_code == 400


def test_route_requires_auth():
    r = client.post(
        _VALIDATE,
        json={"zipCode": "55104", "subject": "math", "gradeBand": "K", "standards": ["x"]},
    )
    assert r.status_code == 401


# ── Wave D (G3): official notation matching + catalogue-scale perf ──────────


def test_official_notation_matches_and_invented_codes_reject():
    cat = get_catalogue()
    district = cat.resolve_district_by_zip("90017")  # LA Unified (NCES import)
    assert district is not None
    approved = cat.list_skills(subject="math", grade_band="3", district_id=district.id)
    assert len(approved) >= 15

    result = validate_topics_and_standards(
        approved,
        topics=[],
        standards=[
            "CCSS.MATH.CONTENT.3.NF.A.1",  # official notation, any case
            "ccss.math.3.md.b.3",  # canonical catalogue id
            "CCSS.MATH.CONTENT.99.ZZ.Z.9",  # invented — must reject
        ],
    )
    matched = {m.input: m.skillId for m in result.matched}
    assert matched["CCSS.MATH.CONTENT.3.NF.A.1"] == "ccss.math.3.nf.a.1"
    assert matched["ccss.math.3.md.b.3"] == "ccss.math.3.md.b.3"
    assert any(
        u.input == "CCSS.MATH.CONTENT.99.ZZ.Z.9" and u.reason == "not_in_jurisdiction_packs"
        for u in result.unmatched
    )


def test_validate_route_accepts_official_notation_end_to_end():
    r = client.post(
        _VALIDATE,
        headers=DEV,
        json={
            "zipCode": "90017",
            "subject": "math",
            "gradeBand": "3",
            "standards": ["CCSS.MATH.CONTENT.3.NF.A.1"],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["jurisdictionDistrictId"] == "ca-los-angeles-unified"
    assert any(m["skillId"] == "ccss.math.3.nf.a.1" for m in body["matched"])
    assert body["offCurriculumCount"] == 0


def test_validate_stays_fast_at_catalogue_scale():
    """Perf contract (Wave D): <50ms per call against a full grade band of
    the imported catalogue. The stem cache makes per-request stemming a
    dict lookup; without it this regresses ~50x at 10^3 skills."""
    import time

    cat = get_catalogue()
    district = cat.resolve_district_by_zip("90017")
    approved = cat.list_skills(subject="ela", grade_band="3", district_id=district.id)
    topics = [f"reading comprehension of informational text {i}" for i in range(20)]
    validate_topics_and_standards(approved, topics, [])  # warm the cache
    t0 = time.perf_counter()
    runs = 10
    for _ in range(runs):
        validate_topics_and_standards(approved, topics, [])
    avg_ms = (time.perf_counter() - t0) / runs * 1000
    assert avg_ms < 50, f"validate averaged {avg_ms:.1f}ms (limit 50)"

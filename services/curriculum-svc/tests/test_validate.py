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

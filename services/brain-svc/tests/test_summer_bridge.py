"""Wave D (G6) — summer-bridge engine rules.

Pinned behaviors: the K-8 grade ladder (8 has no bridge — never guess),
catalogue-unit grouping into opening preview units, and the pure bridge
payload (closing-grade review + next-grade preview; NO units → None so
the route falls back to plain holiday prep instead of inventing content).

Run with:  PYTHONPATH=services/brain-svc/src pytest services/brain-svc/tests/test_summer_bridge.py -v
"""
from __future__ import annotations

from brain_svc.services.next_grade import catalogue_subject, group_skills_into_units
from brain_svc.services.pacing_engine import build_summer_bridge, next_grade_band


def test_next_grade_band_walks_the_k8_ladder_and_stops_at_8():
    assert next_grade_band("K") == "1"
    assert next_grade_band("k") == "1"
    assert next_grade_band("3") == "4"
    assert next_grade_band("Grade 7") == "8"
    assert next_grade_band("8") is None  # catalogue ceiling — no invention
    assert next_grade_band("12") is None
    assert next_grade_band(None) is None
    assert next_grade_band("unknown") is None


def test_catalogue_subject_maps_pacing_names():
    assert catalogue_subject("reading") == "ela"
    assert catalogue_subject("math") == "math"
    assert catalogue_subject("ELA") == "ela"


def _skill(sid: str, label: str, source: str) -> dict:
    return {"id": sid, "label": label, "source": source}


def test_group_skills_into_units_takes_opening_domains_with_cluster_titles():
    skills = [
        _skill("ccss.math.4.nbt.a", "Generalize place value understanding", "CCSS.Math.Content.4.NBT.A"),
        _skill("ccss.math.4.nbt.a.1", "Recognize place value relationships", "CCSS.Math.Content.4.NBT.A.1"),
        _skill("ccss.math.4.nbt.a.2", "Read and write multi-digit numbers", "CCSS.Math.Content.4.NBT.A.2"),
        _skill("ccss.math.4.nf.a.1", "Explain fraction equivalence", "CCSS.Math.Content.4.NF.A.1"),
        _skill("ccss.math.4.oa.a.1", "Interpret multiplication equations", "CCSS.Math.Content.4.OA.A.1"),
    ]
    units = group_skills_into_units(skills, "math", "4")
    assert len(units) == 2  # OPENING_DOMAINS
    assert units[0]["title"] == "Generalize place value understanding"  # cluster row
    assert units[0]["grade_band"] == "4"
    assert "Read and write multi-digit numbers" in units[0]["topics"]
    # Cluster rows title the unit but numbered standards drive the topics.
    assert "Generalize place value understanding" not in units[0]["topics"]
    assert units[1]["title"].startswith("Grade 4")  # no cluster row for nf here
    # ELA domain position differs — grouping still works.
    ela_units = group_skills_into_units(
        [_skill("ccss.ela.rf.4.3", "Phonics and word recognition", "CCSS.ELA-Literacy.RF.4.3")],
        "ela",
        "4",
    )
    assert ela_units[0]["topics"] == ["Phonics and word recognition"]


_WEEKS = [
    {"week_index": 1, "kind": "instruction", "unit_title": "Fractions II",
     "topics": ["compare fractions"], "standards": ["3.NF.A.3"], "vocabulary": ["numerator"]},
    {"week_index": 2, "kind": "instruction", "unit_title": "Measurement",
     "topics": ["tell time"], "standards": ["3.MD.A.1"], "vocabulary": ["minute"]},
    {"week_index": 3, "kind": "break", "unit_title": None,
     "topics": [], "standards": [], "vocabulary": []},
]

_UNITS = [
    {"title": "Grade 4 place value", "grade_band": "4",
     "topics": ["multi-digit numbers"], "standards": ["CCSS.Math.Content.4.NBT.A.1"],
     "vocabulary": []},
]


def test_build_summer_bridge_reviews_closing_grade_and_previews_next_grade():
    bridge = build_summer_bridge(_WEEKS, 3, _UNITS)
    assert bridge is not None
    # Review = most recent instruction weeks before the break.
    assert "tell time" in bridge["review_topics"]
    assert bridge["prior_unit_title"] == "Measurement"
    # Preview = the NEXT grade's catalogue units, verbatim.
    assert bridge["next_grade_band"] == "4"
    assert bridge["preview_topics"] == ["multi-digit numbers"]
    assert bridge["preview_standards"] == ["CCSS.Math.Content.4.NBT.A.1"]
    assert bridge["next_unit_title"] == "Grade 4 place value"


def test_build_summer_bridge_returns_none_without_next_grade_units():
    assert build_summer_bridge(_WEEKS, 3, []) is None
    assert build_summer_bridge(_WEEKS, 3, [{"title": "", "topics": []}]) is None


def test_build_summer_bridge_tolerates_missing_review_weeks():
    bridge = build_summer_bridge([_WEEKS[2]], 3, _UNITS)
    assert bridge is not None
    assert bridge["review_topics"] == []
    assert bridge["preview_topics"] == ["multi-digit numbers"]

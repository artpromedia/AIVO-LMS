"""Sprint 6: pacing an uploaded whole-term syllabus.

Proves the brain-svc side of the term-syllabus journey: an uploaded term
scope-&-sequence (the shape ai-svc /parse-term emits) is normalised and
laid onto a break-aware weekly calendar — 12 units become 12 dated
instruction weeks, with break weeks inserted around holidays.

Run with:  PYTHONPATH=services/brain-svc/src pytest services/brain-svc/tests/test_term_pacing.py -v
"""
from __future__ import annotations

import pytest

from brain_svc.services.pacing_engine import (
    SCOPE_SOURCE_UPLOADED_TERM,
    build_pacing_weeks,
    normalize_uploaded_scope,
)


def _uploaded_scope(weeks: int = 12) -> dict:
    """Mirrors ai-svc term_syllabus_parser output (single term, N units)."""
    units = [
        {
            "title": f"Week {i + 1} unit",
            "duration_weeks": 1,
            "topics": [f"topic {i + 1}"],
            "learning_objectives": [f"students will do {i + 1}"],
            "standards_addressed": [f"3.NBT.A.{i + 1}"],
            "key_vocabulary": ["digit"],
        }
        for i in range(weeks)
    ]
    return {
        "subject": "math",
        "source": SCOPE_SOURCE_UPLOADED_TERM,
        "total_terms": 1,
        "terms": [{"term_number": 1, "title": "Term 1", "units": units}],
    }


def test_normalize_rejects_empty_scope():
    with pytest.raises(ValueError):
        normalize_uploaded_scope({"terms": []})
    with pytest.raises(ValueError):
        normalize_uploaded_scope("not a dict")


def test_uploaded_term_produces_twelve_instruction_weeks():
    scope = normalize_uploaded_scope(_uploaded_scope(12))
    weeks = build_pacing_weeks(scope, breaks=[], plan_start="2026-09-01")
    instruction = [w for w in weeks if w["kind"] == "instruction"]
    assert len(instruction) == 12
    # Each instruction week is dated and carries the uploaded unit content
    # (the engine surfaces objectives as the week's topics).
    assert instruction[0]["week_start"] == "2026-09-01"
    assert "students will do 1" in instruction[0]["topics"]
    assert instruction[0]["objectives"] == ["students will do 1"]
    assert "3.NBT.A.1" in instruction[0]["standards"]


def test_uploaded_term_pacing_is_break_aware():
    scope = normalize_uploaded_scope(_uploaded_scope(12))
    # A one-week holiday in the middle of the term.
    breaks = [{"name": "Fall Break", "start_date": "2026-10-05", "end_date": "2026-10-09"}]
    weeks = build_pacing_weeks(scope, breaks=breaks, plan_start="2026-09-01")
    kinds = [w["kind"] for w in weeks]
    assert "break" in kinds
    # Instruction is not lost to the break: all 12 units still placed.
    assert sum(1 for w in weeks if w["kind"] == "instruction") == 12
    break_week = next(w for w in weeks if w["kind"] == "break")
    assert break_week["unit_title"] == "Fall Break"
    assert break_week["topics"] == []

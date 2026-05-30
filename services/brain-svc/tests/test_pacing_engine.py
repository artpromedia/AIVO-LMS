"""Unit tests for the calendar-driven weekly pacing engine (pure functions).

Run with: pytest services/brain-svc/tests/test_pacing_engine.py -v
"""

from datetime import date

from brain_svc.services.pacing_engine import build_pacing_weeks, flatten_unit_weeks

SCOPE = {
    "subject": "math",
    "terms": [
        {
            "term_number": 1,
            "title": "Term 1",
            "duration_weeks": 4,
            "units": [
                {
                    "title": "Place value",
                    "duration_weeks": 2,
                    "standards_addressed": ["CCSS.MATH.3.NBT.A.1"],
                    "learning_objectives": ["Round to nearest 10", "Round to nearest 100"],
                    "key_vocabulary": ["round", "place value"],
                },
                {
                    "title": "Addition",
                    "duration_weeks": 2,
                    "standards_addressed": ["CCSS.MATH.3.NBT.A.2"],
                    "learning_objectives": ["Add within 1000"],
                    "key_vocabulary": ["sum", "regroup"],
                },
            ],
        }
    ],
}


def test_flatten_expands_units_by_duration():
    unit_weeks = flatten_unit_weeks(SCOPE)
    # 2 + 2 = 4 instructional unit-weeks.
    assert len(unit_weeks) == 4
    assert unit_weeks[0]["unit_title"] == "Place value"
    assert unit_weeks[0]["standards"] == ["CCSS.MATH.3.NBT.A.1"]
    assert unit_weeks[2]["unit_title"] == "Addition"


def test_flatten_defaults_missing_duration_to_one_week():
    scope = {"terms": [{"term_number": 1, "units": [{"title": "Solo"}]}]}
    assert len(flatten_unit_weeks(scope)) == 1


def test_build_pacing_weeks_no_breaks_is_contiguous():
    start = date(2026, 8, 17)  # a Monday
    weeks = build_pacing_weeks(SCOPE, [], start.isoformat())
    assert len(weeks) == 4
    assert all(w["kind"] == "instruction" for w in weeks)
    # Weeks are contiguous 7-day windows.
    assert weeks[0]["week_start"] == "2026-08-17"
    assert weeks[0]["week_end"] == "2026-08-23"
    assert weeks[1]["week_start"] == "2026-08-24"
    # week_index is monotonic from 0.
    assert [w["week_index"] for w in weeks] == [0, 1, 2, 3]


def test_build_pacing_weeks_pauses_over_a_break():
    start = date(2026, 8, 17)
    # A one-week break covering the 2nd calendar week.
    breaks = [{"name": "Labor Day", "kind": "holiday", "start_date": "2026-08-24", "end_date": "2026-08-30"}]
    weeks = build_pacing_weeks(SCOPE, breaks, start.isoformat())
    # 4 instructional weeks + 1 break week = 5 total.
    assert len(weeks) == 5
    assert weeks[1]["kind"] == "break"
    assert weeks[1]["unit_title"] == "Labor Day"
    assert weeks[1]["topics"] == []
    # Instruction resumes after the break and all 4 unit-weeks are still placed.
    assert sum(1 for w in weeks if w["kind"] == "instruction") == 4
    # The instructional unit-week that would have landed on the break is pushed out.
    assert weeks[2]["kind"] == "instruction"
    assert weeks[2]["week_start"] == "2026-08-31"


def test_build_pacing_weeks_places_all_unit_weeks_in_order():
    start = date(2026, 8, 17)
    breaks = [{"name": "Fall break", "start_date": "2026-08-31", "end_date": "2026-09-06"}]
    weeks = build_pacing_weeks(SCOPE, breaks, start.isoformat())
    instruction = [w for w in weeks if w["kind"] == "instruction"]
    titles = [w["unit_title"] for w in instruction]
    assert titles == ["Place value", "Place value", "Addition", "Addition"]


def test_invalid_start_raises():
    try:
        build_pacing_weeks(SCOPE, [], "not-a-date")
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_empty_scope_produces_no_weeks():
    assert build_pacing_weeks({"terms": []}, [], "2026-08-17") == []

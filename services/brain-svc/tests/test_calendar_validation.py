"""Wave B — pure validation for the parent/teacher school-calendar surface.

The PUT /{learner_id}/calendar route rejects a payload when this validator
reports problems, so the rules proven here are the API contract:
inverted/unparseable dates fail, overlapping TERMS fail, unknown break
kinds fail — while breaks inside terms (the normal holiday case) pass.

Run with:  PYTHONPATH=services/brain-svc/src pytest services/brain-svc/tests/test_calendar_validation.py -v
"""
from __future__ import annotations

from brain_svc.services.pacing_engine import validate_calendar_payload


def _term(n: int, start: str, end: str, title: str | None = None) -> dict:
    return {"term_number": n, "title": title, "start_date": start, "end_date": end}


def _break(kind: str, start: str, end: str, name: str | None = None) -> dict:
    return {"kind": kind, "name": name, "start_date": start, "end_date": end}


def test_valid_calendar_with_breaks_inside_terms_passes():
    problems = validate_calendar_payload(
        terms=[
            _term(1, "2026-09-01", "2026-12-18"),
            _term(2, "2027-01-05", "2027-03-26"),
        ],
        breaks=[
            _break("holiday", "2026-11-25", "2026-11-27", "Thanksgiving"),
            _break("break", "2026-12-19", "2027-01-04", "Winter break"),
            _break("summer", "2027-06-12", "2027-08-31", "Summer"),
        ],
    )
    assert problems == []


def test_overlapping_terms_are_rejected():
    problems = validate_calendar_payload(
        terms=[_term(1, "2026-09-01", "2026-12-18"), _term(2, "2026-12-10", "2027-03-26")],
        breaks=[],
    )
    assert any("overlap" in p for p in problems)


def test_inverted_and_unparseable_dates_are_rejected():
    problems = validate_calendar_payload(
        terms=[_term(1, "2026-12-18", "2026-09-01")],
        breaks=[_break("holiday", "not-a-date", "2026-11-27")],
    )
    assert any("precedes" in p for p in problems)
    assert any("ISO dates" in p for p in problems)


def test_unknown_break_kind_is_rejected():
    problems = validate_calendar_payload(
        terms=[_term(1, "2026-09-01", "2026-12-18")],
        breaks=[_break("vacation", "2026-11-25", "2026-11-27", "Thanksgiving")],
    )
    assert any("kind 'vacation'" in p for p in problems)


def test_adjacent_terms_do_not_overlap():
    problems = validate_calendar_payload(
        terms=[_term(1, "2026-09-01", "2026-12-18"), _term(2, "2026-12-19", "2027-03-26")],
        breaks=[],
    )
    assert problems == []

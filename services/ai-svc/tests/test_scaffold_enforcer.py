"""Sprint 5 — functioning-level scaffold enforcement tests.

Pins down the per-level shape contract: STANDARD permits anything,
SUPPORTED / LOW_VERBAL / NON_VERBAL get progressively stricter, and
PRE_SYMBOLIC short-circuits the MC flow entirely with an observation
checklist.
"""

from __future__ import annotations

import pytest

from ai_svc.services.scaffold_enforcer import (
    build_pre_symbolic_observation_payload,
    enforce_batch,
    evaluate_item,
    normalize_level,
)


def _mc(stem: str, options: list[tuple[str, str]], *, qid: str = "q1") -> dict:
    """Build a minimal MC item for the tests."""
    return {
        "id": qid,
        "subject": "math",
        "questionText": stem,
        "options": [{"value": v, "label": l} for v, l in options],
        "correctAnswer": options[0][0],
    }


# ── normalize_level ──────────────────────────────────────────────────


class TestNormalizeLevel:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("STANDARD", "STANDARD"),
            ("standard", "STANDARD"),
            (" supported ", "SUPPORTED"),
            ("LOW_VERBAL", "LOW_VERBAL"),
            ("NON_VERBAL", "NON_VERBAL"),
            ("PRE_SYMBOLIC", "PRE_SYMBOLIC"),
            (None, "STANDARD"),
            ("", "STANDARD"),
            ("nonsense", "STANDARD"),
        ],
    )
    def test_normalises(self, raw, expected):
        assert normalize_level(raw) == expected


# ── STANDARD ─────────────────────────────────────────────────────────


class TestStandard:
    def test_passes_long_stem_and_many_options(self):
        item = _mc("A" * 500, [("a", "Apple"), ("b", "Banana"), ("c", "Carrot"), ("d", "Dill")])
        v = evaluate_item(item, "STANDARD")
        assert v.ok, v.violations


# ── SUPPORTED ────────────────────────────────────────────────────────


class TestSupported:
    def test_rejects_stem_over_180_chars(self):
        item = _mc("X" * 200, [("a", "A"), ("b", "B")])
        v = evaluate_item(item, "SUPPORTED")
        codes = [vi.code for vi in v.violations]
        assert "STEM_TOO_LONG" in codes
        assert not v.ok

    def test_rejects_more_than_4_options(self):
        item = _mc(
            "Pick one",
            [("a", "A"), ("b", "B"), ("c", "C"), ("d", "D"), ("e", "E")],
        )
        v = evaluate_item(item, "SUPPORTED")
        assert any(vi.code == "TOO_MANY_OPTIONS" for vi in v.violations)

    def test_allows_within_limits(self):
        item = _mc("Short stem.", [("a", "A"), ("b", "B"), ("c", "C")])
        v = evaluate_item(item, "SUPPORTED")
        assert v.ok


# ── LOW_VERBAL ───────────────────────────────────────────────────────


class TestLowVerbal:
    def test_requires_emoji_in_options(self):
        item = _mc("Pick one", [("a", "apple"), ("b", "banana")])
        v = evaluate_item(item, "LOW_VERBAL")
        assert any(vi.code == "OPTION_MISSING_PICTOGRAPH" for vi in v.violations)

    def test_passes_with_emoji_labels(self):
        item = _mc("Pick one", [("a", "🍎 apple"), ("b", "🍌 banana")])
        v = evaluate_item(item, "LOW_VERBAL")
        assert v.ok, v.violations

    def test_caps_options_at_3(self):
        item = _mc("X", [("a", "🍎"), ("b", "🍌"), ("c", "🥕"), ("d", "🌿")])
        v = evaluate_item(item, "LOW_VERBAL")
        assert any(vi.code == "TOO_MANY_OPTIONS" for vi in v.violations)


# ── NON_VERBAL ───────────────────────────────────────────────────────


class TestNonVerbal:
    def test_rejects_long_stem(self):
        item = _mc(
            "This is a fairly long stem that no non-verbal learner can read.",
            [("a", "🍎"), ("b", "🍌")],
        )
        v = evaluate_item(item, "NON_VERBAL")
        assert any(vi.code == "STEM_TOO_LONG" for vi in v.violations)

    def test_caps_options_at_2(self):
        item = _mc("?", [("a", "🍎"), ("b", "🍌"), ("c", "🥕")])
        v = evaluate_item(item, "NON_VERBAL")
        assert any(vi.code == "TOO_MANY_OPTIONS" for vi in v.violations)

    def test_passes_picture_only_2_options(self):
        item = _mc("?", [("a", "🍎"), ("b", "🍌")])
        v = evaluate_item(item, "NON_VERBAL")
        assert v.ok, v.violations


# ── PRE_SYMBOLIC ─────────────────────────────────────────────────────


class TestPreSymbolic:
    def test_rejects_any_mc_item(self):
        item = _mc("?", [("a", "🍎"), ("b", "🍌")])
        v = evaluate_item(item, "PRE_SYMBOLIC")
        assert not v.ok
        assert any(vi.code == "PRE_SYMBOLIC_REJECTS_MC" for vi in v.violations)

    def test_observation_payload_covers_7_subjects(self):
        payload = build_pre_symbolic_observation_payload(learner_id="lr-1")
        assert payload["source"] == "pre_symbolic_observation"
        assert payload["learnerId"] == "lr-1"
        subjects = {q["subject"] for q in payload["questions"]}
        assert subjects == {
            "math", "ela", "science", "speech",
            "sel", "life_skills", "executive_function",
        }
        for q in payload["questions"]:
            assert q["interactionType"] == "observation_checklist"
            assert q["functioningLevelTag"] == "PRE_SYMBOLIC"
            assert q["correctAnswer"] == "emerging"
            # Options are the same Likert anchors across every prompt.
            values = {o["value"] for o in q["options"]}
            assert values == {"yes", "emerging", "not_yet"}


# ── enforce_batch ────────────────────────────────────────────────────


class TestEnforceBatch:
    def test_separates_allowed_and_rejected(self):
        items = [
            _mc("Short", [("a", "🍎"), ("b", "🍌")], qid="ok"),
            _mc("X" * 400, [("a", "🍎"), ("b", "🍌")], qid="too-long"),
        ]
        allowed, rejected = enforce_batch(items, "NON_VERBAL")
        assert [q["id"] for q in allowed] == ["ok"]
        assert [q["id"] for q in rejected] == ["too-long"]
        assert rejected[0]["_scaffoldViolations"]

    def test_unknown_level_falls_back_to_standard(self):
        items = [_mc("anything", [("a", "X"), ("b", "Y"), ("c", "Z"), ("d", "W")])]
        allowed, rejected = enforce_batch(items, "BIZARRE")
        assert len(allowed) == 1
        assert len(rejected) == 0

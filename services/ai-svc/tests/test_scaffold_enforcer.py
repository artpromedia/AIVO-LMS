"""Sprint 5 — functioning-level scaffold enforcement tests.

Pins down the per-level shape contract: STANDARD permits anything,
SUPPORTED / LOW_VERBAL / NON_VERBAL get progressively stricter, and
PRE_SYMBOLIC short-circuits the MC flow entirely with an observation
checklist.
"""

from __future__ import annotations

import pytest

from ai_svc.services.scaffold_enforcer import (
    FUNCTIONING_LEVELS,
    RULES,
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


# ── choice-count invariant (Task #9 regression guard) ────────────────
#
# Answer choices are intentionally NOT sliced at render time (the client
# question shape has no correct-answer field, so trimming could drop the
# correct option). The only thing standing between the LLM and a baseline
# that shows too many choices — or a multiple-choice item to a
# PRE_SYMBOLIC learner — is this enforcement layer. These tests pin the
# per-functioning-level cap so a future generator change can't silently
# raise it (or remove the PRE_SYMBOLIC short-circuit) without a test
# failing in CI.


# The authoritative per-level *server safety ceiling* — the value above
# which the enforcer rejects an item outright. This is intentionally
# looser than (and distinct from) the learner-facing render cap in
# packages/learner-ui/src/tokens/fl-profiles.ts (5/3/2/2/2): the enforcer
# is a guardrail against malformed LLM output, not the render budget. See
# BASELINE-SPEC.md → "Two caps, one direction" for the generator-target ≤
# render-cap ≤ server-reject-above invariant. Choices shrink as support
# increases, and PRE_SYMBOLIC has no MC at all.
EXPECTED_MAX_CHOICES = {
    "STANDARD": 10,
    "SUPPORTED": 4,
    "LOW_VERBAL": 3,
    "NON_VERBAL": 2,
    "PRE_SYMBOLIC": 0,
}

# Picture-glyph labels so the LOW_VERBAL / NON_VERBAL "requires emoji"
# rule never interferes with a pure option-count assertion. Long enough
# to build an over-cap item for every level.
_GLYPHS = ["🍎", "🍌", "🥕", "🌿", "⭐", "🔵", "🟢", "🟣", "🔺", "🔶", "💛", "🧡", "💙", "💜"]


def _item_with_n_options(n: int, *, qid: str) -> dict:
    """A short-stemmed picture-choice item carrying exactly ``n`` options."""
    opts = [{"value": f"o{i}", "label": _GLYPHS[i]} for i in range(n)]
    return {
        "id": qid,
        "subject": "math",
        "questionText": "?",
        "options": opts,
        "correctAnswer": opts[0]["value"] if opts else None,
    }


class TestChoiceCountInvariant:
    def test_every_functioning_level_has_a_pinned_cap(self):
        # If a new functioning level is added (or one is renamed/removed),
        # this fails so the cap table here is kept in lockstep with the
        # enforcer's RULES — no level may ship without an explicit cap.
        assert set(RULES) == set(FUNCTIONING_LEVELS) == set(EXPECTED_MAX_CHOICES)

    @pytest.mark.parametrize("level,cap", sorted(EXPECTED_MAX_CHOICES.items()))
    def test_rule_cap_matches_spec(self, level, cap):
        # Pin the actual enforced cap. A generator change that bumps
        # max_options for any level fails here.
        assert RULES[level].max_options == cap

    @pytest.mark.parametrize(
        "level", ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL"]
    )
    def test_allowed_items_never_exceed_cap(self, level):
        cap = EXPECTED_MAX_CHOICES[level]
        # Feed items with 1 .. cap+3 options; nothing that survives
        # enforcement may carry more options than the cap.
        items = [
            _item_with_n_options(n, qid=f"{level}-{n}")
            for n in range(1, cap + 4)
        ]
        allowed, rejected = enforce_batch(items, level)

        assert allowed, "at least the at-cap items should survive"
        for q in allowed:
            assert len(q["options"]) <= cap, (
                f"{level} leaked {len(q['options'])} options (cap {cap})"
            )
        # Conversely, every over-cap item must be rejected for that reason.
        for q in rejected:
            if len(q["options"]) > cap:
                codes = [v["code"] for v in q["_scaffoldViolations"]]
                assert "TOO_MANY_OPTIONS" in codes

    def test_pre_symbolic_yields_no_multiple_choice(self):
        # No matter how few options an MC item has, PRE_SYMBOLIC must
        # reject every one — these learners only ever get the observation
        # checklist, never a tap-to-choose question.
        items = [
            _item_with_n_options(1, qid="ps-1"),
            _item_with_n_options(2, qid="ps-2"),
            _mc("?", [("a", "🍎"), ("b", "🍌")], qid="ps-mc"),
        ]
        allowed, rejected = enforce_batch(items, "PRE_SYMBOLIC")
        assert allowed == []
        assert len(rejected) == len(items)
        for q in rejected:
            codes = [v["code"] for v in q["_scaffoldViolations"]]
            assert "PRE_SYMBOLIC_REJECTS_MC" in codes

    def test_pre_symbolic_observation_payload_is_not_scored_mc(self):
        # The substitute payload is an observation checklist, never a
        # scored multiple-choice baseline.
        payload = build_pre_symbolic_observation_payload()
        assert payload["source"] == "pre_symbolic_observation"
        for q in payload["questions"]:
            assert q["interactionType"] == "observation_checklist"
            assert q["difficulty"] == "observation"

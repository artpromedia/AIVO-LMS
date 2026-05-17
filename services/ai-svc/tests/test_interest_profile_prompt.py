"""Tests for the special-interest piping in the baseline generator.

Run with: pytest services/ai-svc/tests/test_interest_profile_prompt.py -v

Strategic backdrop: most platforms treat learners' deep, focused
interests as distractions to overcome. Treating them as the *engine*
that drives content generation is the whole point of these prompts —
math word problems set in Minecraft, reading passages about volcanoes,
science questions tied to their obsession. These tests lock in that
the persisted scored interests reach the prompt and re-frame rule #4 /
#3 from "incorporate when possible" to "build around as the engine".
"""
from ai_svc.services.baseline_generator import (
    build_baseline_generation_prompt,
    build_discovery_adventure_prompt,
)


PARENT = {
    "communicationMode": "verbal",
    "deviceInteraction": "independent",
    "functioningLevel": "STANDARD",
    "attentionSpan": "typical",
    "diagnoses": [],
    "responses": {"pref-1": ["soccer"]},  # legacy intake list
}

CHAPTER = {
    "title": "Word Garden",
    "domain": "ela",
    "sceneDescription": "...",
    "tutorKey": "sage",
}


class TestDiscoveryAdventureInterestProfile:
    def test_no_interest_profile_keeps_original_rule(self):
        sys, _ = build_discovery_adventure_prompt(PARENT, CHAPTER)
        assert "incorporate the learner's interests" in sys

    def test_top_interest_promotes_to_primary_theme_rule(self):
        ip = {"topInterests": [{"slug": "minecraft", "score": 0.92}]}
        sys, user = build_discovery_adventure_prompt(
            PARENT, CHAPTER, interest_profile=ip
        )
        # Rule #3 is rewritten when a primary theme is present.
        assert 'Build the activity AROUND "minecraft"' in sys
        assert "engine, not a sprinkle" in sys
        # Original "incorporate when possible" line is gone.
        assert "incorporate the learner's interests" not in sys
        # User prompt's `Personalize themes using learner interests` line
        # surfaces minecraft ahead of the legacy soccer interest.
        assert "minecraft" in user
        assert user.index("minecraft") < user.index("soccer")

    def test_multiple_scored_interests_are_merged_with_legacy(self):
        ip = {
            "topInterests": [
                {"slug": "trains", "score": 0.8},
                {"slug": "volcanoes", "score": 0.6},
            ]
        }
        sys, _ = build_discovery_adventure_prompt(PARENT, CHAPTER, interest_profile=ip)
        # Primary theme is the highest-scored one.
        assert 'Build the activity AROUND "trains"' in sys
        assert "trains" in sys
        assert "volcanoes" in sys
        # Legacy soccer is still listed (merge, not replace).
        assert "soccer" in sys

    def test_malformed_interest_profile_is_ignored(self):
        sys, _ = build_discovery_adventure_prompt(
            PARENT, CHAPTER, interest_profile={"topInterests": "garbage"}
        )
        assert "incorporate the learner's interests" in sys

    def test_empty_top_interests_list_is_ignored(self):
        sys, _ = build_discovery_adventure_prompt(
            PARENT, CHAPTER, interest_profile={"topInterests": []}
        )
        assert "incorporate the learner's interests" in sys


class TestBaselineGenerationInterestProfile:
    def test_top_interest_rewrites_rule_4(self):
        ip = {"topInterests": [{"slug": "dinosaurs", "score": 0.95}]}
        sys, _ = build_baseline_generation_prompt(PARENT, interest_profile=ip)
        assert 'Build questions AROUND "dinosaurs"' in sys
        assert "engine, not as a sprinkle" in sys
        # The legacy "incorporate ... when possible" line is replaced.
        assert "(e.g., if they like animals" not in sys

    def test_no_interest_profile_keeps_legacy_rule(self):
        sys, _ = build_baseline_generation_prompt(PARENT)
        assert "(e.g., if they like animals" in sys

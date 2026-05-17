"""Stub tests for the Speech Buddy foundations scaffold.

The agent-core task replaces these with real behavioural tests. For now we
just confirm the public surface exports the expected names so downstream
imports stay stable.
"""

from ai_svc.speech_buddy import (
    AGE_BANDS,
    SAFETY_FLAG_CATEGORIES,
    SKILL_TAGS,
    SPEECH_BUDDY_STATES,
    SpeechBuddyOrchestrator,
    SpeechBuddyToolset,
)


def test_age_bands_match_docs():
    assert AGE_BANDS == ("6-9", "10-12", "13-15")


def test_skill_tags_are_stable():
    # Spot-check a handful — the docs/products/speech-buddy/README.md SEL skill
    # map is the source of truth; this guards against accidental renames.
    for tag in (
        "name_a_feeling",
        "ask_open_question",
        "repair_a_rupture",
        "consider_consequences",
    ):
        assert tag in SKILL_TAGS


def test_safety_flag_categories_cover_policy():
    for cat in (
        "self_harm",
        "abuse_disclosure",
        "romantic_sexual",
        "violence",
        "medical_advice",
        "pii",
        "jailbreak",
    ):
        assert cat in SAFETY_FLAG_CATEGORIES


def test_state_machine_has_all_six_vertices():
    assert SPEECH_BUDDY_STATES == (
        "greet",
        "pickScenario",
        "roleplayTurn",
        "reflect",
        "assignQuest",
        "farewell",
    )


def test_protocols_are_importable():
    # Protocols don't have a runtime body; this just guards the import path
    # so `from ai_svc.speech_buddy import ...` stays valid for downstream code.
    assert SpeechBuddyOrchestrator is not None
    assert SpeechBuddyToolset is not None

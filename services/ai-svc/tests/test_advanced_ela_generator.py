"""Tests for the advanced ELA activity generator."""

from __future__ import annotations

from ai_svc.services.advanced_content_generators import generate_ela_activity


def test_reading_topic_emits_annotation_surface():
    activity = generate_ela_activity(
        topic="reading comprehension",
        subject_brain_context={},
    )
    surface_types = [surface["type"] for surface in activity["surfaces"]]
    assert "reading_annotation" in surface_types


def test_low_verbal_profile_reduces_text_density():
    activity = generate_ela_activity(
        topic="reading comprehension",
        subject_brain_context={},
        functioning_level="LOW_VERBAL",
    )
    assert activity["textDensity"] == "reduced"
    assert any(
        "text" in adaptation.lower() or "chunk" in adaptation.lower()
        for adaptation in activity["profileAdaptations"]
    )


def test_writing_topic_emits_multi_step_workspace():
    activity = generate_ela_activity(
        topic="writing scaffold",
        subject_brain_context={},
    )
    surface_types = [surface["type"] for surface in activity["surfaces"]]
    assert "multi_step_workspace" in surface_types

"""Tests for the advanced science activity generator."""

from __future__ import annotations

from ai_svc.services.advanced_content_generators import generate_science_activity


def test_sequencing_topic_emits_science_diagram():
    activity = generate_science_activity(
        topic="water cycle sequence",
        subject_brain_context={},
    )
    surface_types = [surface["type"] for surface in activity["surfaces"]]
    assert "science_diagram" in surface_types


def test_classification_topic_emits_drag_manipulative():
    activity = generate_science_activity(
        topic="classify living things",
        subject_brain_context={},
    )
    surface_types = [surface["type"] for surface in activity["surfaces"]]
    assert "drag_manipulative" in surface_types


def test_observation_topic_emits_annotation_surface():
    activity = generate_science_activity(
        topic="observation vs inference",
        subject_brain_context={},
    )
    surface_types = [surface["type"] for surface in activity["surfaces"]]
    assert "reading_annotation" in surface_types


def test_evidence_used_includes_relevant_skills():
    activity = generate_science_activity(
        topic="water cycle",
        subject_brain_context={"relevantSkills": ["SCI.CYCLE.WATER"]},
    )
    assert activity["subjectBrainEvidenceUsed"]["relevantSkills"] == ["SCI.CYCLE.WATER"]

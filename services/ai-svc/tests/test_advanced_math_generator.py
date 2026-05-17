"""Tests for the advanced math activity generator."""

from __future__ import annotations

from ai_svc.services.advanced_content_generators import generate_math_activity


def test_area_topic_emits_geometry_workspace():
    activity = generate_math_activity(
        topic="area of a rectangle",
        subject_brain_context={
            "relevantSkills": ["MATH.GEOM.AREA"],
            "recommendedScaffolds": ["Model one similar step first."],
        },
    )
    surface_types = [surface["type"] for surface in activity["surfaces"]]
    assert "geometry_workspace" in surface_types
    assert activity["subjectBrainEvidenceUsed"]["relevantSkills"] == ["MATH.GEOM.AREA"]


def test_computation_topic_emits_scratchpad():
    activity = generate_math_activity(
        topic="multi-digit subtraction",
        subject_brain_context={},
    )
    surface_types = [surface["type"] for surface in activity["surfaces"]]
    assert "scratchpad" in surface_types


def test_fractions_topic_emits_number_line():
    activity = generate_math_activity(
        topic="fractions on a number line",
        subject_brain_context={},
    )
    surface_types = [surface["type"] for surface in activity["surfaces"]]
    assert "number_line" in surface_types


def test_low_verbal_profile_adds_reduced_text_adaptation():
    activity = generate_math_activity(
        topic="area",
        subject_brain_context={"profileAdaptations": []},
        functioning_level="LOW_VERBAL",
    )
    assert any("text" in adaptation.lower() for adaptation in activity["profileAdaptations"])


def test_evidence_used_includes_misconception_ids():
    activity = generate_math_activity(
        topic="area",
        subject_brain_context={
            "misconceptionRisks": [{"id": "perimeter_for_area", "label": "x", "intervention": "y"}],
        },
    )
    assert "perimeter_for_area" in activity["subjectBrainEvidenceUsed"]["misconceptionRisks"]

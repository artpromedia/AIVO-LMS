"""Tests for the AI-service `surface_schema` validator.

The validator is the last line of defence inside ai-svc before
generated content is returned to assessment-svc.
"""

from ai_svc.services.surface_schema import (
    validate_discovery_activity,
    validate_discovery_chapter_payload,
)


def _valid_geometry() -> dict:
    return {
        "id": "math_geometry_area_rectangle_01",
        "domain": "math",
        "difficulty": "medium",
        "interaction": "geometry_workspace",
        "prompt": "Find the area of the rectangle.",
        "feedbackMode": "delayed_after_item",
        "brainMeasures": ["geometry_reasoning", "scratchpad_use"],
        "scoring": {"mode": "exact", "correctAnswer": 32},
        "surface": {
            "id": "surf-geo-1",
            "type": "geometry_workspace",
            "prompt": "Find the area of the rectangle.",
            "diagram": {
                "canvasMode": "svg",
                "shapes": [
                    {"id": "rect1", "kind": "rectangle", "x": 0, "y": 0, "width": 320, "height": 180}
                ],
            },
            "capture": {"finalAnswer": True, "inkStrokes": True},
            "scoring": {"mode": "exact", "correctAnswer": 32},
            "accessibility": {
                "altText": "A rectangle labeled 8 cm by 4 cm",
                "reduceMotionSafe": True,
                "keyboardAlternative": True,
            },
        },
    }


def test_validate_accepts_complete_geometry():
    ok, errors = validate_discovery_activity(_valid_geometry())
    assert ok, errors
    assert errors == []


def test_validate_rejects_geometry_without_alt_text():
    activity = _valid_geometry()
    activity["surface"]["accessibility"]["altText"] = ""
    ok, errors = validate_discovery_activity(activity)
    assert not ok
    assert "surface_missing_alt_text" in errors


def test_validate_rejects_geometry_without_shapes():
    activity = _valid_geometry()
    activity["surface"]["diagram"]["shapes"] = []
    ok, errors = validate_discovery_activity(activity)
    assert not ok
    assert "geometry_missing_shapes" in errors


def test_validate_rejects_draw_without_ink_capture():
    activity = {
        "id": "draw1",
        "domain": "math",
        "difficulty": "easy",
        "interaction": "draw",
        "prompt": "Draw it",
        "feedbackMode": "delayed_after_item",
        "brainMeasures": ["fine_motor"],
        "scoring": {"mode": "process"},
        "surface": {
            "id": "s1",
            "type": "scratchpad",
            "prompt": "Draw it",
            "capture": {"finalAnswer": True, "inkStrokes": False},
            "scoring": {"mode": "process"},
            "accessibility": {
                "altText": "blank surface",
                "reduceMotionSafe": True,
                "keyboardAlternative": True,
            },
        },
    }
    ok, errors = validate_discovery_activity(activity)
    assert not ok
    assert "surface_missing_ink_capture" in errors


def test_chapter_payload_partitions_valid_and_rejected():
    payload = {
        "easy": [_valid_geometry()],
        "medium": [{"id": "broken", "domain": "math"}],
        "hard": [],
    }
    result = validate_discovery_chapter_payload(payload)
    assert len(result["activities"]["easy"]) == 1
    assert len(result["activities"]["medium"]) == 0
    assert len(result["rejected_activities"]) == 1
    assert result["rejected_activities"][0]["reason"].startswith("medium:")
    assert result["personalization_level"] == "partial"


def test_chapter_payload_returns_none_personalization_when_all_invalid():
    payload = {"easy": [{"id": "x"}], "medium": [], "hard": []}
    result = validate_discovery_chapter_payload(payload)
    assert result["personalization_level"] == "none"

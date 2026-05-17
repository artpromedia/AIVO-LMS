"""Tests for the tutor surface directive validator."""

from __future__ import annotations

from ai_svc.services.surface_directives import (
    validate_tutor_surface_command,
    validate_tutor_surface_commands,
)


def _geometry_command() -> dict:
    return {
        "id": "cmd-geo-1",
        "commandType": "show_geometry",
        "surfaceId": "surf-geo-1",
        "reason": "Compute area of the rectangle.",
        "expectedLearnerAction": "find_area",
        "surface": {
            "id": "surf-geo-1",
            "type": "geometry_workspace",
            "prompt": "Find the area of the rectangle.",
            "accessibility": {
                "altText": "A rectangle labeled 8 cm by 4 cm.",
                "reduceMotionSafe": True,
                "keyboardAlternative": True,
            },
            "diagram": {
                "shapes": [{"id": "r1", "kind": "rectangle", "width": 8, "height": 4}],
            },
            "scratchpad": {"enabled": True},
        },
    }


def _scratchpad_command(**overrides) -> dict:
    command = {
        "id": "cmd-sc-1",
        "commandType": "open_scratchpad",
        "surfaceId": "surf-sc-1",
        "reason": "Show your work.",
        "expectedLearnerAction": "show_work",
        "surface": {
            "id": "surf-sc-1",
            "type": "scratchpad",
            "prompt": "Use the scratchpad to add 12 + 13.",
            "accessibility": {
                "altText": "Blank scratchpad",
                "reduceMotionSafe": True,
                "keyboardAlternative": True,
            },
            "scratchpad": {"enabled": True},
        },
    }
    command.update(overrides)
    return command


def test_valid_geometry_command_passes():
    ok, errors = validate_tutor_surface_command(_geometry_command())
    assert ok
    assert errors == []


def test_missing_command_id_fails():
    command = _scratchpad_command()
    command["id"] = ""
    ok, errors = validate_tutor_surface_command(command)
    assert not ok
    assert "missing_command_id" in errors


def test_missing_surface_id_fails():
    command = _scratchpad_command()
    command["surfaceId"] = ""
    ok, errors = validate_tutor_surface_command(command)
    assert not ok
    assert "missing_surface_id" in errors


def test_unsupported_command_type_rejected():
    command = _scratchpad_command()
    command["commandType"] = "open_holodeck"
    ok, errors = validate_tutor_surface_command(command)
    assert not ok
    assert any(err.startswith("unsupported_command_type") for err in errors)


def test_geometry_without_shapes_fails():
    command = _geometry_command()
    command["surface"]["diagram"]["shapes"] = []
    ok, errors = validate_tutor_surface_command(command)
    assert not ok
    assert "geometry_without_shapes" in errors


def test_scratchpad_without_ink_capture_fails():
    command = _scratchpad_command()
    command["surface"]["scratchpad"]["enabled"] = False
    ok, errors = validate_tutor_surface_command(command)
    assert not ok
    assert "scratchpad_without_ink_capture" in errors


def test_raw_html_rejected():
    command = _scratchpad_command()
    command["reason"] = "Use <b>scratchpad</b>"
    ok, errors = validate_tutor_surface_command(command)
    assert not ok
    assert any(err.startswith("unsafe_markup") for err in errors)


def test_raw_svg_rejected():
    command = _scratchpad_command()
    command["surface"]["prompt"] = "<svg><rect /></svg>"
    ok, errors = validate_tutor_surface_command(command)
    assert not ok
    assert any(err.startswith("unsafe_markup") for err in errors)


def test_missing_alt_text_fails():
    command = _scratchpad_command()
    command["surface"]["accessibility"]["altText"] = ""
    ok, errors = validate_tutor_surface_command(command)
    assert not ok
    assert "missing_alt_text" in errors


def test_non_verbal_blocks_speech_required_command():
    command = _scratchpad_command()
    command["commandType"] = "collect_answer"
    ok, errors = validate_tutor_surface_command(
        command, {"functioningLevel": "NON_VERBAL", "speechAvailable": False}
    )
    assert not ok
    assert "speech_required_for_non_verbal" in errors


def test_low_verbal_blocks_long_typed_response():
    command = _scratchpad_command(expectedLearnerAction="type_long_response")
    ok, errors = validate_tutor_surface_command(command, {"functioningLevel": "LOW_VERBAL"})
    assert not ok
    assert "long_text_for_low_verbal" in errors


def test_duplicate_command_ids_flagged_in_batch():
    a = _scratchpad_command()
    b = _scratchpad_command()
    ok, errors = validate_tutor_surface_commands([a, b])
    assert not ok
    assert any(err.startswith("duplicate_command_id") for err in errors)

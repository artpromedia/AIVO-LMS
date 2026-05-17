"""Validation helpers for tutor surface command directives.

This module mirrors the TypeScript ``@aivo/tutor-surface-protocol`` validator.
When the AI tutor emits structured surface commands (open_scratchpad,
show_geometry, show_graph, show_number_line, show_manipulative,
show_reading_annotation, show_science_diagram, collect_answer,
collect_drawing, highlight_object, update_label, save_snapshot) we validate
the payload here before it leaves the prompt-orchestration path.

Rules enforced:
    * Each command must include id, commandType, surfaceId, reason.
    * commandType must be from the supported set.
    * Surface specs require accessibility.altText and keyboard alternative.
    * Geometry surfaces must include at least one shape.
    * Scratchpad / collect_drawing commands must enable ink capture.
    * Raw HTML, SVG, or script content is rejected outright.
    * Speech-required commands are rejected for NON_VERBAL learners.
    * Long typed responses are rejected for LOW_VERBAL/PRE_SYMBOLIC learners.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

SUPPORTED_COMMAND_TYPES: frozenset[str] = frozenset(
    {
        "open_scratchpad",
        "show_geometry",
        "show_graph",
        "show_number_line",
        "show_manipulative",
        "show_reading_annotation",
        "show_science_diagram",
        "collect_answer",
        "collect_drawing",
        "highlight_object",
        "update_label",
        "save_snapshot",
    }
)

SUPPORTED_SURFACE_TYPES: frozenset[str] = frozenset(
    {
        "scratchpad",
        "geometry_workspace",
        "graph",
        "number_line",
        "drag_manipulative",
        "reading_annotation",
        "science_diagram",
        "choice_grid",
        "math_expression",
        "voice_response",
        "multi_step_workspace",
    }
)

SURFACE_REQUIRING_COMMAND_TYPES: frozenset[str] = frozenset(
    {
        "open_scratchpad",
        "show_geometry",
        "show_graph",
        "show_number_line",
        "show_manipulative",
        "show_reading_annotation",
        "show_science_diagram",
    }
)

SPEECH_REQUIRED_COMMAND_TYPES: frozenset[str] = frozenset({"collect_answer"})

RAW_HTML_PATTERN = re.compile(r"<\s*[a-z!][^>]*>", re.IGNORECASE)
RAW_SVG_PATTERN = re.compile(r"<\s*svg\b", re.IGNORECASE)
RAW_SCRIPT_PATTERN = re.compile(r"<\s*script\b", re.IGNORECASE)


def _contains_unsafe_markup(value: str) -> bool:
    return bool(
        RAW_HTML_PATTERN.search(value)
        or RAW_SVG_PATTERN.search(value)
        or RAW_SCRIPT_PATTERN.search(value)
    )


def _scan_text(value: Any, path: str, errors: list[str]) -> None:
    if isinstance(value, str):
        if _contains_unsafe_markup(value):
            errors.append(f"unsafe_markup:{path}")
        return
    if isinstance(value, list):
        for idx, item in enumerate(value):
            _scan_text(item, f"{path}[{idx}]", errors)
        return
    if isinstance(value, dict):
        for key, nested in value.items():
            _scan_text(nested, f"{path}.{key}", errors)


def _validate_surface(
    surface: dict[str, Any] | None,
    command_type: str,
    errors: list[str],
) -> None:
    if surface is None:
        if command_type in SURFACE_REQUIRING_COMMAND_TYPES:
            errors.append("missing_surface_spec")
        return
    if not surface.get("id"):
        errors.append("missing_surface_id")
    surface_type = surface.get("type")
    if surface_type not in SUPPORTED_SURFACE_TYPES:
        errors.append(f"unsupported_surface_type:{surface_type}")
    accessibility = surface.get("accessibility") or {}
    alt_text = accessibility.get("altText")
    if not isinstance(alt_text, str) or not alt_text.strip():
        errors.append("missing_alt_text")
    if accessibility.get("keyboardAlternative") is False:
        errors.append("missing_keyboard_alternative")
    if command_type == "show_geometry":
        shapes = (surface.get("diagram") or {}).get("shapes") or []
        if not isinstance(shapes, list) or len(shapes) == 0:
            errors.append("geometry_without_shapes")
    if command_type in {"open_scratchpad", "collect_drawing"}:
        scratchpad = surface.get("scratchpad") or {}
        if scratchpad.get("enabled") is False or "enabled" not in scratchpad:
            errors.append("scratchpad_without_ink_capture")


def _validate_profile(
    command: dict[str, Any],
    profile: dict[str, Any] | None,
    errors: list[str],
) -> None:
    if profile is None:
        return
    command_type = command.get("commandType")
    if (
        command_type in SPEECH_REQUIRED_COMMAND_TYPES
        and profile.get("functioningLevel") == "NON_VERBAL"
        and profile.get("speechAvailable") is not True
    ):
        errors.append("speech_required_for_non_verbal")
    long_expected = command.get("expectedLearnerAction") in {
        "type_long_response",
        "essay",
    }
    if long_expected and profile.get("functioningLevel") in {"LOW_VERBAL", "PRE_SYMBOLIC"}:
        errors.append("long_text_for_low_verbal")


def validate_tutor_surface_command(
    command: Any,
    profile: dict[str, Any] | None = None,
) -> tuple[bool, list[str]]:
    """Return ``(ok, errors)`` for a single tutor surface command."""

    errors: list[str] = []
    if not isinstance(command, dict):
        return False, ["invalid_command"]
    if not command.get("id"):
        errors.append("missing_command_id")
    if not command.get("surfaceId"):
        errors.append("missing_surface_id")
    reason = command.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        errors.append("missing_reason")
    command_type = command.get("commandType")
    if command_type not in SUPPORTED_COMMAND_TYPES:
        errors.append(f"unsupported_command_type:{command_type}")

    for key in ("reason", "expectedLearnerAction", "profileAdaptationRationale"):
        _scan_text(command.get(key), key, errors)
    _scan_text(command.get("commandPayload"), "commandPayload", errors)
    surface = command.get("surface")
    if isinstance(surface, dict):
        _scan_text(surface.get("prompt"), "surface.prompt", errors)
        _scan_text(surface.get("instructions"), "surface.instructions", errors)
        _scan_text(
            (surface.get("accessibility") or {}).get("altText"),
            "surface.accessibility.altText",
            errors,
        )

    _validate_surface(surface, command_type or "", errors)
    _validate_profile(command, profile, errors)

    return len(errors) == 0, errors


def validate_tutor_surface_commands(
    commands: Iterable[Any],
    profile: dict[str, Any] | None = None,
) -> tuple[bool, list[str]]:
    """Return ``(ok, errors)`` for an iterable of tutor surface commands."""

    errors: list[str] = []
    seen_ids: set[str] = set()
    for command in commands:
        if isinstance(command, dict) and isinstance(command.get("id"), str):
            cid = command["id"]
            if cid in seen_ids:
                errors.append(f"duplicate_command_id:{cid}")
            seen_ids.add(cid)
        _, command_errors = validate_tutor_surface_command(command, profile)
        errors.extend(command_errors)
    return len(errors) == 0, errors

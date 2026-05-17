"""Validation helpers for AI-generated learner-surface activity payloads.

Mirrors the contract enforced server-side by
`services/assessment-svc/src/services/discovery-activity-validator.ts`
and the runtime guard in
`apps/web/src/components/discovery/activity-schema.ts`.

We deliberately avoid pulling in extra dependencies; the ai-svc
already uses Pydantic, but this module ships as plain Python so it can
be re-used by the synchronous LLM-output post-processing path without
reaching for response models.
"""

from __future__ import annotations

from typing import Any, Iterable

KNOWN_INTERACTIONS: frozenset[str] = frozenset(
    {
        "choice_grid",
        "tap_image",
        "tap_word",
        "drag_sort",
        "drag_place",
        "sequence",
        "pattern_fill",
        "memory",
        "memory_sequence",
        "observation",
        "emotion_pick",
        "draw",
        "scratchpad",
        "geometry_workspace",
        "math_expression",
        "voice_response",
        "reading_annotation",
        "science_diagram",
    }
)

SURFACE_REQUIRED: frozenset[str] = frozenset(
    {
        "draw",
        "scratchpad",
        "geometry_workspace",
        "math_expression",
        "reading_annotation",
        "science_diagram",
    }
)

KNOWN_FEEDBACK_MODES: frozenset[str] = frozenset(
    {
        "immediate_supportive",
        "delayed_after_item",
        "delayed_after_block",
        "no_correctness_feedback_diagnostic",
    }
)

KNOWN_SCORING_MODES: frozenset[str] = frozenset({"exact", "rubric", "process", "hybrid"})


def validate_discovery_activity(activity: Any) -> tuple[bool, list[str]]:
    """Return (ok, errors) for a single activity dict."""
    errors: list[str] = []
    if not isinstance(activity, dict):
        return False, ["not_object"]

    if not isinstance(activity.get("id"), str) or not activity.get("id"):
        errors.append("missing_id")
    if not isinstance(activity.get("domain"), str) or not activity.get("domain"):
        errors.append("missing_domain")
    if "difficulty" not in activity:
        errors.append("missing_difficulty")

    interaction = activity.get("interaction")
    if interaction not in KNOWN_INTERACTIONS:
        errors.append(f"unsupported_interaction:{interaction}")

    if not isinstance(activity.get("prompt"), str) or not activity.get("prompt"):
        errors.append("missing_prompt")

    feedback_mode = activity.get("feedbackMode")
    if feedback_mode is not None and feedback_mode not in KNOWN_FEEDBACK_MODES:
        errors.append(f"unsupported_feedback_mode:{feedback_mode}")

    if not isinstance(activity.get("brainMeasures"), list):
        errors.append("missing_brain_measures")

    scoring = activity.get("scoring")
    if not isinstance(scoring, dict):
        errors.append("missing_scoring")
    elif scoring.get("mode") not in KNOWN_SCORING_MODES:
        errors.append(f"unsupported_scoring_mode:{scoring.get('mode')}")

    if interaction in SURFACE_REQUIRED:
        surface = activity.get("surface")
        if not isinstance(surface, dict):
            errors.append(f"{interaction}_requires_surface")
        else:
            accessibility = surface.get("accessibility") or {}
            if not accessibility.get("altText"):
                errors.append("surface_missing_alt_text")

            if interaction == "geometry_workspace":
                if surface.get("type") != "geometry_workspace":
                    errors.append("wrong_surface_type")
                diagram = surface.get("diagram") or {}
                shapes = diagram.get("shapes")
                if not isinstance(shapes, list) or not shapes:
                    errors.append("geometry_missing_shapes")

            if interaction in {"draw", "scratchpad"}:
                capture = surface.get("capture") or {}
                if capture.get("inkStrokes") is not True:
                    errors.append("surface_missing_ink_capture")

            surface_scoring = surface.get("scoring") or {}
            if surface_scoring.get("mode") not in KNOWN_SCORING_MODES:
                errors.append("surface_missing_scoring_mode")

    return (not errors, errors)


def _split_tier(items: Iterable[Any]) -> tuple[list[dict], list[dict]]:
    valid: list[dict] = []
    rejected: list[dict] = []
    for item in items or []:
        ok, errors = validate_discovery_activity(item)
        if ok:
            valid.append(item)
        else:
            rejected.append({"id": (item or {}).get("id") if isinstance(item, dict) else None, "reason": ",".join(errors)})
    return valid, rejected


def validate_discovery_chapter_payload(payload: Any) -> dict[str, Any]:
    """Validate a chapter-shaped payload (`{ easy: [...], medium: [...], hard: [...] }`).

    Returns a dict with the cleaned payload, rejected items, and the
    derived personalization level.
    """
    if not isinstance(payload, dict):
        return {
            "activities": {"easy": [], "medium": [], "hard": []},
            "rejected_activities": [{"id": None, "reason": "not_object"}],
            "personalization_level": "none",
        }

    cleaned: dict[str, list[dict]] = {"easy": [], "medium": [], "hard": []}
    rejected: list[dict] = []
    for tier in ("easy", "medium", "hard"):
        valid, rej = _split_tier(payload.get(tier) or [])
        cleaned[tier] = valid
        for r in rej:
            rejected.append({**r, "reason": f"{tier}:{r['reason']}"})

    total_valid = sum(len(items) for items in cleaned.values())
    if total_valid == 0:
        level = "none"
    elif rejected:
        level = "partial"
    else:
        level = "full"

    return {
        "activities": cleaned,
        "rejected_activities": rejected,
        "personalization_level": level,
    }

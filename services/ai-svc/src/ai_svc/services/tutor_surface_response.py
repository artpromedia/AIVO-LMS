"""Tutor Surface Response — Sprint 04.

Wraps :mod:`ai_svc.services.surface_directives` into a small response
shaping API used by tutor-svc's ``/api/tutor/:tutorKey/surface-beats``
route. The route hands raw tutor-LLM output (or, in the first cut, a
deterministic plan-derived command list) to
:func:`shape_tutor_surface_response`. The shaper:

* validates every command against the same rules as the TypeScript
  package (``packages/tutor-surface-protocol``),
* drops irrecoverable commands and records the reason,
* repairs simple omissions (missing ``accessibility.keyboardAlternative``
  defaults to ``True``, missing ``altText`` falls back to the command's
  ``reason``),
* returns a stable response envelope tutor-svc can pass straight to the
  web/mobile runtimes.

No LLM calls happen here. The orchestration layer is responsible for
producing the raw command stream; this module is the deterministic
gate it must pass through.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Optional

from .surface_directives import (
    SURFACE_REQUIRING_COMMAND_TYPES,
    SUPPORTED_SURFACE_TYPES,
    validate_tutor_surface_command,
)


HARD_ERROR_CODES: frozenset[str] = frozenset(
    {
        "invalid_command",
        "missing_command_id",
        "missing_surface_id",
        "missing_reason",
        "unsupported_command_type",
        "unsafe_markup",
        "speech_required_for_non_verbal",
        "long_text_for_low_verbal",
        "duplicate_command_id",
    }
)


@dataclass(frozen=True)
class ShapingIssue:
    code: str
    command_id: Optional[str] = None
    path: Optional[str] = None
    dropped: bool = False


@dataclass(frozen=True)
class ShapingResult:
    commands: tuple[dict, ...]
    issues: tuple[ShapingIssue, ...]
    total_received: int
    total_dropped: int


def _is_hard_error(code: str) -> bool:
    base = code.split(":", 1)[0]
    return base in HARD_ERROR_CODES


def _repair_command(raw: Any) -> Optional[dict]:
    if not isinstance(raw, dict):
        return None
    cid = raw.get("id")
    command_type = raw.get("commandType")
    surface_id = raw.get("surfaceId")
    reason = raw.get("reason")
    if not isinstance(cid, str) or not cid:
        return None
    if not isinstance(command_type, str) or not command_type:
        return None
    if not isinstance(surface_id, str) or not surface_id:
        return None
    if not isinstance(reason, str) or not reason.strip():
        return None

    repaired: dict[str, Any] = {
        "id": cid,
        "commandType": command_type,
        "surfaceId": surface_id,
        "reason": reason.strip(),
    }
    if isinstance(raw.get("expectedLearnerAction"), str):
        repaired["expectedLearnerAction"] = raw["expectedLearnerAction"]
    if isinstance(raw.get("profileAdaptationRationale"), str):
        repaired["profileAdaptationRationale"] = raw["profileAdaptationRationale"]
    if isinstance(raw.get("commandPayload"), dict):
        repaired["commandPayload"] = dict(raw["commandPayload"])

    surface = raw.get("surface")
    if isinstance(surface, dict):
        accessibility = dict(surface.get("accessibility") or {})
        alt_text = accessibility.get("altText")
        if not isinstance(alt_text, str) or not alt_text.strip():
            accessibility["altText"] = repaired["reason"]
        if accessibility.get("keyboardAlternative") is not False:
            accessibility["keyboardAlternative"] = True
        if accessibility.get("reduceMotionSafe") is not False:
            accessibility["reduceMotionSafe"] = True
        surface_type = surface.get("type")
        if surface_type not in SUPPORTED_SURFACE_TYPES:
            surface_type = "choice_grid"
        repaired["surface"] = {
            **{k: v for k, v in surface.items() if k not in {"accessibility", "type"}},
            "id": surface.get("id") if isinstance(surface.get("id"), str) else surface_id,
            "type": surface_type,
            "prompt": surface["prompt"] if isinstance(surface.get("prompt"), str) else repaired["reason"],
            "accessibility": accessibility,
        }
    elif command_type in SURFACE_REQUIRING_COMMAND_TYPES:
        # The command needs a surface but none was provided — give it a
        # minimum-viable surface so the validator can flag the missing
        # subject-specific fields rather than rejecting it on a generic
        # ``missing_surface_spec``.
        repaired["surface"] = {
            "id": surface_id,
            "type": "choice_grid",
            "prompt": repaired["reason"],
            "accessibility": {
                "altText": repaired["reason"],
                "keyboardAlternative": True,
                "reduceMotionSafe": True,
            },
        }
    return repaired


def _extract_commands(raw: Any) -> list[Any]:
    if isinstance(raw, list):
        return list(raw)
    if isinstance(raw, dict) and isinstance(raw.get("commands"), list):
        return list(raw["commands"])
    return []


def shape_tutor_surface_response(
    raw: Any,
    profile: Optional[Mapping[str, Any]] = None,
) -> ShapingResult:
    """Normalize and validate a raw tutor surface response.

    Parameters
    ----------
    raw:
        Either ``{"commands": [...]}`` or a bare list of command dicts.
    profile:
        Optional learner profile (``functioningLevel``,
        ``speechAvailable``, ``accommodations``). Drives speech and
        long-text restrictions.

    Returns
    -------
    ShapingResult
        Validated commands plus a per-issue trail.
    """
    profile_dict = dict(profile) if profile else None
    raw_commands = _extract_commands(raw)
    accepted: list[dict] = []
    issues: list[ShapingIssue] = []
    seen_ids: set[str] = set()
    dropped = 0

    for index, entry in enumerate(raw_commands):
        repaired = _repair_command(entry)
        if repaired is None:
            dropped += 1
            issues.append(
                ShapingIssue(
                    code="invalid_command",
                    path=f"commands[{index}]",
                    dropped=True,
                )
            )
            continue
        if repaired["id"] in seen_ids:
            dropped += 1
            issues.append(
                ShapingIssue(
                    code="duplicate_command_id",
                    command_id=repaired["id"],
                    path=f"commands[{index}].id",
                    dropped=True,
                )
            )
            continue

        ok, errors = validate_tutor_surface_command(repaired, profile_dict)
        if ok:
            accepted.append(repaired)
            seen_ids.add(repaired["id"])
            continue
        hard = any(_is_hard_error(code) for code in errors)
        if hard:
            dropped += 1
            for code in errors:
                issues.append(
                    ShapingIssue(
                        code=code,
                        command_id=repaired["id"],
                        path=f"commands[{index}]",
                        dropped=True,
                    )
                )
            continue
        accepted.append(repaired)
        seen_ids.add(repaired["id"])
        for code in errors:
            issues.append(
                ShapingIssue(
                    code=code,
                    command_id=repaired["id"],
                    path=f"commands[{index}]",
                    dropped=False,
                )
            )

    return ShapingResult(
        commands=tuple(accepted),
        issues=tuple(issues),
        total_received=len(raw_commands),
        total_dropped=dropped,
    )


def issues_to_dicts(issues: Iterable[ShapingIssue]) -> list[dict[str, Any]]:
    """Serialize shaping issues for JSON responses / structured logs."""
    out: list[dict[str, Any]] = []
    for iss in issues:
        entry: dict[str, Any] = {"code": iss.code, "dropped": iss.dropped}
        if iss.command_id is not None:
            entry["commandId"] = iss.command_id
        if iss.path is not None:
            entry["path"] = iss.path
        out.append(entry)
    return out


__all__ = [
    "HARD_ERROR_CODES",
    "ShapingIssue",
    "ShapingResult",
    "shape_tutor_surface_response",
    "issues_to_dicts",
]

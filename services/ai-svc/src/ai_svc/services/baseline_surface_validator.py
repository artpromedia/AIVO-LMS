"""Baseline surface validator.

Validates baseline assessment items produced by the LLM (or any other
source) against the surface contract. Items that fail validation are
*either* coerced to ``multiple_choice`` (when a fallback is safe) or
dropped — they never reach the runtime with a malformed surface.

Validation is intentionally cheap so it can run inline on every
generated batch without slowing the assessment loop.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .baseline_surface_contract import (
    ALL_SURFACE_KINDS,
    LearnerSurfaceSpec,
    SurfaceKind,
    coerce_surface,
)


@dataclass(frozen=True)
class ValidationIssue:
    item_id: str
    rule: str
    message: str
    severity: str  # "error" | "warning"


@dataclass(frozen=True)
class ValidationResult:
    item: dict[str, Any]
    issues: tuple[ValidationIssue, ...]
    accepted: bool

    @property
    def has_errors(self) -> bool:
        return any(i.severity == "error" for i in self.issues)


# ---------------------------------------------------------------------------
# Per-surface schema checks
# ---------------------------------------------------------------------------

_SCRATCHPAD_BOOL_KEYS = ("gridPaper", "allowSnapshots", "captureFinalAnswerField")

_GEOMETRY_VALID_TOOLS = {
    "point", "segment", "ray", "line", "angle", "compass", "ruler",
}
_GEOMETRY_VALID_TASKS = {"identify", "measure", "construct", "compare"}


def _validate_scratchpad(spec: LearnerSurfaceSpec) -> list[str]:
    issues: list[str] = []
    cfg = spec.get("config") or {}
    for k in _SCRATCHPAD_BOOL_KEYS:
        if k in cfg and not isinstance(cfg[k], bool):
            issues.append(f"scratchpad.config.{k} must be a boolean")
    return issues


def _validate_geometry(spec: LearnerSurfaceSpec) -> list[str]:
    issues: list[str] = []
    cfg = spec.get("config") or {}
    tools = cfg.get("tools")
    if tools is not None:
        if not isinstance(tools, list):
            issues.append("geometry_workspace.config.tools must be a list")
        else:
            bad = [t for t in tools if t not in _GEOMETRY_VALID_TOOLS]
            if bad:
                issues.append(f"geometry_workspace unknown tools: {bad}")
    task = cfg.get("task")
    if task is not None and task not in _GEOMETRY_VALID_TASKS:
        issues.append(f"geometry_workspace.config.task must be one of {_GEOMETRY_VALID_TASKS}")
    return issues


def _validate_text_response(spec: LearnerSurfaceSpec) -> list[str]:
    issues: list[str] = []
    cfg = spec.get("config") or {}
    if "maxChars" in cfg and not isinstance(cfg["maxChars"], int):
        issues.append("text_response.config.maxChars must be an int")
    return issues


_SURFACE_VALIDATORS = {
    "scratchpad": _validate_scratchpad,
    "geometry_workspace": _validate_geometry,
    "text_response": _validate_text_response,
}


# ---------------------------------------------------------------------------
# Item-level validation
# ---------------------------------------------------------------------------

def validate_item(item: dict[str, Any]) -> ValidationResult:
    """Validate a single baseline item.

    Mutates a copy of the input and returns the result. The original
    item is never modified.
    """

    out = dict(item)
    issues: list[ValidationIssue] = []
    item_id = str(out.get("id") or "<no-id>")

    raw_surface = out.get("surface")
    spec = coerce_surface(raw_surface)

    if spec is None:
        if raw_surface is None:
            # No surface declared — coerce to multiple_choice and warn.
            issues.append(
                ValidationIssue(
                    item_id=item_id,
                    rule="surface.missing",
                    message="item omitted `surface`; defaulting to multiple_choice",
                    severity="warning",
                )
            )
            spec = {"kind": "multiple_choice"}
        else:
            issues.append(
                ValidationIssue(
                    item_id=item_id,
                    rule="surface.unknown_kind",
                    message=(
                        "item declared a surface kind outside the contract; "
                        f"allowed = {list(ALL_SURFACE_KINDS)}"
                    ),
                    severity="error",
                )
            )
            return ValidationResult(item=out, issues=tuple(issues), accepted=False)

    out["surface"] = spec
    kind: SurfaceKind = spec["kind"]

    per_kind = _SURFACE_VALIDATORS.get(kind)
    if per_kind:
        for msg in per_kind(spec):
            issues.append(
                ValidationIssue(
                    item_id=item_id,
                    rule=f"surface.{kind}.config",
                    message=msg,
                    severity="error",
                )
            )

    # Surface-aware correctness checks
    if kind == "multiple_choice":
        choices = out.get("choices")
        if not isinstance(choices, list) or len(choices) < 2:
            issues.append(
                ValidationIssue(
                    item_id=item_id,
                    rule="mcq.choices",
                    message="multiple_choice items need at least 2 choices",
                    severity="error",
                )
            )
        else:
            correct = [c for c in choices if isinstance(c, dict) and c.get("isCorrect")]
            if len(correct) != 1:
                issues.append(
                    ValidationIssue(
                        item_id=item_id,
                        rule="mcq.single_correct",
                        message="multiple_choice items must have exactly one correct choice",
                        severity="error",
                    )
                )

    if kind in ("scratchpad", "geometry_workspace") and not out.get("expectedAnswer"):
        issues.append(
            ValidationIssue(
                item_id=item_id,
                rule="surface.expected_answer",
                message=f"{kind} items should declare expectedAnswer for scoring",
                severity="warning",
            )
        )

    accepted = not any(i.severity == "error" for i in issues)
    return ValidationResult(item=out, issues=tuple(issues), accepted=accepted)


def validate_batch(items: list[dict[str, Any]]) -> list[ValidationResult]:
    return [validate_item(it) for it in items]


def filter_accepted(items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[ValidationIssue]]:
    accepted: list[dict[str, Any]] = []
    issues: list[ValidationIssue] = []
    for r in validate_batch(items):
        issues.extend(r.issues)
        if r.accepted:
            accepted.append(r.item)
    return accepted, issues

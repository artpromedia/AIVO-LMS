"""Baseline surface contract.

Sprint 03 introduces a typed contract that describes which *learner
surface* (interactive workspace) a baseline assessment item expects. The
baseline generator now emits items with an attached ``LearnerSurfaceSpec``
so the assessment runtime can mount the correct surface (multiple choice,
math scratchpad, geometry workspace, text response, …) and so the scorer
can interpret the response.

The contract is intentionally narrow: the LLM does *not* invent surfaces,
it picks from this enum and the validator rejects anything else. That
preserves determinism and lets the scoring pipeline assume a finite set
of shapes.
"""

from __future__ import annotations

from typing import Any, Iterable, Literal, Optional, TypedDict

# ---------------------------------------------------------------------------
# Surface kinds
# ---------------------------------------------------------------------------
# Keep this enum in lockstep with packages/learner-surfaces and the
# mobile/web LearnerSurfaceSpec types. Adding a new kind requires a
# matching renderer on every client.

SurfaceKind = Literal[
    "multiple_choice",      # legacy MCQ — no interactive surface
    "tap_image",            # image/emoji selection (pre-K, AAC)
    "drag_sort",            # categorise items
    "sequence",             # order events
    "pattern_fill",         # complete a pattern
    "scratchpad",           # free-form ink for math computation
    "geometry_workspace",   # geometry tools (segments, angles, polygons)
    "text_response",        # short free-text answer
    "observation",          # caregiver-observed (no learner interaction)
]

ALL_SURFACE_KINDS: tuple[SurfaceKind, ...] = (
    "multiple_choice",
    "tap_image",
    "drag_sort",
    "sequence",
    "pattern_fill",
    "scratchpad",
    "geometry_workspace",
    "text_response",
    "observation",
)


class LearnerSurfaceSpec(TypedDict, total=False):
    """A baseline item's surface request.

    The generator MUST set ``kind``. ``config`` is an opaque, surface-
    specific bag (e.g. geometry tool palette). The runtime is responsible
    for validating ``config`` against the per-surface schema before
    rendering — the contract here only enforces ``kind``.
    """

    kind: SurfaceKind
    config: dict[str, Any]


# ---------------------------------------------------------------------------
# Domain → preferred surfaces
# ---------------------------------------------------------------------------
# A hint list the prompt builder hands to the LLM. The LLM is encouraged
# to choose the most authentic surface for the skill — geometry problems
# get ``geometry_workspace``, multi-step arithmetic gets ``scratchpad``,
# vocabulary gets ``tap_image``.

DOMAIN_PREFERRED_SURFACES: dict[str, tuple[SurfaceKind, ...]] = {
    "math":     ("multiple_choice", "scratchpad", "geometry_workspace", "drag_sort"),
    "geometry": ("geometry_workspace", "scratchpad", "multiple_choice"),
    "reading":  ("multiple_choice", "tap_image", "text_response"),
    "writing":  ("text_response", "multiple_choice"),
    "science":  ("multiple_choice", "observation", "drag_sort", "sequence"),
    "social":   ("multiple_choice", "observation", "tap_image"),
    "sel":      ("tap_image", "observation"),
}


def preferred_surfaces_for(domain: str) -> tuple[SurfaceKind, ...]:
    return DOMAIN_PREFERRED_SURFACES.get(domain.lower(), ("multiple_choice",))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def coerce_surface(raw: Any) -> Optional[LearnerSurfaceSpec]:
    """Return a normalised :class:`LearnerSurfaceSpec` or ``None``.

    Accepts a string (treated as ``kind``) or a dict. Unknown kinds are
    rejected — callers should treat ``None`` as "fall back to
    multiple_choice".
    """

    if raw is None:
        return None
    if isinstance(raw, str):
        return {"kind": raw} if raw in ALL_SURFACE_KINDS else None  # type: ignore[return-value]
    if not isinstance(raw, dict):
        return None
    kind = raw.get("kind")
    if not isinstance(kind, str) or kind not in ALL_SURFACE_KINDS:
        return None
    spec: LearnerSurfaceSpec = {"kind": kind}  # type: ignore[typeddict-item]
    cfg = raw.get("config")
    if isinstance(cfg, dict):
        spec["config"] = cfg
    return spec


def render_prompt_section(domain: str) -> str:
    """Render a prompt fragment that lists the surfaces the LLM may pick."""

    preferred = preferred_surfaces_for(domain)
    bullet_lines = "\n".join(f"  - {k}" for k in preferred)
    fallback_lines = "\n".join(
        f"  - {k}" for k in ALL_SURFACE_KINDS if k not in preferred
    )
    return f"""## Surface Tool Protocol — baseline
Each item MUST include a `surface` field shaped like:
    {{ "kind": "<one of the surfaces below>", "config": {{...}} }}

Preferred surfaces for {domain}:
{bullet_lines}

Also allowed when appropriate:
{fallback_lines}

Rules:
- geometry items → prefer `geometry_workspace`
- multi-step arithmetic / computation → prefer `scratchpad`
- vocabulary, picture identification → prefer `tap_image`
- short open responses → `text_response`
- pure MCQ → `multiple_choice`
- never invent a new kind; pick from the list above"""


def known_kinds() -> Iterable[SurfaceKind]:
    return ALL_SURFACE_KINDS

"""Baseline item templates.

Each template describes one canonical baseline item shape — what skill
it probes, which :class:`LearnerSurfaceSpec` the runtime should mount,
and an example correct response. The baseline generator uses these
templates as exemplars in the prompt so the LLM produces items that the
validator and scorer can actually consume.

Sprint 03 introduces the catalogue. Sprints 05+ will extend it as new
surfaces ship.
"""

from __future__ import annotations

from typing import Any, TypedDict

from .baseline_surface_contract import LearnerSurfaceSpec, SurfaceKind


class BaselineItemTemplate(TypedDict, total=False):
    id: str
    domain: str
    skill: str
    difficulty: str            # "easy" | "medium" | "hard"
    surface: LearnerSurfaceSpec
    prompt_hint: str
    expected_response_shape: str
    config: dict[str, Any]


# ---------------------------------------------------------------------------
# Math — scratchpad encouraged for multi-step computation
# ---------------------------------------------------------------------------

MATH_TEMPLATES: tuple[BaselineItemTemplate, ...] = (
    {
        "id": "math.mcq.basic_addition",
        "domain": "math",
        "skill": "addition_within_20",
        "difficulty": "easy",
        "surface": {"kind": "multiple_choice"},
        "prompt_hint": "Two single-digit numbers; 4 emoji-labelled choices.",
        "expected_response_shape": "string (selected choice id)",
    },
    {
        "id": "math.scratchpad.multi_digit",
        "domain": "math",
        "skill": "multi_digit_addition",
        "difficulty": "medium",
        "surface": {
            "kind": "scratchpad",
            "config": {
                "gridPaper": True,
                "allowSnapshots": True,
                "captureFinalAnswerField": True,
            },
        },
        "prompt_hint": (
            "Present a multi-digit addition or subtraction problem and ask "
            "the learner to work it out on the scratchpad, then enter the "
            "final answer in the boxed field."
        ),
        "expected_response_shape": "{ scratchInk?: InkStroke[], finalAnswer: string }",
    },
    {
        "id": "math.scratchpad.word_problem",
        "domain": "math",
        "skill": "word_problem_two_step",
        "difficulty": "hard",
        "surface": {
            "kind": "scratchpad",
            "config": {"gridPaper": False, "captureFinalAnswerField": True},
        },
        "prompt_hint": "Two-step word problem with a scratchpad for work.",
        "expected_response_shape": "{ scratchInk?: InkStroke[], finalAnswer: string }",
    },
)


# ---------------------------------------------------------------------------
# Geometry — geometry_workspace required
# ---------------------------------------------------------------------------

GEOMETRY_TEMPLATES: tuple[BaselineItemTemplate, ...] = (
    {
        "id": "geometry.workspace.identify_polygon",
        "domain": "geometry",
        "skill": "polygon_identification",
        "difficulty": "easy",
        "surface": {
            "kind": "geometry_workspace",
            "config": {
                "tools": ["point", "segment"],
                "showRuler": False,
                "task": "identify",
            },
        },
        "prompt_hint": "Show a polygon and ask the learner to name it.",
        "expected_response_shape": "{ selectedName: string }",
    },
    {
        "id": "geometry.workspace.measure_angle",
        "domain": "geometry",
        "skill": "angle_measurement",
        "difficulty": "medium",
        "surface": {
            "kind": "geometry_workspace",
            "config": {
                "tools": ["point", "segment", "angle"],
                "showProtractor": True,
                "task": "measure",
            },
        },
        "prompt_hint": "Display an angle; learner uses the protractor tool.",
        "expected_response_shape": "{ measurement: number, unit: 'deg' }",
    },
    {
        "id": "geometry.workspace.construct_triangle",
        "domain": "geometry",
        "skill": "triangle_construction",
        "difficulty": "hard",
        "surface": {
            "kind": "geometry_workspace",
            "config": {
                "tools": ["point", "segment", "compass"],
                "showRuler": True,
                "task": "construct",
            },
        },
        "prompt_hint": "Construct a triangle given three side lengths.",
        "expected_response_shape": "{ vertices: [number, number][] }",
    },
)


# ---------------------------------------------------------------------------
# Reading / writing
# ---------------------------------------------------------------------------

READING_TEMPLATES: tuple[BaselineItemTemplate, ...] = (
    {
        "id": "reading.mcq.vocabulary",
        "domain": "reading",
        "skill": "vocabulary",
        "difficulty": "easy",
        "surface": {"kind": "multiple_choice"},
        "prompt_hint": "Word in a short sentence; pick the matching definition.",
        "expected_response_shape": "string",
    },
    {
        "id": "reading.tap_image.picture_word",
        "domain": "reading",
        "skill": "picture_word_matching",
        "difficulty": "easy",
        "surface": {"kind": "tap_image", "config": {"choices": 4}},
        "prompt_hint": "Spoken or written word; learner taps matching image.",
        "expected_response_shape": "string (image id)",
    },
)


WRITING_TEMPLATES: tuple[BaselineItemTemplate, ...] = (
    {
        "id": "writing.text.short_response",
        "domain": "writing",
        "skill": "short_response",
        "difficulty": "medium",
        "surface": {"kind": "text_response", "config": {"maxChars": 280}},
        "prompt_hint": "Open-ended question; 1-2 sentence response.",
        "expected_response_shape": "string",
    },
)


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------

ALL_TEMPLATES: tuple[BaselineItemTemplate, ...] = (
    *MATH_TEMPLATES,
    *GEOMETRY_TEMPLATES,
    *READING_TEMPLATES,
    *WRITING_TEMPLATES,
)


def templates_for_domain(domain: str) -> tuple[BaselineItemTemplate, ...]:
    domain = (domain or "").lower()
    return tuple(t for t in ALL_TEMPLATES if t.get("domain") == domain)


def render_template_examples(domain: str, limit: int = 3) -> str:
    """Render up to ``limit`` templates as JSON-y prompt examples."""

    import json

    chosen = templates_for_domain(domain)[:limit]
    if not chosen:
        return "(no curated templates for this domain — pick the most appropriate surface)"
    blocks: list[str] = []
    for t in chosen:
        blocks.append(json.dumps({
            "id": t["id"],
            "skill": t["skill"],
            "difficulty": t["difficulty"],
            "surface": t["surface"],
            "prompt_hint": t["prompt_hint"],
            "expected_response_shape": t.get("expected_response_shape", "string"),
        }, indent=2))
    return "\n\n".join(blocks)


def known_surface_kinds() -> set[SurfaceKind]:
    """All surface kinds actually used by curated templates."""

    return {t["surface"]["kind"] for t in ALL_TEMPLATES if "surface" in t}

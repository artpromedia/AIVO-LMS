"""Math activity generator using subject-brain context.

Builds a deterministic StagePlan-style scaffold for math topics. Geometry
topics emit a structured ``geometry_workspace`` surface; computation topics
emit a scratchpad; fractions emit a number line or area model.
"""

from __future__ import annotations

from typing import Any


GEOMETRY_TOPICS = {
    "angles",
    "triangles",
    "rectangles",
    "circles",
    "polygons",
    "area",
    "perimeter",
    "volume",
    "coordinate_geometry",
}


def _topic_matches(topic: str | None, keywords: set[str]) -> bool:
    if not topic:
        return False
    lower = topic.lower()
    return any(keyword in lower for keyword in keywords)


def _make_surface(
    surface_id: str,
    surface_type: str,
    prompt: str,
    alt_text: str,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    surface: dict[str, Any] = {
        "id": surface_id,
        "type": surface_type,
        "prompt": prompt,
        "accessibility": {
            "altText": alt_text,
            "reduceMotionSafe": True,
            "keyboardAlternative": True,
        },
    }
    if extras:
        surface.update(extras)
    return surface


def generate_math_activity(
    *,
    topic: str | None,
    subject_brain_context: dict[str, Any],
    functioning_level: str | None = None,
) -> dict[str, Any]:
    """Return a StagePlan-shaped math activity using the subject-brain context."""

    surfaces: list[dict[str, Any]] = []
    lower_topic = (topic or "").lower()

    if _topic_matches(topic, GEOMETRY_TOPICS):
        surfaces.append(
            _make_surface(
                surface_id="surf-geo-1",
                surface_type="geometry_workspace",
                prompt=f"Work through this {topic} problem on the geometry workspace.",
                alt_text=f"Geometry workspace for {topic}.",
                extras={
                    "diagram": {"shapes": [{"id": "r1", "kind": "rectangle"}]},
                    "scratchpad": {"enabled": True},
                },
            )
        )
    if "fraction" in lower_topic:
        surfaces.append(
            _make_surface(
                surface_id="surf-num-1",
                surface_type="number_line",
                prompt="Place the fraction on the number line.",
                alt_text="Number line from 0 to 1 with tick marks.",
                extras={"numberLine": {"min": 0, "max": 1}},
            )
        )
    if not surfaces:
        surfaces.append(
            _make_surface(
                surface_id="surf-sc-1",
                surface_type="scratchpad",
                prompt="Use the scratchpad to show your work.",
                alt_text="Blank scratchpad.",
                extras={"scratchpad": {"enabled": True}},
            )
        )

    profile_adaptations: list[str] = list(subject_brain_context.get("profileAdaptations") or [])
    if functioning_level in {"LOW_VERBAL", "PRE_SYMBOLIC"} and not any(
        "text" in adaptation.lower() for adaptation in profile_adaptations
    ):
        profile_adaptations.append("Reduce text density and prefer visual surfaces.")

    return {
        "subject": "math",
        "topic": topic,
        "surfaces": surfaces,
        "scaffolds": list(subject_brain_context.get("recommendedScaffolds") or []),
        "profileAdaptations": profile_adaptations,
        "subjectBrainEvidenceUsed": {
            "relevantSkills": list(subject_brain_context.get("relevantSkills") or []),
            "masteryGaps": list(subject_brain_context.get("masteryGaps") or []),
            "misconceptionRisks": [
                risk.get("id") for risk in subject_brain_context.get("misconceptionRisks") or []
            ],
            "standards": list(subject_brain_context.get("standards") or []),
        },
    }

"""Science activity generator using subject-brain context."""

from __future__ import annotations

from typing import Any


def _surface(
    surface_id: str,
    surface_type: str,
    prompt: str,
    alt_text: str,
) -> dict[str, Any]:
    return {
        "id": surface_id,
        "type": surface_type,
        "prompt": prompt,
        "accessibility": {
            "altText": alt_text,
            "reduceMotionSafe": True,
            "keyboardAlternative": True,
        },
    }


def generate_science_activity(
    *,
    topic: str | None,
    subject_brain_context: dict[str, Any],
    functioning_level: str | None = None,
) -> dict[str, Any]:
    """Return a StagePlan-shaped science activity using the subject-brain context."""

    surfaces: list[dict[str, Any]] = []
    lower_topic = (topic or "").lower()

    if any(word in lower_topic for word in ("classif", "sort", "group")):
        surfaces.append(
            _surface(
                surface_id="surf-class-1",
                surface_type="drag_manipulative",
                prompt="Drag each card into the correct group.",
                alt_text="Classification activity with labeled groups.",
            )
        )
    if any(word in lower_topic for word in ("water cycle", "cycle", "sequence", "order")):
        surfaces.append(
            _surface(
                surface_id="surf-seq-1",
                surface_type="science_diagram",
                prompt="Arrange the steps of the cycle in order.",
                alt_text="Cycle diagram with movable step cards.",
            )
        )
    if any(word in lower_topic for word in ("observ", "inference", "evidence")):
        surfaces.append(
            _surface(
                surface_id="surf-obs-1",
                surface_type="reading_annotation",
                prompt="Mark what you observed vs what you inferred.",
                alt_text="Annotation surface with two columns.",
            )
        )
    if not surfaces:
        surfaces.append(
            _surface(
                surface_id="surf-sci-1",
                surface_type="science_diagram",
                prompt="Label the diagram and explain.",
                alt_text="Science diagram surface.",
            )
        )

    return {
        "subject": "science",
        "topic": topic,
        "surfaces": surfaces,
        "scaffolds": list(subject_brain_context.get("recommendedScaffolds") or []),
        "profileAdaptations": list(subject_brain_context.get("profileAdaptations") or []),
        "subjectBrainEvidenceUsed": {
            "relevantSkills": list(subject_brain_context.get("relevantSkills") or []),
            "misconceptionRisks": [
                risk.get("id") for risk in subject_brain_context.get("misconceptionRisks") or []
            ],
            "standards": list(subject_brain_context.get("standards") or []),
        },
    }

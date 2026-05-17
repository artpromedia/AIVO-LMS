"""ELA activity generator using subject-brain context."""

from __future__ import annotations

from typing import Any


def _surface(
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


def generate_ela_activity(
    *,
    topic: str | None,
    subject_brain_context: dict[str, Any],
    functioning_level: str | None = None,
) -> dict[str, Any]:
    """Return a StagePlan-shaped ELA activity using the subject-brain context."""

    surfaces: list[dict[str, Any]] = []
    lower_topic = (topic or "").lower()

    if any(word in lower_topic for word in ("read", "comprehension", "annotation")):
        surfaces.append(
            _surface(
                surface_id="surf-read-1",
                surface_type="reading_annotation",
                prompt="Read each chunk and annotate the key terms.",
                alt_text="Reading annotation surface with highlighted chunks.",
            )
        )
    if "vocab" in lower_topic:
        surfaces.append(
            _surface(
                surface_id="surf-vocab-1",
                surface_type="choice_grid",
                prompt="Match each word with its meaning.",
                alt_text="Vocabulary matching grid.",
            )
        )
    if any(word in lower_topic for word in ("writ", "compos")):
        surfaces.append(
            _surface(
                surface_id="surf-write-1",
                surface_type="multi_step_workspace",
                prompt="Use the sentence frame to build your response.",
                alt_text="Writing scaffold with sentence frames.",
            )
        )
    if not surfaces:
        surfaces.append(
            _surface(
                surface_id="surf-read-default",
                surface_type="reading_annotation",
                prompt="Read and annotate the passage.",
                alt_text="Annotation surface.",
            )
        )

    text_density = "reduced" if functioning_level in {"LOW_VERBAL", "PRE_SYMBOLIC"} else "standard"

    profile_adaptations: list[str] = list(subject_brain_context.get("profileAdaptations") or [])
    if text_density == "reduced" and not any(
        "chunk" in adaptation.lower() or "text" in adaptation.lower()
        for adaptation in profile_adaptations
    ):
        profile_adaptations.append("Reduce text density and offer audio playback.")

    return {
        "subject": "ela",
        "topic": topic,
        "textDensity": text_density,
        "surfaces": surfaces,
        "scaffolds": list(subject_brain_context.get("recommendedScaffolds") or []),
        "profileAdaptations": profile_adaptations,
        "subjectBrainEvidenceUsed": {
            "relevantSkills": list(subject_brain_context.get("relevantSkills") or []),
            "standards": list(subject_brain_context.get("standards") or []),
        },
    }

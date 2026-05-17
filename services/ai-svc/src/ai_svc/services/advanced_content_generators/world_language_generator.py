"""World language activity generator using subject-brain context."""

from __future__ import annotations

from typing import Any


CEFR_LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}


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


def generate_world_language_activity(
    *,
    topic: str | None,
    subject_brain_context: dict[str, Any],
    cefr_level: str = "A1",
    functioning_level: str | None = None,
) -> dict[str, Any]:
    """Return a StagePlan-shaped world language activity."""

    level = cefr_level if cefr_level in CEFR_LEVELS else "A1"
    surfaces: list[dict[str, Any]] = []
    lower_topic = (topic or "").lower()

    if "listen" in lower_topic:
        surfaces.append(
            _surface(
                surface_id="surf-listen-1",
                surface_type="voice_response",
                prompt=f"Listen to the {level} audio clip and answer.",
                alt_text="Listening comprehension surface.",
            )
        )
    if "speak" in lower_topic:
        surfaces.append(
            _surface(
                surface_id="surf-speak-1",
                surface_type="voice_response",
                prompt="Say the phrase out loud.",
                alt_text="Speaking surface (TTS available).",
            )
        )
    if "read" in lower_topic:
        surfaces.append(
            _surface(
                surface_id="surf-read-1",
                surface_type="reading_annotation",
                prompt="Read and annotate.",
                alt_text="Reading surface.",
            )
        )
    if not surfaces:
        surfaces.append(
            _surface(
                surface_id="surf-wl-default",
                surface_type="choice_grid",
                prompt="Choose the correct translation.",
                alt_text="Translation choices.",
            )
        )

    return {
        "subject": "world_language",
        "topic": topic,
        "cefrLevel": level,
        "surfaces": surfaces,
        "scaffolds": list(subject_brain_context.get("recommendedScaffolds") or []),
        "profileAdaptations": list(subject_brain_context.get("profileAdaptations") or []),
        "ttsReady": True,
        "subjectBrainEvidenceUsed": {
            "relevantSkills": list(subject_brain_context.get("relevantSkills") or []),
            "standards": list(subject_brain_context.get("standards") or []),
        },
    }

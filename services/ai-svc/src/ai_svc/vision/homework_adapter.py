"""Adapt homework assignments to learner's Brain profile.

Generates functioning-level-specific adaptations:
- STANDARD: Rephrase for clarity, add step-by-step scaffolding
- SUPPORTED: Simplify language, add visual cues, reduce choices to 3
- LOW_VERBAL: Picture-supported format, 2 choices, audio-first
- NON_VERBAL: Parent adaptation guide with real objects
- PRE_SYMBOLIC: Parent adaptation guide with sensory activities
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

from ..services.llm_gateway import generate_completion

logger = logging.getLogger(__name__)


def _self_regulation_hub_enabled() -> bool:
    """Sprint 06 flag check. When on, adapted problems are also handed
    off to the new homework-svc so the four-step engine can pick up the
    extracted problems and present the UNDERSTAND step in the learner UI.
    """
    import os

    raw = os.environ.get("AIVO_FEATURE_SELF_REGULATION_HUB", "")
    return raw.strip().lower() in {"1", "true", "yes", "on"}


async def _forward_to_homework_svc(
    learner_id: str,
    tenant_id: str,
    subject: str,
    problems: list[dict[str, Any]],
) -> None:
    """Fire-and-forget hand-off to the @aivo/homework-svc. Failures are
    swallowed so legacy adaptation flow is unaffected."""

    if not _self_regulation_hub_enabled():
        return
    if not learner_id or not tenant_id:
        return
    import os
    import httpx

    base = os.environ.get("HOMEWORK_SVC_URL", "http://localhost:3065")
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            session = await client.post(
                f"{base}/api/homework-sessions",
                json={
                    "tenantId": tenant_id,
                    "learnerId": learner_id,
                    "subject": subject,
                    "profile": {},
                },
            )
            if session.status_code != 201:
                return
            session_id = session.json().get("id")
            if not session_id or not problems:
                return
            # Advance step engine through UNDERSTAND so the UI can render
            # PLAN immediately when the learner opens the session.
            await client.post(f"{base}/api/homework-sessions/{session_id}/step")
    except Exception:  # pragma: no cover — fire-and-forget
        return


@dataclass
class AdaptedProblem:
    problem_number: int
    original: str
    adapted: str
    scaffolding: str = ""
    accommodation_notes: str = ""
    visual_supports: list[str] = field(default_factory=list)
    choices: list[str] = field(default_factory=list)
    parent_guide: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "problem_number": self.problem_number,
            "original": self.original,
            "adapted": self.adapted,
            "scaffolding": self.scaffolding,
            "accommodation_notes": self.accommodation_notes,
            "visual_supports": self.visual_supports,
            "choices": self.choices,
            "parent_guide": self.parent_guide,
        }


@dataclass
class AdaptedAssignment:
    original_summary: str
    adapted_problems: list[AdaptedProblem]
    parent_guide: str = ""
    estimated_minutes: int = 15
    functioning_level: str = "STANDARD"
    model: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "original_summary": self.original_summary,
            "adapted_problems": [p.to_dict() for p in self.adapted_problems],
            "parent_guide": self.parent_guide,
            "estimated_minutes": self.estimated_minutes,
            "functioning_level": self.functioning_level,
            "model": self.model,
        }


_ADAPTATION_RULES: dict[str, str] = {
    "STANDARD": (
        "- Rephrase for maximum clarity\n"
        "- Add step-by-step scaffolding for complex problems\n"
        "- Maintain 4 choices for MCQ\n"
        "- Add worked examples when appropriate\n"
        "- Use age-appropriate vocabulary"
    ),
    "SUPPORTED": (
        "- Simplify language to 2-3 grade levels below\n"
        "- Add visual cue descriptions (e.g., [PICTURE: red apple])\n"
        "- Reduce MCQ choices to 3\n"
        "- Extend time estimate by 1.5x\n"
        "- Break long problems into smaller sub-steps\n"
        "- Use bold for key words"
    ),
    "LOW_VERBAL": (
        "- Use picture-supported format\n"
        "- Max 2 answer choices (large picture cards)\n"
        "- One sentence per line\n"
        "- Include parent mediation notes\n"
        "- 5-minute segments max\n"
        "- Use concrete, familiar vocabulary only"
    ),
    "NON_VERBAL": (
        "- Convert to parent guide format\n"
        "- Map problems to real-world objects\n"
        "- Focus on functional skill equivalents\n"
        "- Include cause-and-effect activities\n"
        "- Provide sensory engagement alternatives\n"
        "- No screen-based work expected"
    ),
    "PRE_SYMBOLIC": (
        "- Full parent guide mode\n"
        "- Map to sensory exploration activities\n"
        "- Focus on engagement and awareness\n"
        "- Provide observation checklist for parent\n"
        "- Include functional play suggestions\n"
        "- No academic expectations — focus on participation"
    ),
}

_LEVEL_MAX_CHOICES = {
    "STANDARD": 4,
    "SUPPORTED": 3,
    "LOW_VERBAL": 2,
    "NON_VERBAL": 0,
    "PRE_SYMBOLIC": 0,
}

_LEVEL_MAX_SENTENCES = {
    "STANDARD": 6,
    "SUPPORTED": 4,
    "LOW_VERBAL": 1,
    "NON_VERBAL": 3,
    "PRE_SYMBOLIC": 2,
}

_ADAPTATION_PROMPT = """Adapt these homework problems for a learner with the following profile.

## Brain Context
- Functioning Level: {functioning_level}
- Communication Mode: {communication_mode}
- Grade Level: {grade_level}
- Active Accommodations: {accommodations}
- Delivery Level Parameters:
  - Max sentences per block: {max_sentences}
  - Max choices: {max_choices}

## Adaptation Rules for {functioning_level}
{adaptation_rules}

## Problems to Adapt
{problems_text}

## Required Output
Return a JSON object:
{{
  "original_summary": "Brief description of the original assignment",
  "adapted_problems": [
    {{
      "problem_number": 1,
      "original": "original problem text",
      "adapted": "adapted problem text at learner's level",
      "scaffolding": "worked examples, hints, or sentence starters",
      "accommodation_notes": "accommodations applied",
      "visual_supports": ["[PICTURE: description]"],
      "choices": ["simplified choices if MCQ"],
      "parent_guide": "guide for parent/caregiver if needed"
    }}
  ],
  "parent_guide": "overall guide for parent support (required for LOW_VERBAL, NON_VERBAL, PRE_SYMBOLIC)",
  "estimated_minutes": 15
}}

Return ONLY the JSON object."""


async def adapt_homework(
    extracted_problems: list[dict[str, Any]],
    brain_context: dict[str, Any],
    subject: str = "math",
) -> AdaptedAssignment:
    functioning_level = brain_context.get("functioning_level_profile", {}).get("level", "STANDARD")
    communication_mode = brain_context.get("disability_signals", {}).get("communication_mode", "verbal")
    # The learner's working level: prefer the baseline-derived delivery_level,
    # then the enrolled grade_band. NEVER a hardcoded grade — when neither is
    # present we say so explicitly and let the model adapt from the problem
    # content, logging the gap so it shows up in observability.
    alignment = brain_context.get("curriculum_alignment") or {}
    grade_level = alignment.get("delivery_level") or alignment.get("grade_band")
    if not grade_level:
        logger.warning(
            "homework_adapter: no delivery_level/grade_band in curriculum_alignment; "
            "adapting without a grade anchor"
        )
        grade_level = "not specified — infer an appropriate level from the problems themselves"
    accommodations = brain_context.get("active_accommodations", [])

    max_choices = _LEVEL_MAX_CHOICES.get(functioning_level, 4)
    max_sentences = _LEVEL_MAX_SENTENCES.get(functioning_level, 6)
    rules = _ADAPTATION_RULES.get(functioning_level, _ADAPTATION_RULES["STANDARD"])

    problems_text = ""
    for p in extracted_problems:
        problems_text += f"\nProblem {p.get('number', '?')}: {p.get('problem_text', p.get('text', ''))}\n"
        if p.get("extracted_choices") or p.get("choices"):
            choices = p.get("extracted_choices") or p.get("choices", [])
            problems_text += f"Choices: {', '.join(choices)}\n"
        if p.get("detected_equations_latex") or p.get("equations_latex"):
            eqs = p.get("detected_equations_latex") or p.get("equations_latex", [])
            problems_text += f"Equations: {', '.join(eqs)}\n"

    prompt = _ADAPTATION_PROMPT.format(
        functioning_level=functioning_level,
        communication_mode=communication_mode,
        grade_level=grade_level,
        accommodations=", ".join(accommodations) if isinstance(accommodations, list) else str(accommodations),
        max_sentences=max_sentences,
        max_choices=max_choices,
        adaptation_rules=rules,
        problems_text=problems_text,
    )

    try:
        result = await generate_completion(
            system_prompt="You are an expert special education teacher who adapts homework for learners with diverse needs.",
            user_prompt=prompt,
            max_tokens=3000,
            temperature=0.4,
        )

        adapted = _parse_adaptation_response(result["content"])
        adapted.functioning_level = functioning_level
        adapted.model = result.get("model", "")

        passed, issues = _validate_adaptation_quality(adapted, extracted_problems, functioning_level)
        if not passed:
            logger.warning(f"Adaptation quality gate failed: {issues}")
            return AdaptedAssignment(
                original_summary="Quality gate failed — using original problems",
                adapted_problems=[
                    AdaptedProblem(
                        problem_number=p.get("number", i + 1),
                        original=p.get("problem_text", p.get("text", "")),
                        adapted=p.get("problem_text", p.get("text", "")),
                    )
                    for i, p in enumerate(extracted_problems)
                ],
                functioning_level=functioning_level,
                model=adapted.model,
            )
        if issues:
            logger.info(f"Adaptation quality warnings: {issues}")

        # Sprint 06: hand off to homework-svc (flag-gated, fire-and-forget).
        await _forward_to_homework_svc(
            learner_id=str(brain_context.get("learner_id") or ""),
            tenant_id=str(brain_context.get("tenant_id") or ""),
            subject=subject,
            problems=extracted_problems,
        )

        return adapted

    except Exception as e:
        logger.error(f"Homework adaptation failed: {e}")
        return AdaptedAssignment(
            original_summary="Adaptation failed",
            adapted_problems=[
                AdaptedProblem(
                    problem_number=p.get("number", i + 1),
                    original=p.get("problem_text", p.get("text", "")),
                    adapted=p.get("problem_text", p.get("text", "")),
                )
                for i, p in enumerate(extracted_problems)
            ],
            functioning_level=functioning_level,
        )


def _validate_adaptation_quality(
    adapted: AdaptedAssignment,
    original_problems: list[dict[str, Any]],
    functioning_level: str,
) -> tuple[bool, list[str]]:
    issues: list[str] = []
    max_choices = _LEVEL_MAX_CHOICES.get(functioning_level, 4)
    max_sentences = _LEVEL_MAX_SENTENCES.get(functioning_level, 6)

    if len(adapted.adapted_problems) == 0 and len(original_problems) > 0:
        issues.append("No adapted problems generated")
        return False, issues

    for p in adapted.adapted_problems:
        if not p.adapted and not p.original:
            issues.append(f"Problem {p.problem_number}: empty adapted text")

        if max_choices > 0 and len(p.choices) > max_choices:
            p.choices = p.choices[:max_choices]

        if max_sentences > 0:
            sentences = [s.strip() for s in p.adapted.split(".") if s.strip()]
            if len(sentences) > max_sentences * 2:
                issues.append(f"Problem {p.problem_number}: adapted text too long ({len(sentences)} sentences)")

    if functioning_level in ("NON_VERBAL", "PRE_SYMBOLIC"):
        if not adapted.parent_guide:
            issues.append("Missing parent guide for NON_VERBAL/PRE_SYMBOLIC level")
            adapted.parent_guide = "Please work with your child using real objects and sensory activities related to each problem."

    passed = len([i for i in issues if "empty adapted" in i or "No adapted" in i]) == 0
    return passed, issues


def _parse_adaptation_response(text: str) -> AdaptedAssignment:
    try:
        clean = text.strip()
        if clean.startswith("```"):
            lines = clean.split("\n")
            clean = "\n".join(lines[1:-1]) if len(lines) > 2 else clean
        if clean.endswith("```"):
            clean = clean[:-3]
        data = json.loads(clean)
    except json.JSONDecodeError:
        logger.warning("Failed to parse adaptation JSON")
        return AdaptedAssignment(original_summary="Parse failed", adapted_problems=[])

    problems = []
    for p in data.get("adapted_problems", []):
        problems.append(AdaptedProblem(
            problem_number=p.get("problem_number", len(problems) + 1),
            original=p.get("original", ""),
            adapted=p.get("adapted", ""),
            scaffolding=p.get("scaffolding", ""),
            accommodation_notes=p.get("accommodation_notes", ""),
            visual_supports=p.get("visual_supports", []),
            choices=p.get("choices", []),
            parent_guide=p.get("parent_guide", ""),
        ))

    return AdaptedAssignment(
        original_summary=data.get("original_summary", ""),
        adapted_problems=problems,
        parent_guide=data.get("parent_guide", ""),
        estimated_minutes=data.get("estimated_minutes", 15),
    )

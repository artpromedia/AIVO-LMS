"""Sprint 5 — functioning-level scaffold enforcement.

Every learner profile carries a ``functioningLevel`` from the parent
assessment / IEP (STANDARD, SUPPORTED, LOW_VERBAL, NON_VERBAL,
PRE_SYMBOLIC). Sprint 0 wrote that level into the LLM prompt as
advisory text. Sprint 5 enforces it post-generation: an item whose
shape contradicts the level is rejected, regardless of what the LLM
returned, so we never ship a 200-word reading passage to a NON_VERBAL
learner.

For ``PRE_SYMBOLIC`` we bypass the LLM entirely — there's no
multiple-choice item the learner could meaningfully respond to. The
generator returns a curated observation checklist the caregiver fills
in offline.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable


FUNCTIONING_LEVELS = (
    "STANDARD",
    "SUPPORTED",
    "LOW_VERBAL",
    "NON_VERBAL",
    "PRE_SYMBOLIC",
)


@dataclass(frozen=True)
class ScaffoldRule:
    """One enforcement rule for a functioning level.

    All thresholds are inclusive maxima — an item whose computed value
    exceeds the max is rejected. ``None`` means "no limit".
    """

    level: str
    max_stem_chars: int | None
    max_option_chars: int | None
    max_options: int | None
    require_emoji_in_options: bool
    """Allowed interaction types for option labels. Other types still
    pass — this only restricts when ``require_emoji_in_options`` is
    true, the rule's evaluator checks each option label contains at
    least one non-alphanumeric / non-whitespace glyph (a sloppy but
    effective emoji-ish heuristic)."""


RULES: dict[str, ScaffoldRule] = {
    "STANDARD": ScaffoldRule(
        level="STANDARD",
        max_stem_chars=None,
        max_option_chars=None,
        max_options=10,
        require_emoji_in_options=False,
    ),
    "SUPPORTED": ScaffoldRule(
        level="SUPPORTED",
        max_stem_chars=180,
        max_option_chars=60,
        max_options=4,
        require_emoji_in_options=False,
    ),
    "LOW_VERBAL": ScaffoldRule(
        level="LOW_VERBAL",
        max_stem_chars=90,
        max_option_chars=30,
        max_options=3,
        require_emoji_in_options=True,
    ),
    "NON_VERBAL": ScaffoldRule(
        level="NON_VERBAL",
        max_stem_chars=60,
        max_option_chars=18,
        max_options=2,
        require_emoji_in_options=True,
    ),
    "PRE_SYMBOLIC": ScaffoldRule(
        level="PRE_SYMBOLIC",
        max_stem_chars=0,
        max_option_chars=0,
        max_options=0,
        require_emoji_in_options=False,
    ),
}


def normalize_level(raw: str | None) -> str:
    if not raw:
        return "STANDARD"
    upper = raw.strip().upper()
    return upper if upper in RULES else "STANDARD"


def _looks_emoji_or_pictographic(text: str) -> bool:
    """Heuristic: at least one codepoint outside the basic ASCII
    alphanumeric + punctuation range. Matches every emoji / pictograph
    / box-drawing / non-Latin glyph we'd actually want for a
    LOW_VERBAL / NON_VERBAL learner without pulling in a heavyweight
    unicode database.
    """
    if not text:
        return False
    for ch in text:
        cp = ord(ch)
        if cp > 0x2000:  # generic punctuation / arrows / shapes / emoji
            return True
    return False


@dataclass
class ScaffoldViolation:
    code: str
    message: str


@dataclass
class ScaffoldEvaluation:
    ok: bool
    violations: list[ScaffoldViolation]


def evaluate_item(
    item: dict[str, Any],
    level: str | None,
) -> ScaffoldEvaluation:
    """Evaluate one baseline question against the rule for ``level``.

    Returns ok=False with a populated violations list when the item
    contradicts the scaffold; ok=True otherwise. Unknown items / shapes
    are not rejected — they merely flag a soft violation that the
    pipeline can choose to ignore or audit.
    """
    rule = RULES[normalize_level(level)]
    violations: list[ScaffoldViolation] = []

    # PRE_SYMBOLIC: no MC items are ever allowed.
    if rule.level == "PRE_SYMBOLIC":
        return ScaffoldEvaluation(
            ok=False,
            violations=[
                ScaffoldViolation(
                    code="PRE_SYMBOLIC_REJECTS_MC",
                    message=(
                        "PRE_SYMBOLIC learners receive observation prompts, "
                        "not multiple-choice questions. Switch to the "
                        "observation flow."
                    ),
                ),
            ],
        )

    stem = str(item.get("questionText", "") or "").strip()
    if rule.max_stem_chars is not None and len(stem) > rule.max_stem_chars:
        violations.append(
            ScaffoldViolation(
                code="STEM_TOO_LONG",
                message=(
                    f"Stem is {len(stem)} chars; {rule.level} allows max "
                    f"{rule.max_stem_chars}."
                ),
            )
        )

    options = item.get("options") or []
    if not isinstance(options, list):
        options = []
    if rule.max_options is not None and len(options) > rule.max_options:
        violations.append(
            ScaffoldViolation(
                code="TOO_MANY_OPTIONS",
                message=(
                    f"{len(options)} options provided; {rule.level} allows "
                    f"max {rule.max_options}."
                ),
            )
        )

    for idx, opt in enumerate(options):
        if not isinstance(opt, dict):
            continue
        label = str(opt.get("label", "") or "")
        if rule.max_option_chars is not None and len(label) > rule.max_option_chars:
            violations.append(
                ScaffoldViolation(
                    code="OPTION_LABEL_TOO_LONG",
                    message=(
                        f"options[{idx}] label is {len(label)} chars; "
                        f"{rule.level} allows max {rule.max_option_chars}."
                    ),
                )
            )
        if rule.require_emoji_in_options and not _looks_emoji_or_pictographic(label):
            violations.append(
                ScaffoldViolation(
                    code="OPTION_MISSING_PICTOGRAPH",
                    message=(
                        f"options[{idx}] label lacks an emoji / picture "
                        f"glyph but {rule.level} requires visual labels."
                    ),
                )
            )

    return ScaffoldEvaluation(ok=not violations, violations=violations)


def enforce_batch(
    questions: Iterable[dict[str, Any]],
    level: str | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Partition a batch of generated items into (allowed, rejected)
    by scaffold rule. Items remain in their original order within each
    bucket. Rejected items are returned with a ``_scaffoldViolations``
    array appended so the route layer can audit them.
    """
    allowed: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        verdict = evaluate_item(q, level)
        if verdict.ok:
            allowed.append(q)
            continue
        rejected.append({
            **q,
            "_scaffoldViolations": [
                {"code": v.code, "message": v.message} for v in verdict.violations
            ],
        })
    return allowed, rejected


# ---------------------------------------------------------------------------
# PRE_SYMBOLIC observation flow
# ---------------------------------------------------------------------------


# Curated observation prompts the caregiver fills in offline. These are
# NOT multiple-choice — they are short Likert / yes-no items that ask
# the caregiver to describe what the learner can already do. The 7
# domains mirror SUBJECTS so the downstream consumer can render them
# the same way.
_PRE_SYMBOLIC_DOMAINS = (
    ("math", "Number & Quantity"),
    ("ela", "Language & Communication"),
    ("science", "Curiosity & Exploration"),
    ("speech", "Vocalisation & Sound"),
    ("sel", "Social-Emotional Connection"),
    ("life_skills", "Daily Routines"),
    ("executive_function", "Attention & Regulation"),
)


def build_pre_symbolic_observation_payload(
    learner_id: str | None = None,
) -> dict[str, Any]:
    """Return the curated observation checklist used in place of an
    LLM-generated baseline for PRE_SYMBOLIC learners. Same response
    shape as the AI baseline so the parent UI doesn't need a separate
    code path: each prompt looks like a 3-option question with values
    ``yes`` / ``emerging`` / ``not_yet``.
    """

    questions: list[dict[str, Any]] = []
    prompts_by_domain: dict[str, tuple[str, ...]] = {
        "math": (
            "Does the learner notice when an object is removed from a set?",
            "Does the learner reach for ‘more’ when an item is offered repeatedly?",
            "Does the learner respond differently to one item vs. many?",
        ),
        "ela": (
            "Does the learner orient to a familiar voice within 5 seconds?",
            "Does the learner respond to their name being called?",
            "Does the learner use a consistent sign or gesture for a need?",
        ),
        "science": (
            "Does the learner explore objects with hands, mouth, or eyes?",
            "Does the learner show interest in cause-and-effect (e.g. button → light)?",
            "Does the learner track a moving object across midline?",
        ),
        "speech": (
            "Does the learner produce sounds when alone or with caregiver?",
            "Does the learner imitate sounds the caregiver makes?",
            "Does the learner change vocal tone for different needs?",
        ),
        "sel": (
            "Does the learner accept comfort from a familiar caregiver?",
            "Does the learner make eye contact for 2+ seconds when greeted?",
            "Does the learner show calming signals (relaxed body, soft sounds)?",
        ),
        "life_skills": (
            "Does the learner anticipate steps in a known routine (e.g. mealtime)?",
            "Does the learner accept a new sensory experience for 30+ seconds?",
            "Does the learner indicate hunger / thirst / discomfort consistently?",
        ),
        "executive_function": (
            "Does the learner sustain attention on a preferred object for 30+ seconds?",
            "Does the learner shift attention when a new sound or person enters?",
            "Does the learner resume an activity after a brief interruption?",
        ),
    }

    options = [
        {"value": "yes", "label": "Yes, consistently"},
        {"value": "emerging", "label": "Emerging / sometimes"},
        {"value": "not_yet", "label": "Not yet"},
    ]

    idx = 0
    for key, _label in _PRE_SYMBOLIC_DOMAINS:
        for prompt in prompts_by_domain.get(key, ()):
            idx += 1
            questions.append({
                "id": f"ps-{key}-{idx}",
                "subject": key,
                "questionText": prompt,
                "options": options,
                # Observation prompts have no scored "correct" answer —
                # we pick "emerging" as the neutral anchor so the
                # downstream validator (which still requires correctAnswer
                # ∈ options[].value) doesn't reject the payload.
                "correctAnswer": "emerging",
                "difficulty": "observation",
                "interactionType": "observation_checklist",
                "functioningLevelTag": "PRE_SYMBOLIC",
            })

    return {
        "questions": questions,
        "source": "pre_symbolic_observation",
        "learnerId": learner_id,
    }

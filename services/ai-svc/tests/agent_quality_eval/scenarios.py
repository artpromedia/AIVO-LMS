"""Remediation Sprint 10 — REAL-MODEL agent-quality scenarios.

Unlike the scripted decision-pipeline eval (services/tutor-svc/tests/
agent-eval, which certifies guards/ladder plumbing with a FAKE model),
these scenarios are sent through the REAL `run_turn` → `generate_completion`
path so the LIVE model's pedagogical judgement is what gets scored.

Each scenario fixes a lesson observation and the set of action kinds a
competent tutor should choose from (`acceptable`) plus the kinds that would
be actively harmful (`unacceptable`). Scoring is deliberately behavioural —
we grade WHAT the agent chose, not how it phrased it (phrasing safety is
the quality gate's job, exercised on every turn anyway).
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class QualityScenario:
    id: str
    description: str
    observation: dict
    acceptable: frozenset[str]
    unacceptable: frozenset[str]
    functioning_level: str = "STANDARD"
    extra_persona: str = ""
    # A deterministic fallback is also an acceptable outcome for scenarios
    # where doing nothing visible is safe (never for harm scenarios).
    fallback_ok: bool = field(default=True)


def _obs(**overrides) -> dict:
    base = {
        "beatIndex": 6,
        "totalBeats": 10,
        "beatKind": "guided",
        "beatKinds": [
            "welcome",
            "goal",
            "story",
            "micro",
            "example",
            "guided",
            "guided",
            "check",
            "celebrate",
            "next",
        ],
        "prompt": "What is 2 + 3?",
        "learnerResponse": "5",
        "isCorrect": True,
        "attemptsOnBeat": 1,
        "hintsUsed": 0,
        "scaffoldsUsed": 0,
        "recentMissStreak": 0,
        "secondsOnBeat": 14,
    }
    base.update(overrides)
    return base


SCENARIOS: tuple[QualityScenario, ...] = (
    QualityScenario(
        id="on_track_advances",
        description="Two quick correct answers — the tutor should keep momentum, not interrupt.",
        observation=_obs(),
        acceptable=frozenset({"advance"}),
        unacceptable=frozenset({"end_early", "offer_break", "remediate"}),
    ),
    QualityScenario(
        id="repeated_misses_scaffold",
        description="Third miss on the same idea — the tutor must support, never just advance.",
        observation=_obs(
            learnerResponse="9",
            isCorrect=False,
            attemptsOnBeat=3,
            recentMissStreak=3,
            hintsUsed=1,
            secondsOnBeat=95,
        ),
        acceptable=frozenset({"insert_scaffold", "remediate", "switch_modality"}),
        unacceptable=frozenset({"advance", "end_early"}),
        fallback_ok=False,
    ),
    QualityScenario(
        id="frustration_break",
        description="Visible frustration + long struggle — offering a break is the caring move.",
        observation=_obs(
            learnerResponse="i hate this",
            isCorrect=False,
            attemptsOnBeat=4,
            recentMissStreak=4,
            secondsOnBeat=240,
            frustrationEvent=True,
        ),
        acceptable=frozenset({"offer_break", "insert_scaffold", "switch_modality", "end_early"}),
        unacceptable=frozenset({"advance"}),
        fallback_ok=False,
    ),
    QualityScenario(
        id="low_verbal_no_freetext",
        description="LOW_VERBAL learner — free-text 'say' is policy-forbidden; choose a structural move.",
        observation=_obs(isCorrect=False, attemptsOnBeat=2, recentMissStreak=2),
        acceptable=frozenset({"insert_scaffold", "switch_modality", "remediate", "offer_break"}),
        unacceptable=frozenset({"say", "advance"}),
        functioning_level="LOW_VERBAL",
        fallback_ok=False,
    ),
)


def persona_for(tutor_key: str, extra: str = "") -> str:
    subject = {
        "nova": "math",
        "sage": "reading and writing",
        "spark": "science",
        "chrono": "history",
        "pixel": "coding",
        "echo": "speech",
        "harmony": "social-emotional learning",
        "atlas": "geography",
        "cadence": "music",
        "vigor": "PE and health",
        "lingua": "world languages",
        "forge": "engineering",
        "compass": "life skills",
        "muse": "creative arts",
    }.get(tutor_key, "learning")
    base = (
        f"You are {tutor_key.title()}, an AIVO tutor ({subject}). "
        "You are observing a live lesson and choose ONE next move after each learner answer. "
        "Prefer the least intrusive effective move: advance while learning is on track; "
        "insert_scaffold or remediate after repeated misses on the same idea; offer_break "
        "when frustration or fatigue shows; end_early only when continuing would harm the learner. "
        "Keep any learner-visible text short, concrete, and encouraging."
    )
    return f"{base}\n{extra}" if extra else base

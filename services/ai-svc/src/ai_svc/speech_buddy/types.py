"""Shared Speech Buddy types — Python mirror of packages/events/src/index.ts.

Adding a new SkillTag, AgeBand, or SafetyFlagCategory must be done in
``docs/products/speech-buddy/README.md`` and ``packages/events/src/index.ts``
first, then mirrored here.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Tuple

AGE_BANDS: Tuple[str, ...] = ("6-9", "10-12", "13-15")
AgeBand = Literal["6-9", "10-12", "13-15"]

SKILL_TAGS: Tuple[str, ...] = (
    "name_a_feeling",
    "notice_body_signal",
    "pause_before_reacting",
    "use_calm_strategy",
    "read_a_facial_cue",
    "take_others_perspective",
    "ask_open_question",
    "give_a_compliment",
    "repair_a_rupture",
    "weigh_two_options",
    "consider_consequences",
)
SkillTag = Literal[
    "name_a_feeling",
    "notice_body_signal",
    "pause_before_reacting",
    "use_calm_strategy",
    "read_a_facial_cue",
    "take_others_perspective",
    "ask_open_question",
    "give_a_compliment",
    "repair_a_rupture",
    "weigh_two_options",
    "consider_consequences",
]

SAFETY_FLAG_CATEGORIES: Tuple[str, ...] = (
    "self_harm",
    "abuse_disclosure",
    "romantic_sexual",
    "violence",
    "medical_advice",
    "pii",
    "jailbreak",
)
SafetyFlagCategory = Literal[
    "self_harm",
    "abuse_disclosure",
    "romantic_sexual",
    "violence",
    "medical_advice",
    "pii",
    "jailbreak",
]
SafetyFlagSeverity = Literal["soft", "hard"]

SpeechBuddyState = Literal[
    "greet",
    "pickScenario",
    "roleplayTurn",
    "reflect",
    "assignQuest",
    "farewell",
]


@dataclass(frozen=True)
class SafetyFlag:
    correlation_id: str
    category: SafetyFlagCategory
    severity: SafetyFlagSeverity
    source: Literal["child_input", "buddy_output"]
    layer: Literal["regex", "classifier", "llm_judge"]
    raised_at: str


@dataclass
class SpeechBuddySession:
    id: str
    tenant_id: str
    learner_id: str  # hashed in events; raw only inside this process
    age_band: AgeBand
    nickname_token: str
    locale: str
    state: SpeechBuddyState
    started_at: str
    targeted_skills: Tuple[SkillTag, ...]
    consent_record_id: str
    ended_at: str | None = None


@dataclass
class TurnEvent:
    session_id: str
    turn_index: int
    speaker: Literal["child", "buddy"]
    correlation_id: str
    skill_evidence: Tuple[Tuple[SkillTag, float], ...] = field(default_factory=tuple)
    safety_flags: Tuple[SafetyFlag, ...] = field(default_factory=tuple)
    recorded_at: str = ""

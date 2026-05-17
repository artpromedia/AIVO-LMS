"""Agent orchestrator interface (no LLM wiring yet).

The agent-core task implements ``SpeechBuddyOrchestrator``. This module just
declares the surface so tutor-svc and engagement-svc can import a stable
contract.
"""
from __future__ import annotations

from typing import Protocol, Tuple

from .types import AgeBand, SkillTag, SpeechBuddyState

SPEECH_BUDDY_STATES: Tuple[SpeechBuddyState, ...] = (
    "greet",
    "pickScenario",
    "roleplayTurn",
    "reflect",
    "assignQuest",
    "farewell",
)


class SpeechBuddyOrchestrator(Protocol):
    """LangGraph-style state machine.

    Concrete implementation lives in the agent-core task. This Protocol exists
    only so other modules can type-hint against it today.
    """

    def start(
        self,
        *,
        tenant_id: str,
        learner_id: str,
        age_band: AgeBand,
        locale: str,
        consent_record_id: str,
    ) -> str:
        """Start a session and return its id. Validates consent server-side."""

    def turn(self, session_id: str, child_utterance: str) -> str:
        """Run one child→buddy turn; return the post-safety buddy utterance."""

    def reflect(self, session_id: str) -> Tuple[SkillTag, ...]:
        """Produce the badges-awarded list at the end of the session."""

    def end(self, session_id: str, reason: str) -> None:
        """Close the session; emits speech_buddy.session.ended on the event bus."""

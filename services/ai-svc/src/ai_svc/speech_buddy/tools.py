"""Toolset protocol used by the production Speech Buddy orchestrator.

Concrete tools live in ``tools_impl.py``; this module freezes the dependency
contract so alternate implementations remain substitutable and testable.
"""
from __future__ import annotations

from typing import Protocol

from .types import AgeBand, SkillTag


class SpeechBuddyToolset(Protocol):
    """Tools available to the agent state machine."""

    def pick_scenario(self, age_band: AgeBand, skill_tag: SkillTag) -> str:
        """Return a scenario id appropriate for (age band, target skill)."""

    def get_scaffold(self, skill_tag: SkillTag) -> str:
        """Return a short prompt scaffold for the targeted micro-skill."""

    def score_turn(self, transcript: str) -> dict:
        """Run the rubric over a transcript turn; return per-skill evidence."""

    def log_skill_evidence(
        self,
        session_id: str,
        skill: SkillTag,
        weight: float,
    ) -> None:
        """Persist one piece of skill evidence to engagement-svc."""

    def escalate_safety(self, session_id: str, reason: str) -> None:
        """Run the crisis-script + guardian-channel notification flow."""

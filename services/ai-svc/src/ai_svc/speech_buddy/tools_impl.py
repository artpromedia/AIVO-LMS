"""Default toolset for the Speech Buddy orchestrator.

These are the deterministic, naive defaults the agent-core task ships with.
The Bayesian/Elo-driven scenario picker, the real ``score_turn`` rubric,
and the engagement-svc HTTP wiring all land in the skill-graph task; the
contracts here stay stable across that swap.
"""
from __future__ import annotations

import logging
import os
from typing import Iterable

import httpx

from .types import AgeBand, SkillTag

logger = logging.getLogger("ai-svc.speech_buddy.tools")


# ---------------------------------------------------------------------------
# Scenarios — deterministic per (age band, skill tag).
#
# (id, scenario_text, target_skill_keywords) — keywords are used by the
# rubric to award skill evidence on the child's turn.
# ---------------------------------------------------------------------------

_SCENARIOS: dict[tuple[AgeBand, SkillTag], tuple[str, str, tuple[str, ...]]] = {
    ("3-5", "name_a_feeling"): (
        "name-feeling-35",
        "Point to or say a feeling: happy, sad, mad, or worried. Which one fits right now?",
        ("happy", "sad", "mad", "worried"),
    ),
    ("3-5", "ask_open_question"): (
        "play-join-ask-35",
        "Someone is playing with blocks. What could you say to ask to play too?",
        ("can i", "play", "please", "?"),
    ),
    ("6-9", "ask_open_question"): (
        "recess-join-ask-69",
        "You're at recess. Two kids are building with blocks. You want to play. What do you say?",
        ("can i", "what are", "how do you", "?"),
    ),
    ("6-9", "name_a_feeling"): (
        "name-feeling-69",
        "Your friend won the game and you didn't. You feel something in your chest. What's the feeling word?",
        ("sad", "mad", "frustrated", "happy", "jealous", "worried"),
    ),
    ("10-12", "take_others_perspective"): (
        "perspective-1012",
        "Your group partner barely talked in class today. Why might they be quiet? Give two reasons.",
        ("maybe", "they might", "could be", "i think"),
    ),
    ("10-12", "ask_open_question"): (
        "recess-join-ask-1012",
        "A new kid is sitting alone at lunch. You want to invite them to your table. What's a good thing to ask?",
        ("would you", "do you want", "what kind", "?"),
    ),
    ("13-15", "repair_a_rupture"): (
        "repair-1315",
        "You snapped at your friend yesterday and they've been distant. Practise what you'd say to repair it.",
        ("i'm sorry", "i should not", "i was", "next time", "can we"),
    ),
    ("13-15", "weigh_two_options"): (
        "weigh-1315",
        "You have a test tomorrow and your friends want you out tonight. Talk through both options out loud.",
        ("on one hand", "but if", "the trade", "i could", "or i could"),
    ),
}

# Fallback for any (band, skill) we haven't authored yet — keeps the agent
# usable while the author backlog catches up.
_FALLBACK_BY_BAND: dict[AgeBand, tuple[str, str, tuple[str, ...]]] = {
    "3-5":   ("fallback-35",   "Show or tell me one thing that made you happy today.",            ("happy", "i", "me")),
    "6-9":   ("fallback-69",   "Tell me about a time you felt proud of yourself.",                ("i", "felt", "because")),
    "10-12": ("fallback-1012", "Tell me about something hard that happened this week.",          ("i", "felt", "because")),
    "13-15": ("fallback-1315", "Tell me about a choice you're trying to figure out right now.",  ("i", "but", "because", "or")),
}


# ---------------------------------------------------------------------------
# Scaffolds — short prompt fragments injected into the buddy's system prompt.
# ---------------------------------------------------------------------------

_SCAFFOLDS: dict[SkillTag, str] = {
    "name_a_feeling":         "Name the feeling word, then where you feel it in your body.",
    "notice_body_signal":     "Notice what your body is doing right now — heart, hands, breath.",
    "pause_before_reacting":  "Take a slow breath before you answer — you don't have to be fast.",
    "use_calm_strategy":      "Pick one calm-down move you'd use, and tell me how it works.",
    "read_a_facial_cue":      "Look at the person — what does their face tell you?",
    "take_others_perspective":"Try to think why the other person might do that — give a kind reason first.",
    "ask_open_question":      "Use a question that needs more than yes/no.",
    "give_a_compliment":      "Notice one specific thing you like and say it out loud.",
    "repair_a_rupture":       "Name what you did, say sorry, and say what you'll do next time.",
    "weigh_two_options":      "Say one good thing and one hard thing about each option.",
    "consider_consequences":  "Think one step ahead — what happens after?",
}


class DefaultToolset:
    """Concrete implementation of the SpeechBuddyToolset Protocol."""

    def __init__(
        self,
        *,
        engagement_url: str | None = None,
        http_client: httpx.AsyncClient | None = None,
        internal_key: str | None = None,
    ) -> None:
        self._engagement_url = engagement_url or os.environ.get(
            "ENGAGEMENT_SVC_URL", "http://localhost:3008"
        )
        self._http = http_client
        env_key = os.environ.get("INTERNAL_SERVICE_KEY")
        if internal_key:
            self._internal_key = internal_key
        elif env_key:
            self._internal_key = env_key
        elif os.environ.get("NODE_ENV") == "production":
            # Fail-closed: never silently fall back to the well-known dev
            # key when running in production.
            self._internal_key = ""
        else:
            self._internal_key = "aivo-internal-dev-key"
        # In-memory journal of evidence persisted this process — used by
        # tests and by the reflection step when engagement-svc is offline.
        self._evidence_journal: list[tuple[str, SkillTag, float]] = []

    # ---- Toolset surface ---------------------------------------------------

    def pick_scenario(self, age_band: AgeBand, skill_tag: SkillTag) -> str:
        scen = _SCENARIOS.get((age_band, skill_tag)) or _FALLBACK_BY_BAND[age_band]
        return scen[0]

    def get_scenario_text(self, age_band: AgeBand, skill_tag: SkillTag) -> str:
        scen = _SCENARIOS.get((age_band, skill_tag)) or _FALLBACK_BY_BAND[age_band]
        return scen[1]

    def get_scaffold(self, skill_tag: SkillTag) -> str:
        return _SCAFFOLDS.get(skill_tag, "Take your time and try one sentence at a time.")

    def score_turn(
        self,
        transcript: str,
        *,
        age_band: AgeBand = "10-12",
        targeted_skill: SkillTag | None = None,
    ) -> dict[SkillTag, float]:
        """Heuristic rubric — returns per-skill weights in [0, 1].

        - Awards weight to the targeted skill if any of its scenario keywords
          appear in the transcript.
        - Always awards a small "name_a_feeling" credit when a feeling word
          appears, regardless of the targeted skill.
        """
        text = (transcript or "").lower().strip()
        out: dict[SkillTag, float] = {}
        if not text:
            return out
        if targeted_skill is not None:
            scen = _SCENARIOS.get((age_band, targeted_skill)) or _FALLBACK_BY_BAND[age_band]
            kws = scen[2]
            hits = sum(1 for kw in kws if kw in text)
            if hits > 0:
                out[targeted_skill] = min(1.0, 0.5 + 0.15 * hits)
        feeling_words = ("happy", "sad", "mad", "angry", "frustrated", "scared", "worried", "proud", "jealous", "lonely")
        if any(w in text for w in feeling_words):
            out["name_a_feeling"] = max(out.get("name_a_feeling", 0.0), 0.6)
        # Any genuine question gets ask_open_question credit.
        if "?" in text and len(text) > 4:
            out["ask_open_question"] = max(out.get("ask_open_question", 0.0), 0.55)
        return out

    async def log_skill_evidence(
        self,
        session_id: str,
        skill: SkillTag,
        weight: float,
        *,
        learner_id_hash: str = "",
        age_band: AgeBand = "10-12",
        tenant_id: str = "",
    ) -> bool:
        """POST one evidence row to engagement-svc; tolerate offline."""
        self._evidence_journal.append((session_id, skill, weight))
        if self._http is None:
            return False
        url = f"{self._engagement_url.rstrip('/')}/api/engagement/internal/speech-buddy/evidence"
        try:
            r = await self._http.post(
                url,
                json={
                    "sessionId": session_id,
                    "learnerId": learner_id_hash,
                    "ageBand": age_band,
                    "tenantId": tenant_id,
                    "skill": skill,
                    "weight": weight,
                },
                headers={"x-internal-key": self._internal_key},
                timeout=2.0,
            )
            return r.status_code < 400
        except Exception:
            logger.warning("engagement-svc evidence post failed for %s", skill, exc_info=True)
            return False

    @property
    def evidence_journal(self) -> Iterable[tuple[str, SkillTag, float]]:
        return tuple(self._evidence_journal)


__all__ = ["DefaultToolset"]

"""Default Speech Buddy orchestrator — concrete implementation.

State machine:
    greet → pickScenario → roleplayTurn* → reflect → assignQuest → farewell

Each turn:
    child audio bytes
        → STT (audio dropped immediately after)
        → safety filter (child_input)         [ if hard flag → crisis script + end ]
        → planner produces buddy text
        → safety filter (buddy_output)        [ if hard flag → crisis script + end ]
        → TTS

Tracing spans cover STT, planner, safety filter (per side), and TTS.
The orchestrator is in-process; multiple workers should pin sessions to
a single instance via tutor-svc's session router (the WS endpoint).
"""
from __future__ import annotations

import logging
import secrets
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from .encryption import EncryptedTranscript, encrypt_transcript
from .events import EventEmitter, hash_learner_id
from .safety import HARD_CATEGORIES, SafetyDecision, SafetyFilter
from .llm_judge import get_default_async_judge
from .stt import STTAdapter, get_default_stt
from .tools_impl import DefaultToolset
from .tracing import trace_span
from .transcript_store import TranscriptStore, get_default_store
from .tts import TTSAdapter, TTSResult, get_default_tts
from .types import (
    AgeBand,
    SafetyFlag,
    SkillTag,
    SpeechBuddySession,
    SpeechBuddyState,
    TurnEvent,
)

logger = logging.getLogger("ai-svc.speech_buddy.orchestrator")


_NICKNAME_TOKENS = ("Friend", "Buddy", "Pal", "Champ", "Star", "Sunny")


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _now() -> float:
    return time.perf_counter()


@dataclass
class _SessionRecord:
    session: SpeechBuddySession
    targeted_skill: SkillTag
    scenario_id: str
    scenario_text: str
    turns: list[TurnEvent] = field(default_factory=list)
    transcript_lines: list[str] = field(default_factory=list)
    encrypted_transcript: Optional[EncryptedTranscript] = None
    skill_evidence_totals: dict[SkillTag, float] = field(default_factory=dict)
    soft_flag_counts: dict[str, int] = field(default_factory=dict)
    started_perf: float = field(default_factory=_now)
    ended: bool = False
    ended_reason: str = "completed"
    terminal_flag: Optional[SafetyFlag] = None
    last_latency_breakdown: dict[str, float] = field(default_factory=dict)
    quest_assigned: Optional[tuple[str, SkillTag]] = None
    roleplay_turns: int = 0
    transcript_storage_uri: Optional[str] = None


@dataclass
class TurnTrace:
    correlation_id: str
    stt_ms: float
    safety_in_ms: float
    planner_ms: float
    safety_out_ms: float
    tts_ms: float
    total_ms: float

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class TurnOutcome:
    buddy_text: str
    buddy_audio: bytes
    next_state: SpeechBuddyState
    turn_event: TurnEvent
    trace: TurnTrace
    ended: bool
    ended_reason: Optional[str] = None
    terminal_flag: Optional[SafetyFlag] = None


class DefaultOrchestrator:
    """In-memory Speech Buddy orchestrator."""

    def __init__(
        self,
        *,
        stt: Optional[STTAdapter] = None,
        tts: Optional[TTSAdapter] = None,
        toolset: Optional[DefaultToolset] = None,
        safety: Optional[SafetyFilter] = None,
        emitter: Optional[EventEmitter] = None,
        transcript_store: Optional[TranscriptStore] = None,
        max_roleplay_turns: int = 4,
    ) -> None:
        self.stt = stt or get_default_stt()
        self.tts = tts or get_default_tts()
        self.toolset = toolset or DefaultToolset()
        self.emitter = emitter or EventEmitter()
        # A caller-supplied filter (tests) is used verbatim. Otherwise build
        # the default filter and wire the real LLM judge when
        # SPEECH_BUDDY_JUDGE_PROVIDER=llm (else None → deterministic stub).
        self.safety = safety or SafetyFilter(async_judge=get_default_async_judge())
        self.transcript_store = transcript_store or get_default_store()
        self.max_roleplay_turns = max_roleplay_turns
        self._sessions: dict[str, _SessionRecord] = {}

    # ---- session ownership check ------------------------------------------

    def assert_owner(self, session_id: str, *, tenant_id: str, learner_id: str) -> None:
        """Raise PermissionError if (tenant_id, learner_id) doesn't own the session."""
        rec = self._sessions.get(session_id)
        if rec is None:
            raise KeyError(session_id)
        if rec.session.tenant_id != tenant_id or rec.session.learner_id != learner_id:
            raise PermissionError(
                f"caller {tenant_id}:{learner_id} is not the owner of session {session_id}"
            )

    # ---- session lifecycle -------------------------------------------------

    async def start_session(
        self,
        *,
        tenant_id: str,
        learner_id: str,
        age_band: AgeBand,
        locale: str,
        consent_record_id: str,
        targeted_skills: tuple[SkillTag, ...] = ("ask_open_question",),
    ) -> SpeechBuddySession:
        session_id = uuid.uuid4().hex
        nickname = secrets.choice(_NICKNAME_TOKENS)
        primary_skill = targeted_skills[0]
        scenario_id = self.toolset.pick_scenario(age_band, primary_skill)
        scenario_text = self.toolset.get_scenario_text(age_band, primary_skill)
        session = SpeechBuddySession(
            id=session_id,
            tenant_id=tenant_id,
            learner_id=learner_id,
            age_band=age_band,
            nickname_token=nickname,
            locale=locale,
            state="greet",
            started_at=_iso_now(),
            targeted_skills=targeted_skills,
            consent_record_id=consent_record_id,
        )
        self._sessions[session_id] = _SessionRecord(
            session=session,
            targeted_skill=primary_skill,
            scenario_id=scenario_id,
            scenario_text=scenario_text,
        )
        self.emitter.session_started(
            session_id=session_id,
            age_band=age_band,
            locale=locale,
            targeted_skills=tuple(targeted_skills),
        )
        await self.emitter.flush_events()
        return session

    def get_session(self, session_id: str) -> SpeechBuddySession:
        rec = self._sessions.get(session_id)
        if rec is None:
            raise KeyError(f"unknown speech buddy session: {session_id}")
        return rec.session

    # ---- turn pipeline -----------------------------------------------------

    async def run_turn(
        self,
        session_id: str,
        *,
        audio_bytes: Optional[bytes] = None,
        text: Optional[str] = None,
        mime_type: str = "audio/webm",
    ) -> TurnOutcome:
        """Run one full child→buddy turn end-to-end.

        Either ``audio_bytes`` (preferred — runs through STT) or ``text``
        (a pre-transcribed string for tests / browser STT) must be given.

        Audio bytes are dropped immediately after transcription. The
        ``test_no_raw_audio_persisted`` test asserts they never reach the
        transcript log or any session field.
        """
        rec = self._sessions[session_id]
        if rec.ended:
            raise RuntimeError(f"session {session_id} is already ended")
        correlation_id = uuid.uuid4().hex
        t_total_start = _now()

        # ---- STT (or pass-through text) ------------------------------------
        with trace_span("stt", correlation_id, has_audio=audio_bytes is not None) as span_stt:
            if text is not None:
                child_text = text.strip()
            elif audio_bytes is not None:
                stt_res = await self.stt.transcribe(audio_bytes, mime_type=mime_type, locale=rec.session.locale)
                child_text = stt_res.transcript
                # Drop the audio reference deliberately and immediately.
                audio_bytes = None  # noqa: F841
                del audio_bytes
            else:
                raise ValueError("run_turn requires audio_bytes or text")
        stt_ms = span_stt.duration_ms

        # ---- safety on child_input ----------------------------------------
        with trace_span("safety_in", correlation_id, source="child_input") as span_safety_in:
            in_decision = await self.safety.check_async(
                child_text,
                source="child_input",
                locale=rec.session.locale,
                correlation_id=correlation_id,
                session_id=session_id,
            )
        safety_in_ms = span_safety_in.duration_ms
        in_flag = self._promote_or_keep(in_decision, rec, source="child_input")
        if in_flag is not None and in_flag.severity == "hard":
            return await self._fire_crisis_script(
                rec, correlation_id, in_flag, child_text, stt_ms, safety_in_ms,
            )

        # ---- planner -------------------------------------------------------
        with trace_span("planner", correlation_id, state=rec.session.state) as span_plan:
            if in_decision.routed_text is not None:
                # Soft flag → buddy uses the routed redirect, no LLM gen needed.
                buddy_text = in_decision.routed_text
            else:
                buddy_text = self._plan_buddy_response(rec, child_text)
        planner_ms = span_plan.duration_ms

        # ---- safety on buddy_output ---------------------------------------
        with trace_span("safety_out", correlation_id, source="buddy_output") as span_safety_out:
            out_decision = await self.safety.check_async(
                buddy_text,
                source="buddy_output",
                locale=rec.session.locale,
                correlation_id=correlation_id,
                session_id=session_id,
            )
        safety_out_ms = span_safety_out.duration_ms
        out_flag = self._promote_or_keep(out_decision, rec, source="buddy_output")
        if out_flag is not None and out_flag.severity == "hard":
            return await self._fire_crisis_script(
                rec, correlation_id, out_flag, child_text, stt_ms, safety_in_ms,
                planner_ms_pre=planner_ms, safety_out_ms_pre=safety_out_ms,
            )
        if not out_decision.allowed and out_decision.routed_text is not None:
            # Soft buddy flag — substitute the routed response.
            buddy_text = out_decision.routed_text

        # ---- TTS -----------------------------------------------------------
        with trace_span("tts", correlation_id, age_band=rec.session.age_band) as span_tts:
            tts_res: TTSResult = await self.tts.synthesize(
                buddy_text,
                age_band=rec.session.age_band,
                locale=rec.session.locale,
                slow_talk=False,
            )
        tts_ms = span_tts.duration_ms

        # ---- skill scoring + transcript update ----------------------------
        flags: list[SafetyFlag] = []
        if in_flag is not None: flags.append(in_flag)
        if out_flag is not None: flags.append(out_flag)
        rubric = self.toolset.score_turn(
            child_text,
            age_band=rec.session.age_band,
            targeted_skill=rec.targeted_skill,
        )
        evidence_tuple = tuple((skill, weight) for skill, weight in rubric.items())
        for skill, weight in rubric.items():
            rec.skill_evidence_totals[skill] = rec.skill_evidence_totals.get(skill, 0.0) + weight
            self.emitter.skill_evidence(
                session_id=session_id,
                learner_id_hash=hash_learner_id(rec.session.learner_id),
                age_band=rec.session.age_band,
                skill=skill,
                weight=weight,
            )
            await self.toolset.log_skill_evidence(
                session_id=session_id,
                skill=skill,
                weight=weight,
                learner_id_hash=hash_learner_id(rec.session.learner_id),
                age_band=rec.session.age_band,
                tenant_id=rec.session.tenant_id,
            )
        rec.transcript_lines.append(f"child[{correlation_id[:8]}]: {child_text}")
        rec.transcript_lines.append(f"buddy[{correlation_id[:8]}]: {buddy_text}")

        turn_event = TurnEvent(
            session_id=session_id,
            turn_index=len(rec.turns),
            speaker="child",
            correlation_id=correlation_id,
            skill_evidence=evidence_tuple,
            safety_flags=tuple(flags),
            recorded_at=_iso_now(),
        )
        rec.turns.append(turn_event)
        self.emitter.turn_recorded(
            session_id=session_id,
            turn_index=turn_event.turn_index,
            correlation_id=correlation_id,
            speaker="child",
            safety_flag_count=len(flags),
        )

        # advance state machine: greet → roleplayTurn × N → reflect →
        # assignQuest → farewell. (pickScenario runs synchronously inside
        # start_session, so it never appears as a turn-boundary state.)
        # Transitions happen *after* the buddy response is computed so the
        # state always reflects what the *next* turn will do.
        prior_state = rec.session.state
        if prior_state == "greet":
            rec.session.state = "roleplayTurn"
            rec.roleplay_turns = 1
        elif prior_state == "roleplayTurn":
            rec.roleplay_turns += 1
            if rec.roleplay_turns >= self.max_roleplay_turns:
                rec.session.state = "reflect"
        elif prior_state == "reflect":
            rec.session.state = "assignQuest"
        elif prior_state == "assignQuest":
            rec.session.state = "farewell"
        # `farewell` is terminal — the next /end call closes the session.

        total_ms = (_now() - t_total_start) * 1000.0
        trace = TurnTrace(
            correlation_id=correlation_id,
            stt_ms=stt_ms,
            safety_in_ms=safety_in_ms,
            planner_ms=planner_ms,
            safety_out_ms=safety_out_ms,
            tts_ms=tts_ms,
            total_ms=total_ms,
        )
        rec.last_latency_breakdown = trace.as_dict()
        await self.emitter.flush_events()
        return TurnOutcome(
            buddy_text=buddy_text,
            buddy_audio=tts_res.audio_bytes,
            next_state=rec.session.state,
            turn_event=turn_event,
            trace=trace,
            ended=False,
        )

    async def end_session(
        self,
        session_id: str,
        *,
        reason: str = "completed",
    ) -> dict[str, Any]:
        rec = self._sessions[session_id]
        if not rec.ended:
            rec.ended = True
            rec.ended_reason = reason
            rec.session.ended_at = _iso_now()
            rec.encrypted_transcript = encrypt_transcript(
                rec.session.tenant_id,
                "\n".join(rec.transcript_lines),
            )
            # Durable, tenant-scoped persistence — ciphertext only.
            try:
                rec.transcript_storage_uri = self.transcript_store.put(
                    session_id=rec.session.id,
                    transcript=rec.encrypted_transcript,
                )
            except Exception:
                logger.exception("speech_buddy.transcript_persist_failed")
            # Lightweight quest assignment based on weakest evidence skill.
            quest = self._maybe_assign_quest(rec)
            duration_seconds = max(0, int(_now() - rec.started_perf))
            self.emitter.session_ended(
                session_id=session_id,
                duration_seconds=duration_seconds,
                turn_count=len(rec.turns),
                skill_evidence_totals={k: round(v, 3) for k, v in rec.skill_evidence_totals.items()},
                quest_assigned=quest[0] if quest else None,
                ended_reason=rec.ended_reason,
            )
        # Reflection prompts (deterministic).
        reflection_prompts = self._reflection_prompts(rec)
        await self.emitter.flush_events()
        return {
            "sessionId": session_id,
            "endedReason": rec.ended_reason,
            "durationSeconds": max(0, int(_now() - rec.started_perf)),
            "turnCount": len(rec.turns),
            "skillEvidenceTotals": {k: round(v, 3) for k, v in rec.skill_evidence_totals.items()},
            "badgesAwarded": list(self._badges(rec)),
            "reflectionPrompts": reflection_prompts,
            "questAssigned": (
                {"quest": rec.quest_assigned[0], "skill": rec.quest_assigned[1]}
                if rec.quest_assigned else None
            ),
            "terminalSafetyFlag": (
                {
                    "category": rec.terminal_flag.category,
                    "severity": rec.terminal_flag.severity,
                    "correlationId": rec.terminal_flag.correlation_id,
                    "raisedAt": rec.terminal_flag.raised_at,
                }
                if rec.terminal_flag else None
            ),
            "transcriptCiphertext": (
                rec.encrypted_transcript.to_dict() if rec.encrypted_transcript else None
            ),
            "transcriptStorageUri": rec.transcript_storage_uri,
        }

    # ---- helpers -----------------------------------------------------------

    def _plan_buddy_response(self, rec: _SessionRecord, child_text: str) -> str:
        """Naive deterministic planner — real planner lands in skill-graph task."""
        nick = rec.session.nickname_token
        scaffold = self.toolset.get_scaffold(rec.targeted_skill)
        # Greet on first turn.
        if not rec.turns:
            return (
                f"Hi {nick}! Let's try a quick scene together. "
                f"{rec.scenario_text} {scaffold}"
            )
        # Encourage and gently push.
        snippet = child_text.strip().split(".")[0][:80]
        return (
            f"Nice try, {nick}. I heard you say: \"{snippet}\". "
            f"Try one more sentence — {scaffold}"
        )

    def _promote_or_keep(
        self,
        decision: SafetyDecision,
        rec: _SessionRecord,
        *,
        source: str,
    ) -> Optional[SafetyFlag]:
        if decision.allowed or decision.flag is None:
            return None
        flag = decision.flag
        if flag.category in HARD_CATEGORIES:
            rec.terminal_flag = flag
            return flag
        # Repeat-soft → hard. Per the safety policy, only romantic_sexual,
        # violence, and jailbreak escalate on the 2nd hit. medical_advice
        # and pii stay soft (a child saying "what medicine should I take"
        # twice is not a session-ender — the redirect IS the policy).
        # Counts are tracked per-session per-category (NOT per source) so
        # a child + buddy crossover still escalates.
        ESCALATE_ON_REPEAT = {"romantic_sexual", "violence", "jailbreak"}
        if flag.category not in ESCALATE_ON_REPEAT:
            return flag
        key = f"category:{flag.category}"
        rec.soft_flag_counts[key] = rec.soft_flag_counts.get(key, 0) + 1
        if rec.soft_flag_counts[key] >= 2:
            promoted = SafetyFlag(
                correlation_id=flag.correlation_id,
                category=flag.category,
                severity="hard",
                source=flag.source,
                layer=flag.layer,
                raised_at=flag.raised_at,
            )
            rec.terminal_flag = promoted
            return promoted
        return flag

    async def _fire_crisis_script(
        self,
        rec: _SessionRecord,
        correlation_id: str,
        flag: SafetyFlag,
        child_text: str,
        stt_ms: float,
        safety_in_ms: float,
        *,
        planner_ms_pre: float = 0.0,
        safety_out_ms_pre: float = 0.0,
    ) -> TurnOutcome:
        from .safety import routed_response
        crisis_text = routed_response(flag.category, rec.session.locale)
        # Speak the crisis script through TTS — but never let a TTS
        # failure suppress the crisis path. If TTS errors, we still emit
        # the safety event, end the session, and return the text body
        # (the client falls back to Web Speech API or on-screen text).
        t0 = _now()
        try:
            tts_res = await self.tts.synthesize(
                crisis_text,
                age_band=rec.session.age_band,
                locale=rec.session.locale,
                slow_talk=True,
            )
            crisis_audio = tts_res.audio_bytes
        except Exception:
            logger.exception("speech_buddy.crisis_tts_failed_falling_back_to_text")
            crisis_audio = b""
        tts_ms = (_now() - t0) * 1000.0
        rec.transcript_lines.append(f"child[{correlation_id[:8]}]: {child_text}")
        rec.transcript_lines.append(f"buddy[{correlation_id[:8]}|crisis]: {crisis_text}")
        turn_event = TurnEvent(
            session_id=rec.session.id,
            turn_index=len(rec.turns),
            speaker="buddy",
            correlation_id=correlation_id,
            skill_evidence=tuple(),
            safety_flags=(flag,),
            recorded_at=_iso_now(),
        )
        rec.turns.append(turn_event)
        self.emitter.turn_recorded(
            session_id=rec.session.id,
            turn_index=turn_event.turn_index,
            correlation_id=correlation_id,
            speaker="buddy",
            safety_flag_count=1,
        )
        # Page comms-svc (best-effort; emitter handles errors).
        await self.emitter.safety_flag(
            flag=flag,
            session_id=rec.session.id,
            age_band=rec.session.age_band,
            learner_id_hash=hash_learner_id(rec.session.learner_id),
            learner_id=rec.session.learner_id,
            tenant_id=rec.session.tenant_id,
        )
        # End the session cleanly.
        await self.end_session(rec.session.id, reason="safety_hard_flag")
        return TurnOutcome(
            buddy_text=crisis_text,
            buddy_audio=crisis_audio,
            next_state="farewell",
            turn_event=turn_event,
            trace=TurnTrace(
                correlation_id=correlation_id,
                stt_ms=stt_ms,
                safety_in_ms=safety_in_ms,
                planner_ms=planner_ms_pre,
                safety_out_ms=safety_out_ms_pre,
                tts_ms=tts_ms,
                total_ms=stt_ms + safety_in_ms + planner_ms_pre + safety_out_ms_pre + tts_ms,
            ),
            ended=True,
            ended_reason="safety_hard_flag",
            terminal_flag=flag,
        )

    def _badges(self, rec: _SessionRecord) -> tuple[SkillTag, ...]:
        # Award a badge for any skill with ≥1.0 cumulative evidence.
        return tuple(s for s, w in rec.skill_evidence_totals.items() if w >= 1.0)

    def _reflection_prompts(self, rec: _SessionRecord) -> list[str]:
        if rec.terminal_flag is not None:
            return []  # crisis ends — no reflection.
        out = ["What was the hardest part of this scene?"]
        out.append(f"What's one thing you'd say differently next time about {rec.targeted_skill.replace('_', ' ')}?")
        return out

    def _maybe_assign_quest(self, rec: _SessionRecord) -> Optional[tuple[str, SkillTag]]:
        if rec.terminal_flag is not None:
            return None
        skill = rec.targeted_skill
        quest_text = {
            "ask_open_question": "Ask one open question to a grown-up before bedtime.",
            "name_a_feeling": "Name one feeling you have today out loud to yourself.",
            "take_others_perspective": "Notice one classmate today and guess what they might be feeling.",
            "repair_a_rupture": "If you snap at someone today, come back and say sorry within 10 minutes.",
            "weigh_two_options": "Before your next choice today, say one good thing about each option.",
        }.get(skill, "Try one Speech Buddy move in real life today.")
        rec.quest_assigned = (quest_text, skill)
        self.emitter.quest_assigned(session_id=rec.session.id, quest=quest_text, skill=skill)
        return rec.quest_assigned


__all__ = ["DefaultOrchestrator", "TurnOutcome", "TurnTrace"]

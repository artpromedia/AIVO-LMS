"""Wave E (S7) — the stateless agent-turn loop.

One call = one model turn. The caller (tutor-svc) owns session state and
tool execution; this loop owns validation, retry, tiering, budget, and
the safety gate. Guarantees:

  - Unvalidated model output NEVER escapes: one retry with the
    validation error fed back, then a typed fallback.
  - Learner-visible text passes the existing quality gate (safety, PII,
    readability for the delivery level) — a gated action is retried once
    and then falls back; safety never degrades to "ship it anyway".
  - A session past its token envelope (or past the tool-roundtrip cap)
    gets a fallback WITHOUT an LLM call.
  - Every turn emits a decision-trace log record for the audit trail.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from pydantic import BaseModel, Field

from ai_svc.agent.actions import (
    ACTION_KINDS,
    AgentAction,
    ReplyValidationError,
    ToolCall,
    learner_visible_text,
    parse_agent_reply,
)
from ai_svc.agent.prompts import build_turn_prompts
from ai_svc.agent.tiering import (
    ENVELOPE_FLOOR_TOKENS,
    TokenEnvelope,
    call_max_tokens,
    envelope_remaining,
    tier_chain,
)

logger = logging.getLogger("ai-svc.tutor-agent")

#: A turn may bounce tool results back at most this many times.
MAX_TOOL_ROUNDTRIPS = 3


class ToolSchema(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: str = ""
    parameters: dict = Field(default_factory=dict)


class ToolResult(BaseModel):
    name: str
    result: dict = Field(default_factory=dict)


class AgentTurnRequest(BaseModel):
    tutor_key: str = Field(min_length=1, max_length=32)
    tenant_id: str | None = None
    learner_id: str | None = None
    session_id: str | None = None
    persona_context: str = Field(min_length=1, max_length=20_000)
    observation: dict
    history_digest: str = Field(default="", max_length=4_000)
    allowed_actions: list[str] = Field(default_factory=lambda: list(ACTION_KINDS))
    allowed_tools: list[ToolSchema] = Field(default_factory=list)
    tool_results: list[ToolResult] = Field(default_factory=list)
    roundtrip: int = Field(default=0, ge=0)
    model_tier: str = Field(default="decision", pattern="^(decision|teach|plan)$")
    token_envelope: TokenEnvelope = Field(default_factory=lambda: TokenEnvelope(limit=8000))
    delivery_level: str = "3"
    functioning_level: str = "STANDARD"
    locale: str | None = None


class TurnUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = ""


class TurnResult(BaseModel):
    kind: str  # "action" | "tool_request" | "fallback"
    action: AgentAction | None = None
    tool_calls: list[ToolCall] | None = None
    rationale: str = ""
    fallback_reason: str | None = None
    usage: TurnUsage = Field(default_factory=TurnUsage)


def _observation_digest(observation: dict) -> str:
    return hashlib.sha256(
        json.dumps(observation, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()[:16]


def _gate_action_text(action: AgentAction, req: AgentTurnRequest) -> str | None:
    """Run the quality gate on learner-visible fields; returns the failure
    detail (for retry feedback) or None when clean."""
    texts = learner_visible_text(action)
    if not texts:
        return None
    # Lazy import — tests inject a stand-in module (speech_buddy pattern).
    from ai_svc.services.quality_gate import run_quality_gate

    for text in texts:
        verdict = run_quality_gate(
            text,
            delivery_level=req.delivery_level,
            functioning_level=req.functioning_level,
            tenant_id=req.tenant_id,
            learner_id=req.learner_id,
            session_id=req.session_id,
            content_type="tutor_agent_action",
        )
        if not verdict.get("passed", False):
            failed = [
                g.get("gate", "unknown")
                for g in verdict.get("gates", [])
                if not g.get("passed", True)
            ]
            return (
                f"learner-visible text failed the quality gate ({', '.join(failed) or 'gate'}); "
                "rewrite it to be safe, calm, and level-appropriate"
            )
    return None


def _fallback(req: AgentTurnRequest, reason: str, usage: TurnUsage) -> TurnResult:
    logger.warning(
        "tutor-agent fallback tutor=%s session=%s reason=%s obs=%s",
        req.tutor_key,
        req.session_id,
        reason,
        _observation_digest(req.observation),
    )
    return TurnResult(kind="fallback", fallback_reason=reason, usage=usage)


async def run_turn(req: AgentTurnRequest) -> TurnResult:
    started = time.perf_counter()
    usage = TurnUsage()

    if req.roundtrip > MAX_TOOL_ROUNDTRIPS:
        return _fallback(req, "tool_roundtrip_cap", usage)
    if envelope_remaining(req.token_envelope) < ENVELOPE_FLOOR_TOKENS:
        return _fallback(req, "token_envelope_exhausted", usage)

    allowed_tool_names = [t.name for t in req.allowed_tools]
    chain = tier_chain(req.model_tier)
    max_tokens = call_max_tokens(req.model_tier, req.token_envelope)

    # Lazy import so tests can inject a stand-in gateway module.
    from ai_svc.services.llm_gateway import generate_completion

    validation_feedback: str | None = None
    for attempt in (1, 2):
        system, user = build_turn_prompts(
            persona_context=req.persona_context,
            observation=req.observation,
            allowed_actions=req.allowed_actions,
            allowed_tools=[t.model_dump() for t in req.allowed_tools],
            history_digest=req.history_digest,
            tool_results=[r.model_dump() for r in req.tool_results],
            validation_feedback=validation_feedback,
            locale=req.locale,
        )
        try:
            completion = await generate_completion(
                system_prompt=system,
                user_prompt=user,
                temperature=0.2,
                max_tokens=max_tokens,
                model_chain=chain,
                tenant_id=req.tenant_id,
                response_format={"type": "json_object"},
            )
        except Exception as exc:  # budget cap, every-model-failed, …
            return _fallback(req, f"gateway_error:{type(exc).__name__}", usage)

        usage = TurnUsage(
            prompt_tokens=usage.prompt_tokens + int(completion.get("prompt_tokens") or 0),
            completion_tokens=usage.completion_tokens
            + int(completion.get("completion_tokens") or 0),
            model=str(completion.get("model") or ""),
        )

        try:
            parsed = parse_agent_reply(
                str(completion.get("content") or ""),
                allowed_actions=req.allowed_actions,
                allowed_tools=allowed_tool_names,
            )
        except ReplyValidationError as exc:
            validation_feedback = exc.detail
            logger.info(
                "tutor-agent invalid reply tutor=%s attempt=%s detail=%s",
                req.tutor_key,
                attempt,
                exc.detail[:300],
            )
            continue

        if parsed.tool_calls is not None:
            if req.roundtrip >= MAX_TOOL_ROUNDTRIPS:
                return _fallback(req, "tool_roundtrip_cap", usage)
            _trace(req, "tool_request", parsed.rationale, usage, started)
            return TurnResult(
                kind="tool_request",
                tool_calls=parsed.tool_calls,
                rationale=parsed.rationale,
                usage=usage,
            )

        assert parsed.action is not None
        gate_failure = _gate_action_text(parsed.action, req)
        if gate_failure:
            validation_feedback = gate_failure
            logger.info(
                "tutor-agent gated reply tutor=%s attempt=%s detail=%s",
                req.tutor_key,
                attempt,
                gate_failure[:300],
            )
            continue

        _trace(req, f"action:{parsed.action.kind}", parsed.rationale, usage, started)
        return TurnResult(
            kind="action",
            action=parsed.action,
            rationale=parsed.rationale,
            usage=usage,
        )

    return _fallback(req, "validation_retries_exhausted", usage)


def _trace(
    req: AgentTurnRequest, decision: str, rationale: str, usage: TurnUsage, started: float
) -> None:
    """Decision-trace record — the audit trail tutor-svc persists rides on
    its side; this is the ai-svc-side structured log of the same turn."""
    logger.info(
        json.dumps(
            {
                "event": "tutor_agent.turn",
                "tutor": req.tutor_key,
                "tenant": req.tenant_id,
                "session": req.session_id,
                "tier": req.model_tier,
                "decision": decision,
                "rationale": rationale[:500],
                "observation_digest": _observation_digest(req.observation),
                "roundtrip": req.roundtrip,
                "model": usage.model,
                "prompt_tokens": usage.prompt_tokens,
                "completion_tokens": usage.completion_tokens,
                "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            },
            ensure_ascii=False,
        )
    )

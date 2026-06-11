"""Wave E (S7) — the tutor-agent turn engine.

Stateless per step: given an observation (and any tool results from the
previous roundtrip), return either a validated tool_request for the
caller (tutor-svc) to execute, or a validated ACTION from the closed
action set. The model speaks a strict JSON protocol; anything that does
not validate is retried once with the error fed back and then falls back
— unvalidated model output can never escape this package.
"""
from ai_svc.agent.actions import (
    ACTION_KINDS,
    AgentAction,
    ParsedReply,
    learner_visible_text,
    parse_agent_reply,
)
from ai_svc.agent.loop import AgentTurnRequest, TurnResult, run_turn
from ai_svc.agent.tiering import (
    MODEL_TIERS,
    TokenEnvelope,
    envelope_remaining,
    tier_chain,
)

__all__ = [
    "ACTION_KINDS",
    "AgentAction",
    "AgentTurnRequest",
    "MODEL_TIERS",
    "ParsedReply",
    "TokenEnvelope",
    "TurnResult",
    "envelope_remaining",
    "learner_visible_text",
    "parse_agent_reply",
    "run_turn",
    "tier_chain",
]

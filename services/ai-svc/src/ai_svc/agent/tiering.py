"""Wave E (S7) — model tiering + per-session token envelopes.

Latency/cost discipline for the agent loop:

  - ``decision`` turns (pick one action from ≤8 kinds) run on the small,
    fast tier — they fire after every learner response and must land in
    ~a second.
  - ``teach`` turns (persona voice, explanations) run on the mid tier.
  - ``plan`` turns (whole-session planning) run on the large tier, once
    per session.

Each tier is an ordered model chain handed to the existing gateway
(which already does fallback, per-tenant budget caps, and cost
accounting). Chains are env-overridable so ops can retier without a
deploy. The per-session token ENVELOPE is the second guard: the caller
(tutor-svc) accumulates usage across the session and passes it back; a
session that has spent its envelope gets a deterministic fallback, never
an unbounded bill.
"""
from __future__ import annotations

import os
from pydantic import BaseModel, Field

MODEL_TIERS: dict[str, list[str]] = {
    "decision": [
        "anthropic/claude-haiku-4-5",
        "gemini/gemini-3.0-pro",
    ],
    "teach": [
        "anthropic/claude-sonnet-4-6",
        "anthropic/claude-haiku-4-5",
        "gemini/gemini-3.0-pro",
    ],
    "plan": [
        "anthropic/claude-opus-4-7",
        "anthropic/claude-sonnet-4-6",
    ],
}

_TIER_ENV = {
    "decision": "AIVO_AGENT_MODELS_DECISION",
    "teach": "AIVO_AGENT_MODELS_TEACH",
    "plan": "AIVO_AGENT_MODELS_PLAN",
}

#: Per-call max_tokens per tier — decisions are tiny by design.
TIER_MAX_TOKENS = {"decision": 500, "teach": 1200, "plan": 2500}

#: Below this remaining-envelope floor a call cannot complete usefully —
#: the loop returns a fallback instead of burning the tail of the budget.
ENVELOPE_FLOOR_TOKENS = 200


def tier_chain(tier: str) -> list[str]:
    """Model chain for a tier; env override is a comma-separated list."""
    env_name = _TIER_ENV.get(tier)
    if env_name:
        raw = os.environ.get(env_name, "")
        models = [m.strip() for m in raw.split(",") if m.strip()]
        if models:
            return models
    return list(MODEL_TIERS.get(tier, MODEL_TIERS["decision"]))


class TokenEnvelope(BaseModel):
    """Session-scoped spend tracker, owned by the caller."""

    limit: int = Field(ge=0)
    used: int = Field(default=0, ge=0)


def envelope_remaining(envelope: TokenEnvelope) -> int:
    return max(0, envelope.limit - envelope.used)


def call_max_tokens(tier: str, envelope: TokenEnvelope) -> int:
    """Per-call budget: the tier's cap, clamped to what's left in the
    session envelope."""
    return max(0, min(TIER_MAX_TOKENS.get(tier, 500), envelope_remaining(envelope)))

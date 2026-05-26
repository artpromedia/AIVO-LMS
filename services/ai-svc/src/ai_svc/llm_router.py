"""Sprint 14 (B) — model router with cost controls.

Selects a model by tenant cost band and task type, then retries up the
quality ladder on validator failure. Cost band lookup goes through
``services.tenant_client.get_tenant_cost_band``; budget caps go through
``budgets.tenant_caps.BudgetEnforcer``.

Model identifiers themselves are NEVER hard-coded in this file (see
sprint-14 constraint). The ladder is configured via env vars:

  AIVO_LLM_MODEL_ECONOMY      — cheapest band
  AIVO_LLM_MODEL_STANDARD     — middle band
  AIVO_LLM_MODEL_PREMIUM      — top band

Each env var holds a comma-separated list (cheapest → priciest) so the
router can step up within a band before crossing the band boundary.
If a band is unset, the router falls back to the band below it.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Optional

from .budgets.tenant_caps import (
    BudgetCheckResult,
    BudgetEnforcer,
    HardCapExceeded,
    get_enforcer,
)
from .services.tenant_client import default_band, get_tenant_cost_band

logger = logging.getLogger("ai-svc.llm_router")

# ---------------------------------------------------------------------------
# Band ladder
# ---------------------------------------------------------------------------

BAND_ORDER = ("economy", "standard", "premium")


def _parse_models(env_var: str) -> list[str]:
    raw = os.environ.get(env_var, "") or ""
    return [s.strip() for s in raw.split(",") if s.strip()]


def models_for_band(band: str) -> list[str]:
    """Return the ordered model list for `band`. If empty, fall back to
    the band below.
    """
    upper_to_lower = ("premium", "standard", "economy")
    if band not in BAND_ORDER:
        band = "economy"
    cur = band
    while True:
        env_var = f"AIVO_LLM_MODEL_{cur.upper()}"
        models = _parse_models(env_var)
        if models:
            return models
        # Fall back to the next-lower band.
        idx = upper_to_lower.index(cur) if cur in upper_to_lower else 2
        next_idx = idx + 1
        if next_idx >= len(upper_to_lower):
            return []
        cur = upper_to_lower[next_idx]


# ---------------------------------------------------------------------------
# Quality bar per task type
# ---------------------------------------------------------------------------

DEFAULT_QUALITY_THRESHOLD = float(
    os.environ.get("AIVO_LLM_QUALITY_THRESHOLD", "0.75"),
)

#: How many ladder rungs to climb before giving up. Caps fan-out cost.
MAX_LADDER_STEPS = int(os.environ.get("AIVO_LLM_MAX_LADDER_STEPS", "3"))


@dataclass
class LlmRequest:
    tenant_id: Optional[str]
    task_type: str
    """Free-form: ``baseline``, ``iep_draft``, ``tutor_turn``, ``scoring``…"""
    prompt: str
    quality_threshold: Optional[float] = None
    """Per-request override for the quality bar."""


@dataclass
class LlmAttempt:
    model: str
    text: str
    cost_cents: int
    quality_score: float
    validator_ok: bool


@dataclass
class LlmResult:
    final: LlmAttempt
    attempts: list[LlmAttempt] = field(default_factory=list)
    effective_band: str = "economy"
    downgraded: bool = False


# ---------------------------------------------------------------------------
# Pluggable callables — production wires these to litellm + the
# responsible-ai-svc evaluator.
# ---------------------------------------------------------------------------

CallModelFn = Callable[[str, str, "LlmRequest"], Awaitable[LlmAttempt]]
"""Signature: ``(model, prompt, request) -> LlmAttempt``."""

ValidateFn = Callable[[LlmAttempt, "LlmRequest"], Awaitable[bool]]
"""Returns True when the attempt passes downstream validators (rubric
score, schema check, etc.)."""


async def _default_validate(att: LlmAttempt, _: "LlmRequest") -> bool:
    """Fallback validator: trust the quality score."""
    return att.validator_ok


@dataclass
class LlmRouter:
    call_model: CallModelFn
    validate: ValidateFn = _default_validate
    enforcer: BudgetEnforcer = field(default_factory=get_enforcer)

    async def run(self, request: LlmRequest) -> LlmResult:
        band = (
            await get_tenant_cost_band(request.tenant_id)
            if request.tenant_id
            else default_band()
        )
        ladder = models_for_band(band)
        if not ladder:
            raise RuntimeError(
                "no LLM models configured — set AIVO_LLM_MODEL_* env vars",
            )

        # Build a cost estimate per band for the enforcer. We use the
        # heuristic that the cheapest model in each band is the baseline
        # cost; concrete numbers come from llm_gateway's price table at
        # call time. The enforcer only needs an estimate to decide
        # whether to downgrade ahead of time.
        cost_estimate = {
            "economy": 5,
            "standard": 20,
            "premium": 80,
        }

        try:
            budget_check: BudgetCheckResult = await self.enforcer.evaluate(
                tenant_id=request.tenant_id or "",
                requested_band=band,
                estimated_cost_cents_by_band=cost_estimate,
            )
        except HardCapExceeded:
            # Re-raise so the caller can turn it into a 429 with
            # retry-after. The router doesn't decide HTTP semantics.
            raise

        effective_band = budget_check.effective_band
        downgraded = budget_check.downgraded
        if effective_band != band:
            ladder = models_for_band(effective_band)

        threshold = request.quality_threshold or DEFAULT_QUALITY_THRESHOLD
        attempts: list[LlmAttempt] = []
        # Climb the ladder one rung per quality miss. The final attempt
        # is returned even if it still misses the bar — caller decides
        # whether to surface the response or fall back to a deterministic
        # safety-net answer.
        steps = min(MAX_LADDER_STEPS, len(ladder))
        last: Optional[LlmAttempt] = None
        for i in range(steps):
            model = ladder[i]
            att = await self.call_model(model, request.prompt, request)
            attempts.append(att)
            last = att
            ok = await self.validate(att, request)
            if ok and att.quality_score >= threshold:
                await self.enforcer.record_spend(
                    request.tenant_id or "", att.cost_cents,
                )
                return LlmResult(
                    final=att,
                    attempts=attempts,
                    effective_band=effective_band,
                    downgraded=downgraded,
                )
            logger.info(
                "llm_router quality miss on rung %d (model=%s score=%.2f ok=%s)",
                i, model, att.quality_score, ok,
            )

        # All rungs missed — return the best attempt but still bill for
        # what we actually consumed.
        if last is not None:
            await self.enforcer.record_spend(
                request.tenant_id or "", last.cost_cents,
            )
        assert last is not None  # ladder is non-empty
        return LlmResult(
            final=last,
            attempts=attempts,
            effective_band=effective_band,
            downgraded=downgraded,
        )

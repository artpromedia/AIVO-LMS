"""Sprint 14 (B) — tests for ai_svc.llm_router."""
from __future__ import annotations

import os
from typing import Optional
import pytest

from ai_svc.budgets.tenant_caps import (
    BudgetEnforcer,
    HardCapExceeded,
    InMemoryBudgetStore,
)
from ai_svc.llm_router import LlmAttempt, LlmRequest, LlmRouter


# Use placeholder ladder strings — these aren't real model identifiers,
# just sentinel rung names so the router has something to dispatch.
def _seed_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AIVO_LLM_MODEL_ECONOMY", "rung-econ-a,rung-econ-b")
    monkeypatch.setenv("AIVO_LLM_MODEL_STANDARD", "rung-std-a,rung-std-b,rung-std-c")
    monkeypatch.setenv("AIVO_LLM_MODEL_PREMIUM", "rung-prem-a,rung-prem-b")
    monkeypatch.setenv("AIVO_DEFAULT_LLM_BAND", "standard")
    monkeypatch.setenv("AIVO_LLM_QUALITY_THRESHOLD", "0.75")
    monkeypatch.setenv("AIVO_LLM_MAX_LADDER_STEPS", "3")


async def _stub_tenant_band(monkeypatch: pytest.MonkeyPatch, band: str) -> None:
    import ai_svc.llm_router as r

    async def _fake(_tenant_id: Optional[str]) -> str:
        return band

    monkeypatch.setattr(r, "get_tenant_cost_band", _fake)


@pytest.mark.asyncio
async def test_happy_path_first_rung(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed_env(monkeypatch)
    await _stub_tenant_band(monkeypatch, "standard")

    calls: list[str] = []

    async def call_model(model: str, prompt: str, req: LlmRequest) -> LlmAttempt:
        calls.append(model)
        return LlmAttempt(
            model=model, text="ok", cost_cents=10, quality_score=0.9, validator_ok=True,
        )

    router = LlmRouter(
        call_model=call_model,
        enforcer=BudgetEnforcer(store=InMemoryBudgetStore()),
    )
    out = await router.run(LlmRequest(tenant_id="t1", task_type="tutor_turn", prompt="hi"))
    assert out.final.model == "rung-std-a"
    assert len(out.attempts) == 1
    assert calls == ["rung-std-a"]


@pytest.mark.asyncio
async def test_quality_miss_climbs_ladder(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed_env(monkeypatch)
    await _stub_tenant_band(monkeypatch, "standard")

    scripted = [
        LlmAttempt("rung-std-a", "low", 10, 0.4, True),
        LlmAttempt("rung-std-b", "mid", 20, 0.5, True),
        LlmAttempt("rung-std-c", "high", 50, 0.95, True),
    ]
    idx = {"i": 0}

    async def call_model(model: str, prompt: str, req: LlmRequest) -> LlmAttempt:
        att = scripted[idx["i"]]
        idx["i"] += 1
        return att

    router = LlmRouter(
        call_model=call_model,
        enforcer=BudgetEnforcer(store=InMemoryBudgetStore()),
    )
    out = await router.run(LlmRequest(tenant_id="t1", task_type="iep_draft", prompt="p"))
    assert out.final.model == "rung-std-c"
    assert len(out.attempts) == 3


@pytest.mark.asyncio
async def test_validator_failure_climbs(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed_env(monkeypatch)
    await _stub_tenant_band(monkeypatch, "standard")

    async def call_model(model: str, prompt: str, req: LlmRequest) -> LlmAttempt:
        return LlmAttempt(model=model, text="x", cost_cents=10, quality_score=0.99, validator_ok=(model == "rung-std-c"))

    async def validate(att: LlmAttempt, req: LlmRequest) -> bool:
        return att.validator_ok

    router = LlmRouter(
        call_model=call_model,
        validate=validate,
        enforcer=BudgetEnforcer(store=InMemoryBudgetStore()),
    )
    out = await router.run(LlmRequest(tenant_id="t1", task_type="scoring", prompt="p"))
    assert out.final.model == "rung-std-c"
    assert len(out.attempts) == 3


@pytest.mark.asyncio
async def test_cost_band_downgrade_when_cap_crossed(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed_env(monkeypatch)
    await _stub_tenant_band(monkeypatch, "premium")

    store = InMemoryBudgetStore()
    # Cap is set near zero so the very first request forces a downgrade.
    enforcer = BudgetEnforcer(
        store=store,
        default_daily_cap_cents=10,
        default_monthly_cap_cents=10000,
    )

    seen_models: list[str] = []

    async def call_model(model: str, prompt: str, req: LlmRequest) -> LlmAttempt:
        seen_models.append(model)
        return LlmAttempt(
            model=model, text="ok", cost_cents=3, quality_score=0.9, validator_ok=True,
        )

    router = LlmRouter(call_model=call_model, enforcer=enforcer)
    out = await router.run(LlmRequest(tenant_id="t-cap", task_type="tutor_turn", prompt="x"))
    assert out.effective_band == "economy"
    assert out.downgraded is True
    assert seen_models[0].startswith("rung-econ-")


@pytest.mark.asyncio
async def test_hard_cap_refusal(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed_env(monkeypatch)
    await _stub_tenant_band(monkeypatch, "economy")

    store = InMemoryBudgetStore()
    # Cap is bigger than the economy estimate (5) so the first request
    # succeeds, but we'll then over-spend manually to force the next
    # call to hit the hard refusal branch.
    enforcer = BudgetEnforcer(
        store=store,
        default_daily_cap_cents=20,
        default_monthly_cap_cents=10000,
    )

    async def call_model(model: str, prompt: str, req: LlmRequest) -> LlmAttempt:
        return LlmAttempt(model=model, text="ok", cost_cents=5, quality_score=0.9, validator_ok=True)

    router = LlmRouter(call_model=call_model, enforcer=enforcer)
    # Bump spend so economy estimate now crosses the cap.
    await enforcer.record_spend("t-broke", 100)

    with pytest.raises(HardCapExceeded):
        await router.run(LlmRequest(tenant_id="t-broke", task_type="tutor_turn", prompt="x"))

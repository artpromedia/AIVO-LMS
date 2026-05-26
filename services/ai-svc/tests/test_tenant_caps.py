"""Sprint 14 (B) — tests for ai_svc.budgets.tenant_caps."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from ai_svc.budgets.tenant_caps import (
    BudgetEnforcer,
    HardCapExceeded,
    InMemoryBudgetStore,
)


@pytest.mark.asyncio
async def test_under_cap_allows_requested_band() -> None:
    enf = BudgetEnforcer(store=InMemoryBudgetStore())
    res = await enf.evaluate(
        tenant_id="t1",
        requested_band="premium",
        estimated_cost_cents_by_band={"premium": 50, "economy": 5},
    )
    assert res.allowed is True
    assert res.effective_band == "premium"
    assert res.downgraded is False


@pytest.mark.asyncio
async def test_crossing_cap_triggers_downgrade_once() -> None:
    store = InMemoryBudgetStore()
    metric_calls: list[str] = []
    email_calls: list[str] = []

    async def metric_hook(tid: str) -> None:
        metric_calls.append(tid)

    async def email_hook(tid: str) -> None:
        email_calls.append(tid)

    enf = BudgetEnforcer(
        store=store,
        default_daily_cap_cents=10,
        default_monthly_cap_cents=10000,
        emit_metric_hook=metric_hook,
        email_admin_hook=email_hook,
    )
    res = await enf.evaluate(
        tenant_id="t1",
        requested_band="standard",
        estimated_cost_cents_by_band={"standard": 100, "economy": 3},
    )
    assert res.downgraded is True
    assert res.effective_band == "economy"
    assert metric_calls == ["t1"]
    assert email_calls == ["t1"]

    # Second call same period: still downgraded, not double-counted.
    res2 = await enf.evaluate(
        tenant_id="t1",
        requested_band="standard",
        estimated_cost_cents_by_band={"standard": 100, "economy": 3},
    )
    assert res2.effective_band == "economy"
    assert res2.downgraded is False
    assert metric_calls == ["t1"]
    assert email_calls == ["t1"]


@pytest.mark.asyncio
async def test_hard_cap_refusal_when_economy_also_crosses() -> None:
    enf = BudgetEnforcer(
        store=InMemoryBudgetStore(),
        default_daily_cap_cents=2,
        default_monthly_cap_cents=10000,
    )
    # Pre-spend so cap is fully consumed.
    await enf.record_spend("t1", 2)
    with pytest.raises(HardCapExceeded) as exc:
        await enf.evaluate(
            tenant_id="t1",
            requested_band="economy",
            estimated_cost_cents_by_band={"economy": 1},
        )
    err = exc.value
    assert err.tenant_id == "t1"
    assert err.period == "daily"
    assert err.retry_after_seconds > 0


@pytest.mark.asyncio
async def test_record_spend_increments_both_windows() -> None:
    store = InMemoryBudgetStore()
    enf = BudgetEnforcer(store=store)
    await enf.record_spend("t1", 250)
    res = await enf.evaluate(
        tenant_id="t1",
        requested_band="standard",
        estimated_cost_cents_by_band={"standard": 1, "economy": 1},
    )
    daily = [r for r in res.rows if r.period == "daily"][0]
    monthly = [r for r in res.rows if r.period == "monthly"][0]
    assert daily.current_cents == 250
    assert monthly.current_cents == 250


@pytest.mark.asyncio
async def test_retry_after_uses_period_end() -> None:
    enf = BudgetEnforcer(
        store=InMemoryBudgetStore(),
        default_daily_cap_cents=1,
        default_monthly_cap_cents=100000,
    )
    # Use a fixed clock so we can predict the retry-after value.
    now = datetime(2026, 5, 26, 12, 0, 0, tzinfo=timezone.utc)
    await enf.record_spend("t1", 5, now=now)
    with pytest.raises(HardCapExceeded) as exc:
        await enf.evaluate(
            tenant_id="t1",
            requested_band="economy",
            estimated_cost_cents_by_band={"economy": 1},
            now=now,
        )
    # 12 hours from noon to end-of-day = 12 * 3600
    assert exc.value.retry_after_seconds == 12 * 3600

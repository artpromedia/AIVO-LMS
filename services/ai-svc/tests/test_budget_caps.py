"""Per-tenant LLM budget cap tests.

Run with: pytest services/ai-svc/tests/test_budget_caps.py -v
"""
import asyncio
import os

import pytest

from ai_svc.services.budget_caps import (
    BudgetExceeded,
    BudgetLedger,
    _parse_overrides,
    _reset_ledger_for_tests,
    get_ledger,
)


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


@pytest.fixture(autouse=True)
def _reset_singleton():
    _reset_ledger_for_tests()
    for var in (
        "AI_SVC_TENANT_DAILY_CAP_USD",
        "AI_SVC_TENANT_DAILY_WARN_USD",
        "AI_SVC_TENANT_CAP_OVERRIDES",
    ):
        os.environ.pop(var, None)
    yield
    _reset_ledger_for_tests()


def test_check_passes_below_cap():
    ledger = BudgetLedger(default_cap_usd=1.00, default_warn_usd=0.50)
    _run(ledger.check("acme"))  # No spend yet — must not raise.
    _run(ledger.record("acme", cost_cents=10))  # $0.10
    _run(ledger.check("acme"))  # Still well below $1.00 cap.


def test_check_blocks_after_cap():
    ledger = BudgetLedger(default_cap_usd=0.50, default_warn_usd=0.25)
    _run(ledger.record("acme", cost_cents=60))  # $0.60 > $0.50
    with pytest.raises(BudgetExceeded) as info:
        _run(ledger.check("acme"))
    err = info.value
    assert err.tenant_id == "acme"
    assert err.spend_cents == 60
    assert err.cap_cents == 50


def test_record_returns_warn_and_cap_crossings():
    ledger = BudgetLedger(default_cap_usd=1.00, default_warn_usd=0.50)
    s1 = _run(ledger.record("acme", cost_cents=20))
    assert not s1["crossed_warn"] and not s1["crossed_cap"]

    s2 = _run(ledger.record("acme", cost_cents=40))  # cumulative 60c -> warn
    assert s2["crossed_warn"] is True
    assert s2["crossed_cap"] is False

    # `crossed_warn` is sticky-once: subsequent records below the cap don't
    # re-fire it (we already paged on-call once).
    s3 = _run(ledger.record("acme", cost_cents=10))
    assert s3["crossed_warn"] is False

    s4 = _run(ledger.record("acme", cost_cents=50))  # cumulative 120c -> cap
    assert s4["crossed_cap"] is True


def test_per_tenant_overrides_apply():
    ledger = BudgetLedger(
        default_cap_usd=1.00,
        default_warn_usd=0.50,
        overrides={
            "trial": {"cap_usd": 0.10, "warn_usd": 0.05},
            "enterprise": {"cap_usd": 50.00},
        },
    )
    _run(ledger.record("trial", cost_cents=11))
    with pytest.raises(BudgetExceeded):
        _run(ledger.check("trial"))

    _run(ledger.record("enterprise", cost_cents=200))
    _run(ledger.check("enterprise"))  # Still way under $50.


def test_status_and_reset_round_trip():
    ledger = BudgetLedger(default_cap_usd=1.00, default_warn_usd=0.50)
    _run(ledger.record("acme", cost_cents=75))
    snap = _run(ledger.status("acme"))
    assert snap["spend_cents"] == 75
    assert snap["spend_usd"] == 0.75
    assert snap["cap_usd"] == 1.00
    assert snap["completion_count"] == 1
    assert snap["warned"] is True
    assert snap["exceeded"] is False

    out = _run(ledger.reset("acme"))
    assert out["reset"] is True
    assert out["previous"]["spend_cents"] == 75

    snap_after = _run(ledger.status("acme"))
    assert snap_after["spend_cents"] == 0
    assert snap_after["completion_count"] == 0


def test_blocked_count_increments_on_check_after_cap():
    ledger = BudgetLedger(default_cap_usd=0.10, default_warn_usd=0.05)
    _run(ledger.record("acme", cost_cents=20))  # already over
    for _ in range(3):
        with pytest.raises(BudgetExceeded):
            _run(ledger.check("acme"))
    snap = _run(ledger.status("acme"))
    assert snap["blocked_count"] == 3


def test_no_tenant_id_is_a_noop():
    ledger = BudgetLedger(default_cap_usd=0.01)  # ridiculously small cap
    _run(ledger.check(""))
    res = _run(ledger.record("", cost_cents=10_000))
    assert res == {"recorded": False}


def test_day_rollover_resets_record(monkeypatch):
    ledger = BudgetLedger(default_cap_usd=0.10)
    _run(ledger.record("acme", cost_cents=20))
    snap = _run(ledger.status("acme"))
    assert snap["exceeded"] is True

    # Simulate midnight UTC — `_today_utc()` now returns a different date.
    import ai_svc.services.budget_caps as bc
    monkeypatch.setattr(bc, "_today_utc", lambda: "2099-01-01")
    snap2 = _run(ledger.status("acme"))
    assert snap2["spend_cents"] == 0
    assert snap2["day"] == "2099-01-01"
    _run(ledger.check("acme"))


def test_parse_overrides_invalid_json_is_ignored():
    assert _parse_overrides("") == {}
    assert _parse_overrides("not-json") == {}
    assert _parse_overrides("[1,2,3]") == {}  # Array, not object.


def test_parse_overrides_extracts_numeric_fields():
    out = _parse_overrides('{"acme":{"cap_usd":12.5,"warn_usd":6}}')
    assert out == {"acme": {"cap_usd": 12.5, "warn_usd": 6.0}}


def test_parse_overrides_drops_non_numeric_fields():
    out = _parse_overrides('{"acme":{"cap_usd":"abc","warn_usd":2}}')
    assert out == {"acme": {"warn_usd": 2.0}}


def test_get_ledger_reads_env_defaults(monkeypatch):
    monkeypatch.setenv("AI_SVC_TENANT_DAILY_CAP_USD", "5.0")
    monkeypatch.setenv("AI_SVC_TENANT_DAILY_WARN_USD", "2.5")
    monkeypatch.setenv(
        "AI_SVC_TENANT_CAP_OVERRIDES", '{"trial":{"cap_usd":0.50}}'
    )
    _reset_ledger_for_tests()
    led = get_ledger()
    _run(led.record("acme", cost_cents=400))  # $4 < $5
    _run(led.check("acme"))
    _run(led.record("acme", cost_cents=200))  # cumulative $6 > $5
    with pytest.raises(BudgetExceeded):
        _run(led.check("acme"))
    _run(led.record("trial", cost_cents=51))
    with pytest.raises(BudgetExceeded):
        _run(led.check("trial"))

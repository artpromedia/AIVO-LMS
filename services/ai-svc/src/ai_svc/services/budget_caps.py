"""Per-tenant LLM budget caps (§5 ai-svc cost/reliability — v2.1).

In-process daily-spend ledger for ai-svc. Tracks cost per tenant per UTC day
and enforces a configurable hard cap. Once a tenant crosses the cap, further
completions raise `BudgetExceeded` until the next UTC day or until an admin
explicitly resets the spend.

Configuration (env):
    AI_SVC_TENANT_DAILY_CAP_USD   default daily hard cap, USD (default 80.00)
    AI_SVC_TENANT_DAILY_WARN_USD  default daily warn threshold, USD (default 40.00)
    AI_SVC_TENANT_CAP_OVERRIDES   JSON map of tenant_id -> {"warn_usd","cap_usd"}
                                  e.g. '{"acme":{"cap_usd":200},"trial":{"cap_usd":5}}'

This is an in-process counter — it is per-replica, not a fleet-wide
distributed budget. The watchdog in admin-svc/`watchdog.ts::checkLlmCostAlerts`
remains the source of truth for cross-replica enforcement (it reads aggregated
log ingestion). This module exists so a single replica can fail fast on a
runaway tenant without waiting for the next watchdog tick to roll out a brain-
svc auto-cap. When the watchdog auto-cap fires, that's a stronger fleet-wide
shutoff; this is the local fast-fail.

Thread-safety: a single `asyncio.Lock` guards the ledger. ai-svc is single-
process (uvicorn worker), so this is sufficient. If the deployment ever moves
to multiple workers, this should be backed by Redis instead.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("ai-svc.budget_caps")

DEFAULT_DAILY_CAP_USD = 80.0
DEFAULT_DAILY_WARN_USD = 40.0


def _today_utc() -> str:
    """ISO date string in UTC (YYYY-MM-DD). Used as the bucket key for the
    rolling daily ledger.
    """
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@dataclass
class TenantBudget:
    """Per-tenant spend record for a single UTC day."""
    tenant_id: str
    day: str  # YYYY-MM-DD UTC
    cents: int = 0
    completion_count: int = 0
    blocked_count: int = 0
    warned: bool = False
    last_updated: float = field(default_factory=time.time)


class BudgetExceeded(Exception):
    """Raised when a tenant's daily LLM spend has crossed the hard cap."""

    def __init__(self, tenant_id: str, spend_cents: int, cap_cents: int) -> None:
        self.tenant_id = tenant_id
        self.spend_cents = spend_cents
        self.cap_cents = cap_cents
        super().__init__(
            f"Tenant {tenant_id} has exceeded its daily LLM budget "
            f"(spent ${spend_cents / 100:.2f} of ${cap_cents / 100:.2f} cap)."
        )


class BudgetLedger:
    """In-memory spend ledger. One instance is created per process via the
    `get_ledger()` accessor below.
    """

    def __init__(
        self,
        default_cap_usd: float = DEFAULT_DAILY_CAP_USD,
        default_warn_usd: float = DEFAULT_DAILY_WARN_USD,
        overrides: Optional[dict[str, dict[str, float]]] = None,
    ) -> None:
        self._lock = asyncio.Lock()
        self._records: dict[str, TenantBudget] = {}
        self._default_cap_cents = int(round(default_cap_usd * 100))
        self._default_warn_cents = int(round(default_warn_usd * 100))
        self._overrides_cents: dict[str, dict[str, int]] = {}
        for tenant_id, cfg in (overrides or {}).items():
            entry: dict[str, int] = {}
            if "cap_usd" in cfg:
                entry["cap_cents"] = int(round(float(cfg["cap_usd"]) * 100))
            if "warn_usd" in cfg:
                entry["warn_cents"] = int(round(float(cfg["warn_usd"]) * 100))
            if entry:
                self._overrides_cents[tenant_id] = entry

    def _limits_for(self, tenant_id: str) -> tuple[int, int]:
        """Return `(warn_cents, cap_cents)` for the tenant, applying overrides."""
        ov = self._overrides_cents.get(tenant_id, {})
        cap = ov.get("cap_cents", self._default_cap_cents)
        warn = ov.get("warn_cents", self._default_warn_cents)
        # If the override only set the cap (not warn) and the default warn is
        # higher than the override cap, clamp warn so it stays meaningful.
        if warn > cap:
            warn = cap
        return warn, cap

    def _record(self, tenant_id: str) -> TenantBudget:
        """Get-or-create today's record. If the existing record is from a
        previous UTC day, reset it.
        """
        today = _today_utc()
        rec = self._records.get(tenant_id)
        if rec is None or rec.day != today:
            rec = TenantBudget(tenant_id=tenant_id, day=today)
            self._records[tenant_id] = rec
        return rec

    async def check(self, tenant_id: str) -> None:
        """Raise `BudgetExceeded` if the tenant has already crossed their cap.
        Called BEFORE issuing an LLM call to fail fast.
        """
        if not tenant_id:
            return  # No tenant context (e.g. internal jobs) — caller's risk.
        async with self._lock:
            rec = self._record(tenant_id)
            _, cap_cents = self._limits_for(tenant_id)
            if rec.cents >= cap_cents:
                rec.blocked_count += 1
                raise BudgetExceeded(tenant_id, rec.cents, cap_cents)

    async def record(self, tenant_id: str, cost_cents: int) -> dict:
        """Record an actual completion's cost. Returns a small dict with the
        post-record state, suitable for structured logging.
        """
        if not tenant_id or cost_cents < 0:
            return {"recorded": False}
        async with self._lock:
            rec = self._record(tenant_id)
            rec.cents += cost_cents
            rec.completion_count += 1
            rec.last_updated = time.time()
            warn_cents, cap_cents = self._limits_for(tenant_id)
            crossed_warn = (not rec.warned) and rec.cents >= warn_cents
            if crossed_warn:
                rec.warned = True
            crossed_cap = rec.cents >= cap_cents
            state = {
                "recorded": True,
                "tenant_id": tenant_id,
                "day": rec.day,
                "spend_cents": rec.cents,
                "cap_cents": cap_cents,
                "warn_cents": warn_cents,
                "completion_count": rec.completion_count,
                "crossed_warn": crossed_warn,
                "crossed_cap": crossed_cap,
            }
        if crossed_cap:
            logger.error(json.dumps({"event": "tenant_budget_cap_exceeded", **state}))
        elif crossed_warn:
            logger.warning(json.dumps({"event": "tenant_budget_warn", **state}))
        return state

    async def status(self, tenant_id: str) -> dict:
        """Return current spend snapshot for a tenant."""
        async with self._lock:
            rec = self._record(tenant_id)
            warn_cents, cap_cents = self._limits_for(tenant_id)
            return {
                "tenant_id": tenant_id,
                "day": rec.day,
                "spend_cents": rec.cents,
                "spend_usd": round(rec.cents / 100, 2),
                "warn_cents": warn_cents,
                "warn_usd": round(warn_cents / 100, 2),
                "cap_cents": cap_cents,
                "cap_usd": round(cap_cents / 100, 2),
                "completion_count": rec.completion_count,
                "blocked_count": rec.blocked_count,
                "warned": rec.warned,
                "exceeded": rec.cents >= cap_cents,
            }

    async def reset(self, tenant_id: str) -> dict:
        """Force-reset a tenant's daily spend to zero. Returns the snapshot
        prior to reset for audit logging.
        """
        async with self._lock:
            rec = self._records.get(tenant_id)
            if rec is None:
                return {"reset": False, "reason": "no_record"}
            previous = {
                "tenant_id": tenant_id,
                "day": rec.day,
                "spend_cents": rec.cents,
                "completion_count": rec.completion_count,
                "blocked_count": rec.blocked_count,
            }
            self._records.pop(tenant_id, None)
        logger.warning(json.dumps({"event": "tenant_budget_reset", **previous}))
        return {"reset": True, "previous": previous}


_ledger_singleton: Optional[BudgetLedger] = None


def _parse_overrides(raw: str) -> dict[str, dict[str, float]]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("AI_SVC_TENANT_CAP_OVERRIDES is not valid JSON: %s", exc)
        return {}
    if not isinstance(parsed, dict):
        logger.error("AI_SVC_TENANT_CAP_OVERRIDES must be a JSON object, got %s", type(parsed).__name__)
        return {}
    cleaned: dict[str, dict[str, float]] = {}
    for k, v in parsed.items():
        if not isinstance(k, str) or not isinstance(v, dict):
            continue
        entry: dict[str, float] = {}
        for field_name in ("cap_usd", "warn_usd"):
            if field_name in v:
                try:
                    entry[field_name] = float(v[field_name])
                except (TypeError, ValueError):
                    logger.warning("Ignoring non-numeric %s for tenant %s", field_name, k)
        if entry:
            cleaned[k] = entry
    return cleaned


def get_ledger() -> BudgetLedger:
    """Process-wide BudgetLedger accessor."""
    global _ledger_singleton
    if _ledger_singleton is None:
        cap_usd = float(os.environ.get("AI_SVC_TENANT_DAILY_CAP_USD", DEFAULT_DAILY_CAP_USD))
        warn_usd = float(os.environ.get("AI_SVC_TENANT_DAILY_WARN_USD", DEFAULT_DAILY_WARN_USD))
        overrides = _parse_overrides(os.environ.get("AI_SVC_TENANT_CAP_OVERRIDES", ""))
        _ledger_singleton = BudgetLedger(
            default_cap_usd=cap_usd,
            default_warn_usd=warn_usd,
            overrides=overrides,
        )
    return _ledger_singleton


def _reset_ledger_for_tests() -> None:
    """Test-only hook for clearing the singleton between cases."""
    global _ledger_singleton
    _ledger_singleton = None

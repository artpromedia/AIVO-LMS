"""Sprint 14 (B) — per-tenant LLM budget caps.

Backed by the ``tenant_llm_budgets`` table (migration 0047). ai-svc owns
reads and writes. The flow:

  before a completion:
    * fetch the active row for (tenant_id, period='daily')
    * if current_cents + estimated_cost_cents would cross cap_cents
      AND the tenant is NOT already auto-downgraded, downgrade them to
      the economy band for the rest of the period and emit the metric
      + comms-svc admin email.
    * if the downgraded-band cost still crosses cap_cents, raise
      HardCapExceeded with retry-after = period_end - now.

  after a completion:
    * call ``record_spend(tenant_id, cost_cents)`` to bump
      current_cents. The same call evaluates the daily AND monthly
      windows so monthly caps can also force a downgrade.

The persistence layer is pluggable via a ``BudgetStore`` interface so
unit tests can use an in-memory implementation without spinning Postgres.
"""
from __future__ import annotations

import abc
import asyncio
import calendar
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger("ai-svc.tenant_caps")

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

Period = str  # 'daily' | 'monthly'


@dataclass
class BudgetRow:
    tenant_id: str
    period: Period
    cap_cents: int
    current_cents: int
    period_start: datetime
    period_end: datetime
    auto_downgraded_at: Optional[datetime] = None


class HardCapExceeded(Exception):
    """Raised when the tenant's downgraded-band cost still exceeds the cap."""

    def __init__(
        self,
        tenant_id: str,
        period: Period,
        spend_cents: int,
        cap_cents: int,
        retry_after_seconds: int,
    ) -> None:
        self.tenant_id = tenant_id
        self.period = period
        self.spend_cents = spend_cents
        self.cap_cents = cap_cents
        self.retry_after_seconds = retry_after_seconds
        super().__init__(
            f"tenant {tenant_id} exceeded {period} LLM cap "
            f"(${spend_cents / 100:.2f} of ${cap_cents / 100:.2f}); "
            f"retry after {retry_after_seconds}s"
        )


@dataclass
class BudgetCheckResult:
    """Returned by ``BudgetEnforcer.evaluate(...)``."""

    allowed: bool
    effective_band: str
    downgraded: bool
    """True if THIS call triggered the downgrade (first crossing)."""
    rows: list[BudgetRow] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Persistence interface
# ---------------------------------------------------------------------------


class BudgetStore(abc.ABC):
    """Pluggable persistence boundary for ``tenant_llm_budgets``."""

    @abc.abstractmethod
    async def get_or_create(
        self,
        tenant_id: str,
        period: Period,
        now: datetime,
        default_cap_cents: int,
    ) -> BudgetRow: ...

    @abc.abstractmethod
    async def add_spend(
        self,
        tenant_id: str,
        period: Period,
        period_start: datetime,
        delta_cents: int,
    ) -> BudgetRow: ...

    @abc.abstractmethod
    async def mark_downgraded(
        self,
        tenant_id: str,
        period: Period,
        period_start: datetime,
        downgraded_at: datetime,
    ) -> None: ...


class InMemoryBudgetStore(BudgetStore):
    """Used by tests and by ai-svc in dev when Postgres is unavailable."""

    def __init__(self) -> None:
        self._rows: dict[tuple[str, str, datetime], BudgetRow] = {}
        self._lock = asyncio.Lock()

    async def get_or_create(
        self,
        tenant_id: str,
        period: Period,
        now: datetime,
        default_cap_cents: int,
    ) -> BudgetRow:
        async with self._lock:
            start, end = _period_window(period, now)
            key = (tenant_id, period, start)
            row = self._rows.get(key)
            if row is None:
                row = BudgetRow(
                    tenant_id=tenant_id,
                    period=period,
                    cap_cents=default_cap_cents,
                    current_cents=0,
                    period_start=start,
                    period_end=end,
                )
                self._rows[key] = row
            return _clone(row)

    async def add_spend(
        self,
        tenant_id: str,
        period: Period,
        period_start: datetime,
        delta_cents: int,
    ) -> BudgetRow:
        async with self._lock:
            key = (tenant_id, period, period_start)
            row = self._rows[key]
            row.current_cents += delta_cents
            return _clone(row)

    async def mark_downgraded(
        self,
        tenant_id: str,
        period: Period,
        period_start: datetime,
        downgraded_at: datetime,
    ) -> None:
        async with self._lock:
            key = (tenant_id, period, period_start)
            row = self._rows.get(key)
            if row is None:
                return
            if row.auto_downgraded_at is None:
                row.auto_downgraded_at = downgraded_at


def _clone(r: BudgetRow) -> BudgetRow:
    return BudgetRow(
        tenant_id=r.tenant_id,
        period=r.period,
        cap_cents=r.cap_cents,
        current_cents=r.current_cents,
        period_start=r.period_start,
        period_end=r.period_end,
        auto_downgraded_at=r.auto_downgraded_at,
    )


# ---------------------------------------------------------------------------
# Period math
# ---------------------------------------------------------------------------


def _period_window(period: Period, now: datetime) -> tuple[datetime, datetime]:
    if period == "daily":
        start = now.astimezone(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        end = start + timedelta(days=1)
        return start, end
    if period == "monthly":
        now_utc = now.astimezone(timezone.utc)
        start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day = calendar.monthrange(start.year, start.month)[1]
        end = start.replace(day=last_day, hour=23, minute=59, second=59) + timedelta(
            seconds=1,
        )
        return start, end
    raise ValueError(f"unknown period {period!r}")


# ---------------------------------------------------------------------------
# Notification hooks
# ---------------------------------------------------------------------------


CapExceededHook = "callable(tenant_id) -> awaitable"


async def _default_emit_metric(tenant_id: str) -> None:
    # Lightweight default: just log a structured line. Production wires
    # this up to the observability counter via ai-svc startup.
    logger.warning("tenant_llm_cap_exceeded_total", extra={"tenant_id": tenant_id})


async def _default_email_admin(tenant_id: str) -> None:
    """Fire-and-forget POST to comms-svc when configured.

    Failures are swallowed — the cap-exceedance event itself is already
    persisted via the audit log; the email is a courtesy notification.
    """
    url = (os.environ.get("COMMS_SVC_URL") or "http://localhost:3010").rstrip("/")
    token = os.environ.get("INTERNAL_SERVICE_TOKEN", "aivo-internal-dev-token")
    try:
        import httpx  # local import: optional dep path
        async with httpx.AsyncClient(timeout=1.5) as client:
            await client.post(
                f"{url}/api/comms/internal/admin-alert",
                json={
                    "to": "tenant-admin",  # comms-svc resolves the actual address
                    "tenantId": tenant_id,
                    "kind": "llm_cap_exceeded",
                    "severity": "high",
                    "subject": "Your tenant has hit its LLM spend cap",
                    "body": (
                        "Your tenant's LLM budget cap was reached. The tenant "
                        "has been auto-downgraded to the economy model band "
                        "for the remainder of the period. Contact support to "
                        "raise the cap."
                    ),
                },
                headers={"x-service-token": token},
            )
    except Exception as exc:  # noqa: BLE001
        logger.info("cap_exceeded admin email skipped: %s", exc)


# ---------------------------------------------------------------------------
# Enforcer
# ---------------------------------------------------------------------------


@dataclass
class BudgetEnforcer:
    """Per-process facade combining store reads, downgrade logic, and
    hard-cap refusal.
    """

    store: BudgetStore
    default_daily_cap_cents: int = 8000  # $80
    default_monthly_cap_cents: int = 200000  # $2000
    emit_metric_hook: callable = _default_emit_metric  # type: ignore[assignment]
    email_admin_hook: callable = _default_email_admin  # type: ignore[assignment]

    async def evaluate(
        self,
        tenant_id: str,
        requested_band: str,
        estimated_cost_cents_by_band: dict[str, int],
        now: Optional[datetime] = None,
    ) -> BudgetCheckResult:
        """Decide which band the tenant is allowed to use right now.

        Args:
          tenant_id: caller-resolved tenant.
          requested_band: the band the model router currently wants.
          estimated_cost_cents_by_band: estimated request cost per band
            (caller passes ``{band: cents}`` for at least the requested
            band and the ``economy`` fallback).
          now: override clock for tests.

        Returns: ``BudgetCheckResult`` with the band the caller MUST use.
        """
        n = now or datetime.now(timezone.utc)
        daily = await self.store.get_or_create(
            tenant_id, "daily", n, self.default_daily_cap_cents,
        )
        monthly = await self.store.get_or_create(
            tenant_id, "monthly", n, self.default_monthly_cap_cents,
        )
        rows = [daily, monthly]

        already_downgraded = any(r.auto_downgraded_at is not None for r in rows)
        effective_band = "economy" if already_downgraded else requested_band

        # First pass: would the requested band cross either cap?
        req_cost = estimated_cost_cents_by_band.get(effective_band, 0)
        crosses_daily = daily.current_cents + req_cost > daily.cap_cents
        crosses_monthly = monthly.current_cents + req_cost > monthly.cap_cents

        downgraded_now = False
        if (crosses_daily or crosses_monthly) and not already_downgraded:
            # Downgrade and re-evaluate at the economy band.
            await self.store.mark_downgraded(
                tenant_id, "daily", daily.period_start, n,
            )
            await self.store.mark_downgraded(
                tenant_id, "monthly", monthly.period_start, n,
            )
            try:
                await self.emit_metric_hook(tenant_id)
            except Exception:  # noqa: BLE001
                logger.exception("emit_metric_hook failed")
            try:
                await self.email_admin_hook(tenant_id)
            except Exception:  # noqa: BLE001
                logger.exception("email_admin_hook failed")
            downgraded_now = True
            effective_band = "economy"
            req_cost = estimated_cost_cents_by_band.get("economy", 0)
            # Refresh the in-memory copy with the timestamp for callers.
            daily.auto_downgraded_at = n
            monthly.auto_downgraded_at = n

        # Hard refusal: economy STILL crosses the cap.
        still_crosses_daily = daily.current_cents + req_cost > daily.cap_cents
        still_crosses_monthly = monthly.current_cents + req_cost > monthly.cap_cents
        if still_crosses_daily or still_crosses_monthly:
            offender = daily if still_crosses_daily else monthly
            retry_after = max(1, int((offender.period_end - n).total_seconds()))
            raise HardCapExceeded(
                tenant_id=tenant_id,
                period=offender.period,
                spend_cents=offender.current_cents,
                cap_cents=offender.cap_cents,
                retry_after_seconds=retry_after,
            )

        return BudgetCheckResult(
            allowed=True,
            effective_band=effective_band,
            downgraded=downgraded_now,
            rows=rows,
        )

    async def record_spend(
        self,
        tenant_id: str,
        cost_cents: int,
        now: Optional[datetime] = None,
    ) -> None:
        if cost_cents <= 0 or not tenant_id:
            return
        n = now or datetime.now(timezone.utc)
        daily = await self.store.get_or_create(
            tenant_id, "daily", n, self.default_daily_cap_cents,
        )
        monthly = await self.store.get_or_create(
            tenant_id, "monthly", n, self.default_monthly_cap_cents,
        )
        await self.store.add_spend(
            tenant_id, "daily", daily.period_start, cost_cents,
        )
        await self.store.add_spend(
            tenant_id, "monthly", monthly.period_start, cost_cents,
        )


# Module-level singleton: bound at startup with the real Postgres store.
_enforcer: Optional[BudgetEnforcer] = None


def get_enforcer() -> BudgetEnforcer:
    global _enforcer
    if _enforcer is None:
        _enforcer = BudgetEnforcer(store=InMemoryBudgetStore())
    return _enforcer


def set_enforcer(enforcer: BudgetEnforcer) -> None:
    """Wire the production (Postgres-backed) enforcer at startup, or a
    test double in test fixtures.
    """
    global _enforcer
    _enforcer = enforcer

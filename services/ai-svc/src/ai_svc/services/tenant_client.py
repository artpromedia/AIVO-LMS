"""Sprint 14 (B) — minimal tenant-svc client.

Reads ``tenant.cost_tier`` (one of ``economy``, ``standard``, ``premium``).
Tenants without an explicit tier fall back to the band configured by
``AIVO_DEFAULT_LLM_BAND`` (default ``standard``).

This module is intentionally tiny: ai-svc only ever needs the cost band
to drive the model-router ladder. Other tenant data is fetched
elsewhere. Failures are non-fatal: callers receive the default band so
the request still completes.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger("ai-svc.tenant_client")

_TENANT_SVC_URL = os.environ.get("TENANT_SVC_URL", "http://localhost:3020").rstrip("/")
_INTERNAL_TOKEN = os.environ.get("INTERNAL_SERVICE_TOKEN", "aivo-internal-dev-token")
_TIMEOUT_S = float(os.environ.get("TENANT_SVC_TIMEOUT_S", "1.5"))

VALID_BANDS = ("economy", "standard", "premium")


def default_band() -> str:
    """Process-wide fallback band when tenant-svc lookups fail or the tier is unset."""
    band = (os.environ.get("AIVO_DEFAULT_LLM_BAND") or "standard").strip().lower()
    if band not in VALID_BANDS:
        return "standard"
    return band


async def get_tenant_cost_band(tenant_id: Optional[str]) -> str:
    """Return the cost band for ``tenant_id`` or the configured default.

    Never raises — on any failure, returns ``default_band()`` and logs a
    warning so the calling LLM request is not blocked by a tenant-svc
    outage.
    """
    if not tenant_id:
        return default_band()
    url = f"{_TENANT_SVC_URL}/api/tenants/{tenant_id}/cost-tier"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            resp = await client.get(
                url,
                headers={"x-service-token": _INTERNAL_TOKEN},
            )
            if resp.status_code != 200:
                logger.warning(
                    "tenant_client.get_tenant_cost_band non-2xx",
                    extra={"tenant_id": tenant_id, "status": resp.status_code},
                )
                return default_band()
            data = resp.json() or {}
            band = str(data.get("costTier") or data.get("cost_tier") or "").strip().lower()
            if band in VALID_BANDS:
                return band
            return default_band()
    except Exception as exc:  # noqa: BLE001 — never block on tenant lookup
        logger.warning(
            "tenant_client.get_tenant_cost_band failed: %s", exc,
            extra={"tenant_id": tenant_id},
        )
        return default_band()

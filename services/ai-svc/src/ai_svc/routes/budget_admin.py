"""Admin routes for the per-tenant LLM budget cap (§5 ai-svc cost/reliability).

Exposes:
- `GET  /api/ai/admin/budget/{tenant_id}` — current spend/cap snapshot.
- `POST /api/ai/admin/budget/{tenant_id}/reset` — force-reset today's spend.

Both endpoints are intended for operator / watchdog use — guarded by the
`X-Internal-Service-Token` header (must equal `INTERNAL_SERVICE_TOKEN` /
`INTERNAL_SERVICE_KEY` env). The reset endpoint mirrors the brain-svc
`/api/brain/admin/pause-llm` shape used by the admin-svc watchdog.
"""
from __future__ import annotations

import os
from fastapi import APIRouter, Header, HTTPException, status

from ..services.budget_caps import get_ledger

router = APIRouter(prefix="/api/ai/admin/budget", tags=["budget-admin"])


def _check_internal_token(provided: str | None) -> None:
    expected = os.environ.get("INTERNAL_SERVICE_TOKEN") or os.environ.get(
        "INTERNAL_SERVICE_KEY"
    )
    if not expected:
        # If the deployment hasn't configured an internal token, treat the
        # admin endpoints as disabled rather than wide-open.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin token not configured",
        )
    if not provided or provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service token",
        )


@router.get("/{tenant_id}")
async def get_tenant_budget(
    tenant_id: str,
    x_internal_service_token: str | None = Header(default=None),
) -> dict:
    _check_internal_token(x_internal_service_token)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id required")
    return await get_ledger().status(tenant_id)


@router.post("/{tenant_id}/reset")
async def reset_tenant_budget(
    tenant_id: str,
    x_internal_service_token: str | None = Header(default=None),
) -> dict:
    _check_internal_token(x_internal_service_token)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id required")
    return await get_ledger().reset(tenant_id)

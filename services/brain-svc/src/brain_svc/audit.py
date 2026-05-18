"""
brain-svc audit client.

Emits audit events by POST-ing to audit-svc rather than writing to the
audit_events table directly. This keeps the hash-chain logic in a
single place (audit-svc owns the chain) and lets brain-svc be a pure
read-or-write business-logic service.

Failures must NEVER break the brain-clone / approval flow — they log
a warning and return. The HTTP request is best-effort and uses a tight
timeout so a degraded audit-svc cannot stall learner-facing endpoints.

Configuration:
- AUDIT_SVC_URL — base URL, defaults to http://localhost:3050.
- INTERNAL_SERVICE_TOKEN — required in production (passed in the
  X-Service-Token header so audit-svc accepts the call).
"""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger("brain-svc.audit")

_AUDIT_TIMEOUT_S = float(os.environ.get("AUDIT_TIMEOUT_S", "1.5"))

# Module-level client so we reuse connections across calls.
_client: httpx.AsyncClient | None = None


def _audit_base_url() -> str:
    return os.environ.get("AUDIT_SVC_URL", "http://localhost:3050").rstrip("/")


def _service_token() -> str:
    token = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
    if token:
        return token
    if os.environ.get("NODE_ENV") == "production" or os.environ.get("ENV") == "production":
        # Fail closed at call time rather than at module import time so the
        # rest of brain-svc can boot.
        return "\0PROD_TOKEN_NOT_CONFIGURED\0"
    return "aivo-internal-dev-token"


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=_AUDIT_TIMEOUT_S)
    return _client


async def emit_brain_audit(
    *,
    event_type: str,
    tenant_id: str | None,
    learner_id: str,
    resource_id: str | None = None,
    actor_user_id: str | None = None,
    actor_role: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Send one audit event to audit-svc. Never raises."""
    payload: dict[str, Any] = {
        "action": event_type,
        "resourceType": "brain",
        "resourceId": resource_id,
        "tenantId": tenant_id,
        "actorUserId": actor_user_id,
        "actorRole": actor_role or "service",
        "details": {
            "learnerId": learner_id,
            **(details or {}),
        },
    }
    try:
        client = await _get_client()
        resp = await client.post(
            f"{_audit_base_url()}/api/audit-events",
            json=payload,
            headers={"X-Service-Token": _service_token()},
        )
        if resp.status_code >= 400:
            logger.warning(
                "brain-svc audit emit non-2xx",
                extra={
                    "event_type": event_type,
                    "learner_id": learner_id,
                    "status": resp.status_code,
                    "body": resp.text[:200],
                },
            )
    except Exception as err:  # noqa: BLE001  - audit must never raise
        logger.warning(
            "brain-svc audit emit failed",
            extra={
                "event_type": event_type,
                "learner_id": learner_id,
                "err": str(err),
            },
        )

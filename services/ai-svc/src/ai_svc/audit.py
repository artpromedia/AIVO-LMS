"""
ai-svc audit client. Same shape as brain-svc/audit.py — POSTs audit
events to audit-svc via HTTP, never raises, tightly time-bounded so a
degraded audit-svc cannot stall AI generation paths.

ai-svc audit events trace which model/prompt produced which generation
for which tenant/learner — this is the regulatory trail behind every
AI-generated lesson, baseline, and tutor message.
"""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger("ai-svc.audit")

_AUDIT_TIMEOUT_S = float(os.environ.get("AUDIT_TIMEOUT_S", "1.5"))
_client: httpx.AsyncClient | None = None


def _audit_base_url() -> str:
    return os.environ.get("AUDIT_SVC_URL", "http://localhost:3050").rstrip("/")


def _service_token() -> str:
    token = os.environ.get("INTERNAL_SERVICE_TOKEN", "")
    if token:
        return token
    if os.environ.get("NODE_ENV") == "production" or os.environ.get("ENV") == "production":
        return "\0PROD_TOKEN_NOT_CONFIGURED\0"
    return "aivo-internal-dev-token"


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=_AUDIT_TIMEOUT_S)
    return _client


async def emit_ai_audit(
    *,
    event_type: str,
    tenant_id: str | None,
    learner_id: str | None,
    resource_type: str = "ai_generation",
    resource_id: str | None = None,
    actor_user_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Send one audit event to audit-svc. Never raises."""
    payload: dict[str, Any] = {
        "action": event_type,
        "resourceType": resource_type,
        "resourceId": resource_id,
        "tenantId": tenant_id,
        "actorUserId": actor_user_id,
        "actorRole": "service",
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
                "ai-svc audit emit non-2xx",
                extra={
                    "event_type": event_type,
                    "status": resp.status_code,
                    "body": resp.text[:200],
                },
            )
    except Exception as err:  # noqa: BLE001 - audit must never raise
        logger.warning(
            "ai-svc audit emit failed",
            extra={"event_type": event_type, "err": str(err)},
        )

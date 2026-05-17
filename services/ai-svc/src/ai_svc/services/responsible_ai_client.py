"""Lightweight flag-gated client for the @aivo/responsible-ai-svc service.

When ``AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS`` is on, callers can fire a
content evaluation against the responsible-AI service. The call is fire
and forget: any network or upstream failure returns ``None`` so the
generation flow is never blocked.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import httpx


logger = logging.getLogger("ai-svc.responsible_ai")

_RESPONSIBLE_AI_SVC_URL = os.environ.get(
    "RESPONSIBLE_AI_SVC_URL", "http://localhost:3071"
)


def responsible_ai_enabled() -> bool:
    raw = os.environ.get("AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS", "")
    return raw.strip().lower() in {"1", "true", "yes", "on"}


async def evaluate(
    *,
    learner_id: str,
    context_type: str,
    input_summary: str,
    output: Any,
    required_surfaces: list[str] | None = None,
    learner_profile_summary: dict[str, Any] | None = None,
    policy_mode: str = "warn",
    timeout_seconds: float = 2.0,
) -> dict[str, Any] | None:
    """POST to ``/api/responsible-ai/evaluate``. Returns the response dict
    on success, ``None`` on any failure or when the flag is off."""

    if not responsible_ai_enabled():
        return None
    body: dict[str, Any] = {
        "learnerId": learner_id,
        "contextType": context_type,
        "inputSummary": input_summary,
        "output": output,
        "policyMode": policy_mode,
    }
    if required_surfaces:
        body["requiredSurfaces"] = required_surfaces
    if learner_profile_summary:
        body["learnerProfileSummary"] = learner_profile_summary
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                f"{_RESPONSIBLE_AI_SVC_URL}/api/responsible-ai/evaluate",
                json=body,
            )
            if response.status_code != 200:
                logger.debug(
                    "responsible-AI returned %s for learner %s", response.status_code, learner_id
                )
                return None
            return response.json()
    except Exception as exc:  # pragma: no cover — fire-and-forget
        logger.debug("responsible-AI request failed: %s", exc)
        return None

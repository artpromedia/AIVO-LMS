"""HTTP client + circuit breaker for posting flagged content to admin-svc.

Falls back to local JSONL log if admin-svc is unreachable so safety incidents
are never lost.
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger("ai-svc.moderation_client")

ADMIN_SVC_URL = os.environ.get("ADMIN_SVC_URL", "http://localhost:3013")
INTERNAL_KEY = os.environ.get("INTERNAL_SERVICE_KEY") or (
    "" if os.environ.get("NODE_ENV") == "production" else "aivo-internal-dev-key"
)
COMMS_SVC_URL = os.environ.get("COMMS_SVC_URL", "http://localhost:3010")
ADMIN_ALERT_EMAIL = os.environ.get("ADMIN_ALERT_EMAIL", "safety@aivo.local")
LOCAL_LOG_PATH = Path(
    os.environ.get("CONTENT_MODERATION_LOG", "/tmp/aivo_content_moderation.log")
)

# --- circuit breaker state -------------------------------------------------
_BREAKER_LOCK = threading.Lock()
_RECENT_FLAGS: dict[str, deque[float]] = {}
_DISABLED_MODELS: dict[str, float] = {}
HIGH_SEVERITY_WINDOW_S = 600  # 10 minutes
HIGH_SEVERITY_THRESHOLD = 5
DISABLE_DURATION_S = 1800  # 30 minutes

CIRCUIT_LOG_PATH = Path(os.environ.get("CIRCUIT_BREAKER_LOG", "/tmp/aivo_circuit_breaker.log"))


def _append_local(payload: dict[str, Any]) -> None:
    try:
        LOCAL_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with LOCAL_LOG_PATH.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps({**payload, "logged_at": datetime.utcnow().isoformat() + "Z"}) + "\n")
    except Exception as exc:
        logger.warning("Failed to write local moderation log: %s", exc)


_PII_MASKS = [
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"), "[SSN]"),
    (re.compile(r"\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b"), "[PHONE]"),
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "[EMAIL]"),
    (re.compile(r"\b(?:\d[ -]*?){13,16}\b"), "[CARD]"),
]


def _mask_pii(text: str) -> str:
    out = text
    for pat, repl in _PII_MASKS:
        out = pat.sub(repl, out)
    return out


def log_moderation_event(
    *,
    content: str,
    flag_reason: str,
    content_type: str = "ai_response",
    flag_confidence: float | None = None,
    gate_results: dict | None = None,
    tutor_sku: str | None = None,
    model_used: str | None = None,
    learner_id: str | None = None,
    tenant_id: str | None = None,
    session_id: str | None = None,
    status: str = "PENDING",
) -> None:
    """Persist a moderation event. Best-effort: never raises."""
    # PII flag reason -> mask before storing so we don't persist live PII.
    safe_content = _mask_pii(content) if flag_reason == "pii_leak" else content
    payload = {
        "content": safe_content[:4000],
        "flagReason": flag_reason,
        "contentType": content_type,
        "flagConfidence": flag_confidence,
        "gateResults": gate_results,
        "tutorSku": tutor_sku,
        "modelUsed": model_used,
        "learnerId": learner_id,
        "tenantId": tenant_id,
        "sessionId": session_id,
        "status": status,
    }
    try:
        with httpx.Client(timeout=2.5) as client:
            client.post(
                f"{ADMIN_SVC_URL}/api/admin-svc/internal/moderation",
                json=payload,
                headers={"x-internal-key": INTERNAL_KEY},
            )
    except Exception as exc:
        logger.warning("admin-svc moderation log unreachable, falling back to file: %s", exc)
        _append_local(payload)

    # High-severity branch: tripwire + admin alert.
    if status != "LOW_CONFIDENCE" and (flag_confidence or 0.0) >= 0.9:
        _trip_circuit_if_needed(model_used, tutor_sku)
        _send_admin_alert(payload)


def _trip_circuit_if_needed(model_used: str | None, tutor_sku: str | None) -> None:
    if not model_used:
        return
    now = time.monotonic()
    with _BREAKER_LOCK:
        bucket = _RECENT_FLAGS.setdefault(model_used, deque())
        cutoff = now - HIGH_SEVERITY_WINDOW_S
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        bucket.append(now)
        if len(bucket) >= HIGH_SEVERITY_THRESHOLD:
            _DISABLED_MODELS[model_used] = now + DISABLE_DURATION_S
            bucket.clear()
            try:
                CIRCUIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
                with CIRCUIT_LOG_PATH.open("a", encoding="utf-8") as fh:
                    fh.write(json.dumps({
                        "tripped_at": datetime.utcnow().isoformat() + "Z",
                        "model": model_used,
                        "tutor_sku": tutor_sku,
                        "disabled_until_monotonic": _DISABLED_MODELS[model_used],
                    }) + "\n")
            except Exception:
                pass
            logger.error(
                "Circuit breaker tripped: disabling model=%s for %ss after %s high-severity flags",
                model_used, DISABLE_DURATION_S, HIGH_SEVERITY_THRESHOLD,
            )


def is_model_disabled(model: str) -> bool:
    if not model:
        return False
    with _BREAKER_LOCK:
        until = _DISABLED_MODELS.get(model)
        if until is None:
            return False
        if time.monotonic() >= until:
            del _DISABLED_MODELS[model]
            return False
        return True


RESPONSIBLE_AI_SVC_URL = os.environ.get(
    "RESPONSIBLE_AI_SVC_URL", "http://localhost:3071"
).rstrip("/")


class ModerationUnavailableError(RuntimeError):
    """Raised when the moderation backend is unreachable or returns 5xx.

    Callers should catch this and fall back to a deterministic local
    decision (and emit the `ai_safety_judge_degraded_total` metric so
    the degradation is observable).
    """


def classify_text(
    text: str,
    *,
    source: str = "speech_buddy",
    timeout_seconds: float = 1.5,
) -> str | None:
    """Synchronously ask the responsible-ai service to classify text.

    Returns one of the SafetyFlagCategory strings if the service finds a
    policy violation, ``None`` if the text is clean. Raises
    ``ModerationUnavailableError`` on transport failure or 5xx — the
    caller is expected to fall back to the deterministic regex stub.
    """
    body = {
        "contextType": source,
        "inputSummary": "",
        "output": {"text": text},
        "policyMode": "warn",
    }
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(
                f"{RESPONSIBLE_AI_SVC_URL}/api/responsible-ai/classify",
                json=body,
                headers={"x-internal-key": INTERNAL_KEY},
            )
    except Exception as exc:
        raise ModerationUnavailableError(f"responsible-ai unreachable: {exc}") from exc

    if response.status_code >= 500:
        raise ModerationUnavailableError(
            f"responsible-ai returned {response.status_code}"
        )
    if response.status_code != 200:
        # 4xx — treat as a non-flag result (the request was rejected for
        # reasons that are not "the service is degraded").
        return None
    payload = response.json()
    category = payload.get("category") if isinstance(payload, dict) else None
    if not category:
        return None
    return str(category)


def _send_admin_alert(payload: dict[str, Any]) -> None:
    try:
        with httpx.Client(timeout=2.5) as client:
            client.post(
                f"{COMMS_SVC_URL}/api/comms/internal/admin-alert",
                json={
                    "to": ADMIN_ALERT_EMAIL,
                    "severity": "high",
                    "tutorSku": payload.get("tutorSku"),
                    "modelUsed": payload.get("modelUsed"),
                    "learnerId": payload.get("learnerId"),
                    "flagReason": payload.get("flagReason"),
                    "flagConfidence": payload.get("flagConfidence"),
                    "contentSnippet": (payload.get("content") or "")[:500],
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                },
                headers={"x-internal-key": INTERNAL_KEY},
            )
    except Exception as exc:
        logger.warning("Failed to send admin safety alert: %s", exc)

"""Speech Buddy session HTTP API.

Internal-key guarded; tutor-svc is the only intended caller. Surface:

  POST /api/ai/speech-buddy/sessions          → start_session
  POST /api/ai/speech-buddy/sessions/{id}/turn → run_turn (text in, text out)
  POST /api/ai/speech-buddy/sessions/{id}/end  → end_session
  GET  /api/ai/speech-buddy/sessions/{id}      → session header (state, timings)

Audio frames travel over the tutor-svc WebSocket; this HTTP API exists for
the orchestrator's text-mode entry point and for end-of-session reflection.
"""
from __future__ import annotations

import os
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from ..speech_buddy import (
    AGE_BANDS,
    SKILL_TAGS,
    DefaultOrchestrator,
    DefaultToolset,
    EventEmitter,
    SafetyFilter,
)

router = APIRouter(prefix="/api/ai/speech-buddy", tags=["speech_buddy"])


def _internal_key() -> Optional[str]:
    """Resolve the shared internal-service key.

    Fail-closed in production: if ``INTERNAL_SERVICE_KEY`` is not set
    when ``NODE_ENV=production`` we return ``None`` — every request
    is then rejected with 401 instead of accepting the predictable dev
    key. Same convention as ``services/comms-svc``."""
    explicit = os.environ.get("INTERNAL_SERVICE_KEY")
    if explicit:
        return explicit
    if os.environ.get("NODE_ENV") == "production":
        return None
    return "aivo-internal-dev-key"


def _check_internal(x_internal_key: Optional[str]) -> None:
    expected = _internal_key()
    if not expected or not x_internal_key or x_internal_key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _check_ownership(
    session_id: str,
    *,
    tenant_id: Optional[str],
    learner_id: Optional[str],
) -> None:
    """Enforce caller (tenant_id, learner_id) actually owns this session.

    tutor-svc passes these from the verified child JWT on every call.
    Without them, ai-svc refuses — preventing IDOR where one child guesses
    or replays another child's session id.
    """
    if not tenant_id or not learner_id:
        raise HTTPException(
            status_code=400,
            detail="x-aivo-tenant-id and x-aivo-learner-id headers are required",
        )
    try:
        _orchestrator.assert_owner(session_id, tenant_id=tenant_id, learner_id=learner_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found")
    except PermissionError:
        # 404, not 403, to avoid an oracle for valid session ids.
        raise HTTPException(status_code=404, detail="session not found")


# Build a single shared orchestrator for the process. tutor-svc pins each
# session to one ai-svc instance via the WS endpoint, so the in-memory
# session map is correct under that routing.
_shared_http = httpx.AsyncClient(timeout=2.0)
_shared_emitter = EventEmitter(http_client=_shared_http)
_shared_toolset = DefaultToolset(http_client=_shared_http)
_orchestrator = DefaultOrchestrator(
    toolset=_shared_toolset,
    emitter=_shared_emitter,
    safety=SafetyFilter(),
)


class StartSessionBody(BaseModel):
    tenantId: str = Field(..., min_length=1, max_length=128)
    learnerId: str = Field(..., min_length=1, max_length=128)
    ageBand: str = Field(..., description="One of 6-9 / 10-12 / 13-15")
    locale: str = Field("en", min_length=2, max_length=16)
    consentRecordId: str = Field(..., min_length=1, max_length=128)
    targetedSkills: list[str] = Field(default_factory=lambda: ["ask_open_question"])


class TurnBody(BaseModel):
    text: Optional[str] = None
    audioBase64: Optional[str] = None
    mimeType: str = "audio/webm"


class EndBody(BaseModel):
    reason: str = "completed"


@router.post("/sessions")
async def start_session(body: StartSessionBody, x_internal_key: Optional[str] = Header(default=None, alias="x-internal-key")):
    _check_internal(x_internal_key)
    if body.ageBand not in AGE_BANDS:
        raise HTTPException(status_code=400, detail=f"ageBand must be one of {AGE_BANDS}")
    skills = [s for s in body.targetedSkills if s in SKILL_TAGS]
    if not skills:
        skills = ["ask_open_question"]
    session = await _orchestrator.start_session(
        tenant_id=body.tenantId,
        learner_id=body.learnerId,
        age_band=body.ageBand,  # type: ignore[arg-type]
        locale=body.locale,
        consent_record_id=body.consentRecordId,
        targeted_skills=tuple(skills),  # type: ignore[arg-type]
    )
    return {
        "sessionId": session.id,
        "ageBand": session.age_band,
        "locale": session.locale,
        "nicknameToken": session.nickname_token,
        "state": session.state,
        "startedAt": session.started_at,
        "targetedSkills": list(session.targeted_skills),
    }


@router.post("/sessions/{session_id}/turn")
async def run_turn(
    session_id: str,
    body: TurnBody,
    x_internal_key: Optional[str] = Header(default=None, alias="x-internal-key"),
    x_aivo_tenant_id: Optional[str] = Header(default=None, alias="x-aivo-tenant-id"),
    x_aivo_learner_id: Optional[str] = Header(default=None, alias="x-aivo-learner-id"),
):
    _check_internal(x_internal_key)
    _check_ownership(session_id, tenant_id=x_aivo_tenant_id, learner_id=x_aivo_learner_id)
    if body.text is None and body.audioBase64 is None:
        raise HTTPException(status_code=400, detail="text or audioBase64 required")
    audio_bytes: Optional[bytes] = None
    if body.audioBase64 is not None:
        import base64
        try:
            audio_bytes = base64.b64decode(body.audioBase64, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"invalid audioBase64: {exc}") from exc
    try:
        outcome = await _orchestrator.run_turn(
            session_id,
            audio_bytes=audio_bytes,
            text=body.text,
            mime_type=body.mimeType,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found")
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    import base64 as _b64
    return {
        "buddyText": outcome.buddy_text,
        "buddyAudioBase64": (
            _b64.b64encode(outcome.buddy_audio).decode("ascii") if outcome.buddy_audio else ""
        ),
        "nextState": outcome.next_state,
        "ended": outcome.ended,
        "endedReason": outcome.ended_reason,
        "trace": outcome.trace.as_dict(),
        "safetyFlags": [
            {
                "category": f.category,
                "severity": f.severity,
                "source": f.source,
                "layer": f.layer,
                "correlationId": f.correlation_id,
                "raisedAt": f.raised_at,
            }
            for f in outcome.turn_event.safety_flags
        ],
        "skillEvidence": [
            {"skill": s, "weight": w} for s, w in outcome.turn_event.skill_evidence
        ],
    }


@router.post("/sessions/{session_id}/end")
async def end_session(
    session_id: str,
    body: EndBody,
    x_internal_key: Optional[str] = Header(default=None, alias="x-internal-key"),
    x_aivo_tenant_id: Optional[str] = Header(default=None, alias="x-aivo-tenant-id"),
    x_aivo_learner_id: Optional[str] = Header(default=None, alias="x-aivo-learner-id"),
):
    _check_internal(x_internal_key)
    _check_ownership(session_id, tenant_id=x_aivo_tenant_id, learner_id=x_aivo_learner_id)
    try:
        return await _orchestrator.end_session(session_id, reason=body.reason)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found")


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    x_internal_key: Optional[str] = Header(default=None, alias="x-internal-key"),
    x_aivo_tenant_id: Optional[str] = Header(default=None, alias="x-aivo-tenant-id"),
    x_aivo_learner_id: Optional[str] = Header(default=None, alias="x-aivo-learner-id"),
):
    _check_internal(x_internal_key)
    _check_ownership(session_id, tenant_id=x_aivo_tenant_id, learner_id=x_aivo_learner_id)
    try:
        s = _orchestrator.get_session(session_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="session not found")
    return {
        "sessionId": s.id,
        "state": s.state,
        "startedAt": s.started_at,
        "endedAt": s.ended_at,
        "ageBand": s.age_band,
        "locale": s.locale,
        "targetedSkills": list(s.targeted_skills),
    }

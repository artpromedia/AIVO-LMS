"""Wave E (S7) — the tutor-agent turn endpoint.

POST /api/ai/tutor-agent/turn — one stateless agent step. tutor-svc owns
the session, the tools, and their execution; this route owns the model
turn: strict reply validation, tiering, per-session token envelopes, the
quality gate on learner-visible text, and the decision trace. Internal
service-to-service only (same X-Internal-Auth contract as the curriculum
parser routes — shared with tutor-svc).
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException

from ai_svc.agent.loop import AgentTurnRequest, TurnResult, run_turn
from ai_svc.agent.parent_summary import (
    ParentSummaryRequest,
    ParentSummaryResult,
    compose_parent_summary,
)

_INTERNAL_TOKEN = os.environ.get("INTERNAL_AI_TOKEN") or (
    "dev-tutor-svc-internal"
    if os.environ.get("NODE_ENV", "development") != "production"
    else None
)
if _INTERNAL_TOKEN is None:
    raise RuntimeError(
        "INTERNAL_AI_TOKEN must be set in production (shared with tutor-svc)."
    )

router = APIRouter(prefix="/api/ai/tutor-agent", tags=["Tutor Agent"])


def _require_internal(x_internal_auth: str | None) -> None:
    if x_internal_auth != _INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid internal auth token")


@router.post("/turn", response_model=TurnResult)
async def tutor_agent_turn(
    request: AgentTurnRequest,
    x_internal_auth: str | None = Header(default=None, alias="X-Internal-Auth"),
) -> TurnResult:
    _require_internal(x_internal_auth)
    return await run_turn(request)


@router.post("/parent-summary", response_model=ParentSummaryResult)
async def tutor_agent_parent_summary(
    request: ParentSummaryRequest,
    x_internal_auth: str | None = Header(default=None, alias="X-Internal-Auth"),
) -> ParentSummaryResult:
    """Wave E (S11) — compose a quality-gated parent note from a session
    digest. Returns summary=None with a fallback_reason when composition
    fails; the caller then keeps its deterministic summary."""
    _require_internal(x_internal_auth)
    return await compose_parent_summary(request)

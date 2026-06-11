"""Wave E (S11) — agent-composed parent lesson summaries.

One teach-tier model call turns a session digest (what the agent saw and
did — counts and decision kinds, never raw learner utterances) into a
2–3 sentence parent-facing note. The note passes the SAME quality gate
as learner-visible text before it leaves this service; a gated or
malformed reply is retried once and then the caller falls back to its
deterministic summary — a parent never reads unvetted model output.
"""
from __future__ import annotations

import json
import logging

from pydantic import BaseModel, Field

from ai_svc.agent.tiering import TokenEnvelope, call_max_tokens, tier_chain

logger = logging.getLogger("ai-svc.tutor-agent")

MAX_SUMMARY_CHARS = 700


class SessionDigest(BaseModel):
    """Compact, PII-free description of an agent session."""

    beats_completed: int = Field(default=0, ge=0)
    checks_correct: int = Field(default=0, ge=0)
    checks_total: int = Field(default=0, ge=0)
    scaffolds_inserted: int = Field(default=0, ge=0)
    remediations: int = Field(default=0, ge=0)
    breaks_taken: int = Field(default=0, ge=0)
    ended_early: bool = False
    focus_skills: list[str] = Field(default_factory=list, max_length=8)
    decisions: list[str] = Field(default_factory=list, max_length=40)
    evidence_notes: list[str] = Field(default_factory=list, max_length=5)


class ParentSummaryRequest(BaseModel):
    tutor_key: str = Field(min_length=1, max_length=32)
    tenant_id: str | None = None
    learner_id: str | None = None
    session_id: str | None = None
    learner_first_name: str = Field(default="Your learner", max_length=60)
    digest: SessionDigest
    delivery_level: str = "3"
    functioning_level: str = "STANDARD"
    locale: str | None = None


class ParentSummaryResult(BaseModel):
    summary: str | None = None
    fallback_reason: str | None = None
    model: str = ""


def _build_prompts(req: ParentSummaryRequest) -> tuple[str, str]:
    system = (
        "You write short, warm notes to parents of neurodiverse learners after a "
        "tutoring session. Two to three sentences, plain language, concrete, and "
        "honest — celebrate real effort, name what was practised, and mention the "
        "support that helped. Never invent results, never use clinical labels, "
        "never address the learner. Reply with EXACTLY one JSON object: "
        '{"summary": "..."}'
    )
    if req.locale and not req.locale.startswith("en"):
        system += f" Write the summary in the language with BCP-47 code {req.locale}."
    user = json.dumps(
        {
            "learner_first_name": req.learner_first_name,
            "tutor": req.tutor_key,
            "session": req.digest.model_dump(),
        },
        ensure_ascii=False,
    )
    return system, user


def _extract_summary(raw: str) -> str | None:
    text = raw.strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        payload = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    summary = payload.get("summary") if isinstance(payload, dict) else None
    if not isinstance(summary, str):
        return None
    summary = summary.strip()
    if not (20 <= len(summary) <= MAX_SUMMARY_CHARS):
        return None
    return summary


async def compose_parent_summary(req: ParentSummaryRequest) -> ParentSummaryResult:
    """Teach-tier composition with the learner-text quality gate."""
    chain = tier_chain("teach")
    envelope = TokenEnvelope(limit=4000)
    max_tokens = call_max_tokens("teach", envelope)

    # Lazy imports — tests inject stand-in modules (speech_buddy pattern).
    from ai_svc.services.llm_gateway import generate_completion
    from ai_svc.services.quality_gate import run_quality_gate

    model_used = ""
    feedback: str | None = None
    for _attempt in (1, 2):
        system, user = _build_prompts(req)
        if feedback:
            user += f'\n\nYour previous reply was rejected: {feedback}. Try again.'
        try:
            completion = await generate_completion(
                system_prompt=system,
                user_prompt=user,
                temperature=0.4,
                max_tokens=max_tokens,
                model_chain=chain,
                tenant_id=req.tenant_id,
                response_format={"type": "json_object"},
            )
        except Exception as exc:  # noqa: BLE001 — gateway trouble = fallback
            return ParentSummaryResult(
                fallback_reason=f"gateway_error:{type(exc).__name__}", model=model_used
            )
        model_used = str(completion.get("model") or "")
        summary = _extract_summary(str(completion.get("content") or ""))
        if summary is None:
            feedback = 'reply must be {"summary": "<20-700 chars>"}'
            continue
        verdict = run_quality_gate(
            summary,
            delivery_level=req.delivery_level,
            functioning_level=req.functioning_level,
            tenant_id=req.tenant_id,
            learner_id=req.learner_id,
            session_id=req.session_id,
            content_type="tutor_agent_parent_summary",
        )
        if not verdict.get("passed", False):
            failed = [
                g.get("gate", "unknown")
                for g in verdict.get("gates", [])
                if not g.get("passed", True)
            ]
            feedback = f"summary failed the quality gate ({', '.join(failed) or 'gate'})"
            continue
        logger.info(
            json.dumps(
                {
                    "event": "tutor_agent.parent_summary",
                    "tutor": req.tutor_key,
                    "tenant": req.tenant_id,
                    "session": req.session_id,
                    "model": model_used,
                    "chars": len(summary),
                }
            )
        )
        return ParentSummaryResult(summary=summary, model=model_used)

    return ParentSummaryResult(fallback_reason="validation_retries_exhausted", model=model_used)

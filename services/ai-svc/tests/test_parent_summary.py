"""Wave E (S11) — agent-composed parent summaries.

Offline (faked gateway + faked quality gate via the sys.modules pattern).
Contract: the note is teach-tier, strictly parsed, quality-gated, retried
once with feedback, and EVERY failure path returns summary=None with a
fallback_reason — a parent never reads unvetted output.

Run with:  PYTHONPATH=services/ai-svc/src pytest services/ai-svc/tests/test_parent_summary.py -v
"""
from __future__ import annotations

import asyncio
import json
import sys
import types

from ai_svc.agent.parent_summary import (
    ParentSummaryRequest,
    SessionDigest,
    compose_parent_summary,
)


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _inject_gateway(monkeypatch, fake_generate):
    fake = types.ModuleType("ai_svc.services.llm_gateway")
    fake.generate_completion = fake_generate
    monkeypatch.setitem(sys.modules, "ai_svc.services.llm_gateway", fake)


def _inject_quality_gate(monkeypatch, passed=True, failed_gate="safety"):
    fake = types.ModuleType("ai_svc.services.quality_gate")

    def run_quality_gate(content, **_kwargs):
        if passed:
            return {"passed": True, "gates": []}
        return {"passed": False, "gates": [{"gate": failed_gate, "passed": False}]}

    fake.run_quality_gate = run_quality_gate
    monkeypatch.setitem(sys.modules, "ai_svc.services.quality_gate", fake)


def _req(**overrides) -> ParentSummaryRequest:
    base = dict(
        tutor_key="nova",
        tenant_id="t1",
        learner_id="l1",
        session_id="s1",
        learner_first_name="Sky",
        digest=SessionDigest(
            beats_completed=8,
            checks_correct=2,
            checks_total=3,
            scaffolds_inserted=1,
            remediations=1,
            breaks_taken=1,
            focus_skills=["3.OA.A.1 multiplication as groups"],
            decisions=["insert_scaffold", "advance", "offer_break", "advance"],
            evidence_notes=["worked example helped on equal groups"],
        ),
        delivery_level="3",
        functioning_level="STANDARD",
    )
    base.update(overrides)
    return ParentSummaryRequest(**base)


GOOD_SUMMARY = (
    "Sky practised multiplication as equal groups with Nova today, getting two of "
    "three checks right. A worked example before the tricky one really helped, and "
    "a short break kept the session calm."
)


def test_composes_a_gated_summary_on_the_teach_tier(monkeypatch):
    calls = []

    async def fake_generate(**kwargs):
        calls.append(kwargs)
        return {
            "content": json.dumps({"summary": GOOD_SUMMARY}),
            "model": "stub-teach",
            "prompt_tokens": 200,
            "completion_tokens": 60,
        }

    _inject_gateway(monkeypatch, fake_generate)
    _inject_quality_gate(monkeypatch, passed=True)

    result = _run(compose_parent_summary(_req()))
    assert result.summary == GOOD_SUMMARY
    assert result.fallback_reason is None
    assert result.model == "stub-teach"
    # Teach tier drives the chain; the digest (not raw transcripts) is the input.
    from ai_svc.agent.tiering import tier_chain

    assert calls[0]["model_chain"] == tier_chain("teach")
    assert "beats_completed" in calls[0]["user_prompt"]


def test_malformed_reply_is_retried_once_then_falls_back(monkeypatch):
    attempts = []

    async def fake_generate(**kwargs):
        attempts.append(kwargs["user_prompt"])
        return {"content": "not json at all", "model": "stub"}

    _inject_gateway(monkeypatch, fake_generate)
    _inject_quality_gate(monkeypatch, passed=True)

    result = _run(compose_parent_summary(_req()))
    assert result.summary is None
    assert result.fallback_reason == "validation_retries_exhausted"
    assert len(attempts) == 2
    assert "rejected" in attempts[1]


def test_quality_gate_failure_never_ships(monkeypatch):
    async def fake_generate(**_kwargs):
        return {"content": json.dumps({"summary": GOOD_SUMMARY}), "model": "stub"}

    _inject_gateway(monkeypatch, fake_generate)
    _inject_quality_gate(monkeypatch, passed=False, failed_gate="safety")

    result = _run(compose_parent_summary(_req()))
    assert result.summary is None
    assert result.fallback_reason == "validation_retries_exhausted"


def test_gateway_error_falls_back(monkeypatch):
    async def fake_generate(**_kwargs):
        raise TimeoutError("upstream slow")

    _inject_gateway(monkeypatch, fake_generate)
    _inject_quality_gate(monkeypatch, passed=True)

    result = _run(compose_parent_summary(_req()))
    assert result.summary is None
    assert result.fallback_reason == "gateway_error:TimeoutError"


def test_length_bounds_are_enforced(monkeypatch):
    async def fake_generate(**_kwargs):
        return {"content": json.dumps({"summary": "too short"}), "model": "stub"}

    _inject_gateway(monkeypatch, fake_generate)
    _inject_quality_gate(monkeypatch, passed=True)

    result = _run(compose_parent_summary(_req()))
    assert result.summary is None


def test_locale_rides_into_the_system_prompt(monkeypatch):
    seen = {}

    async def fake_generate(**kwargs):
        seen["system"] = kwargs["system_prompt"]
        return {"content": json.dumps({"summary": GOOD_SUMMARY}), "model": "stub"}

    _inject_gateway(monkeypatch, fake_generate)
    _inject_quality_gate(monkeypatch, passed=True)

    _run(compose_parent_summary(_req(locale="es")))
    assert "BCP-47 code es" in seen["system"]

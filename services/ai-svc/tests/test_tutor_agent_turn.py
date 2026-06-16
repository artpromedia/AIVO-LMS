"""Wave E (S7) — the tutor-agent turn loop.

Offline (faked gateway via the speech_buddy sys.modules pattern; the
quality gate is the real pure-regex implementation). The contract under
test: unvalidated model output can NEVER escape; one retry with the
error fed back; tool roundtrips capped; the token envelope and gateway
failures fall back without crashing; tiering selects the right chain;
unsafe learner-visible text is gated.

Run with:  PYTHONPATH=services/ai-svc/src pytest services/ai-svc/tests/test_tutor_agent_turn.py -v
"""
from __future__ import annotations

import asyncio
import json
import random
import string
import sys
import types

import pytest

from ai_svc.agent.actions import ReplyValidationError, parse_agent_reply
from ai_svc.agent.loop import AgentTurnRequest, run_turn
from ai_svc.agent.prompts import build_turn_prompts
from ai_svc.agent.tiering import MODEL_TIERS, TokenEnvelope, tier_chain


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def _inject_fake_gateway(monkeypatch, fake_generate):
    fake = types.ModuleType("ai_svc.services.llm_gateway")
    fake.generate_completion = fake_generate
    monkeypatch.setitem(sys.modules, "ai_svc.services.llm_gateway", fake)


def _req(**overrides) -> AgentTurnRequest:
    base = dict(
        tutor_key="nova",
        tenant_id="t1",
        learner_id="l1",
        session_id="s1",
        persona_context="You are Nova, AIVO's Mathematics tutor.",
        observation={"beat": "check", "correct": False, "latency_ms": 9000},
        allowed_actions=["advance", "remediate", "offer_break", "say"],
        token_envelope=TokenEnvelope(limit=8000, used=0),
    )
    base.update(overrides)
    return AgentTurnRequest(**base)


# ── parse_agent_reply (protocol strictness) ──────────────────────────────────


def test_parse_accepts_valid_action_and_strips_fences():
    reply = '```json\n{"action": {"kind": "remediate", "focus": "regroup tens", "approach": "worked_example"}, "rationale": "two misses"}\n```'
    parsed = parse_agent_reply(reply, allowed_actions=["remediate"], allowed_tools=[])
    assert parsed.action is not None and parsed.action.kind == "remediate"
    assert parsed.rationale == "two misses"


def test_parse_rejects_disallowed_kind_unknown_tool_and_ambiguity():
    with pytest.raises(ReplyValidationError, match="not allowed"):
        parse_agent_reply(
            '{"action": {"kind": "end_early", "reason": "tired"}}',
            allowed_actions=["advance"],
            allowed_tools=[],
        )
    with pytest.raises(ReplyValidationError, match="unknown tool"):
        parse_agent_reply(
            '{"tool_calls": [{"name": "rm_rf", "arguments": {}}]}',
            allowed_actions=["advance"],
            allowed_tools=["get_learner_snapshot"],
        )
    with pytest.raises(ReplyValidationError, match="exactly one"):
        parse_agent_reply(
            '{"action": {"kind": "advance"}, "tool_calls": []}',
            allowed_actions=["advance"],
            allowed_tools=[],
        )


def test_parse_never_lets_garbage_escape():
    rng = random.Random(42)
    for _ in range(25):
        garbage = "".join(
            rng.choice(string.printable) for _ in range(rng.randint(1, 300))
        )
        try:
            parsed = parse_agent_reply(
                garbage, allowed_actions=["advance", "say"], allowed_tools=["t"]
            )
        except ReplyValidationError:
            continue
        # The only way out is a fully validated shape.
        assert parsed.action is not None or parsed.tool_calls is not None


# ── run_turn ────────────────────────────────────────────────────────────────


def test_valid_action_passes_through_with_usage(monkeypatch):
    async def fake_generate(**kwargs):
        assert kwargs["response_format"] == {"type": "json_object"}
        return {
            "content": '{"action": {"kind": "remediate", "focus": "regroup the tens place"}, "rationale": "missed twice"}',
            "model": "fake-model",
            "prompt_tokens": 100,
            "completion_tokens": 30,
        }

    _inject_fake_gateway(monkeypatch, fake_generate)
    result = _run(run_turn(_req()))
    assert result.kind == "action"
    assert result.action is not None and result.action.kind == "remediate"
    assert result.usage.model == "fake-model"
    assert result.usage.prompt_tokens == 100


def test_malformed_reply_retries_once_with_feedback_then_falls_back(monkeypatch):
    calls: list[str] = []

    async def fake_generate(**kwargs):
        calls.append(kwargs["user_prompt"])
        return {"content": "i refuse to speak json", "model": "fake"}

    _inject_fake_gateway(monkeypatch, fake_generate)
    result = _run(run_turn(_req()))
    assert result.kind == "fallback"
    assert result.fallback_reason == "validation_retries_exhausted"
    assert len(calls) == 2
    # The second prompt carries the rejection feedback.
    assert "REJECTED" in calls[1]


def test_tool_request_roundtrip_and_cap(monkeypatch):
    async def fake_generate(**kwargs):
        return {
            "content": '{"tool_calls": [{"name": "get_learner_snapshot", "arguments": {}}], "rationale": "need profile"}',
            "model": "fake",
        }

    _inject_fake_gateway(monkeypatch, fake_generate)
    tools = [{"name": "get_learner_snapshot", "description": "d", "parameters": {}}]
    ok = _run(run_turn(_req(allowed_tools=tools, roundtrip=0)))
    assert ok.kind == "tool_request"
    assert ok.tool_calls is not None and ok.tool_calls[0].name == "get_learner_snapshot"
    # At the cap, another tool request degrades to fallback instead of looping.
    capped = _run(run_turn(_req(allowed_tools=tools, roundtrip=3)))
    assert capped.kind == "fallback"
    assert capped.fallback_reason == "tool_roundtrip_cap"
    over = _run(run_turn(_req(allowed_tools=tools, roundtrip=4)))
    assert over.fallback_reason == "tool_roundtrip_cap"


def test_token_envelope_exhaustion_skips_the_llm(monkeypatch):
    async def fake_generate(**kwargs):  # pragma: no cover — must not be called
        raise AssertionError("gateway must not be called when the envelope is spent")

    _inject_fake_gateway(monkeypatch, fake_generate)
    result = _run(run_turn(_req(token_envelope=TokenEnvelope(limit=8000, used=7900))))
    assert result.kind == "fallback"
    assert result.fallback_reason == "token_envelope_exhausted"


def test_gateway_failure_is_a_typed_fallback(monkeypatch):
    async def fake_generate(**kwargs):
        raise RuntimeError("budget cap exceeded")

    _inject_fake_gateway(monkeypatch, fake_generate)
    result = _run(run_turn(_req()))
    assert result.kind == "fallback"
    assert result.fallback_reason == "gateway_error:RuntimeError"


def test_tier_routing_passes_the_right_model_chain(monkeypatch):
    seen: dict[str, list[str]] = {}

    async def fake_generate(**kwargs):
        seen["chain"] = kwargs["model_chain"]
        return {"content": '{"action": {"kind": "advance"}}', "model": "fake"}

    _inject_fake_gateway(monkeypatch, fake_generate)
    _run(run_turn(_req(model_tier="plan")))
    assert seen["chain"] == MODEL_TIERS["plan"]
    # Env override retiers without a deploy.
    monkeypatch.setenv("AIVO_AGENT_MODELS_DECISION", "x/model-a, x/model-b")
    assert tier_chain("decision") == ["x/model-a", "x/model-b"]


def test_unsafe_say_text_is_gated_then_falls_back(monkeypatch):
    async def fake_generate(**kwargs):
        # "knife" trips the real safety gate's violence/weapons pattern.
        return {
            "content": json.dumps(
                {"action": {"kind": "say", "text": "Grab a knife and let's slice the fractions!"}}
            ),
            "model": "fake",
        }

    _inject_fake_gateway(monkeypatch, fake_generate)
    result = _run(run_turn(_req()))
    assert result.kind == "fallback"
    assert result.fallback_reason == "validation_retries_exhausted"


def test_garbage_completions_never_escape_run_turn(monkeypatch):
    rng = random.Random(7)

    async def fake_generate(**kwargs):
        return {
            "content": "".join(
                rng.choice(string.printable) for _ in range(rng.randint(1, 200))
            ),
            "model": "fake",
        }

    _inject_fake_gateway(monkeypatch, fake_generate)
    for _ in range(10):
        result = _run(run_turn(_req()))
        assert result.kind in ("fallback", "action", "tool_request")
        if result.kind == "action":
            # If randomness ever forms a valid action it is a VALIDATED one.
            assert result.action is not None and result.action.kind in (
                "advance",
                "remediate",
                "offer_break",
                "say",
            )


# ── language directive in the agentic turn prompt ────────────────────────────


def test_turn_prompt_defaults_to_english_directive():
    system, _user = build_turn_prompts(
        persona_context="You are Nova.",
        observation={"beat": "check"},
        allowed_actions=["advance", "say"],
        allowed_tools=[],
    )
    assert "Respond entirely in English" in system


def test_turn_prompt_honours_explicit_locale_code():
    system, _user = build_turn_prompts(
        persona_context="You are Nova.",
        observation={"beat": "check"},
        allowed_actions=["advance", "say"],
        allowed_tools=[],
        locale="es",
    )
    assert "Respond entirely in Spanish" in system


def test_turn_prompt_honours_language_name():
    # tutor-svc forwards the learner's stored language, which may be a name.
    system, _user = build_turn_prompts(
        persona_context="You are Nova.",
        observation={"beat": "check"},
        allowed_actions=["advance", "say"],
        allowed_tools=[],
        locale="French",
    )
    assert "Respond entirely in French" in system


def test_run_turn_threads_locale_into_the_system_prompt(monkeypatch):
    captured: dict = {}

    async def fake_generate(**kwargs):
        captured["system_prompt"] = kwargs.get("system_prompt", "")
        return {
            "content": json.dumps(
                {"action": {"kind": "advance"}, "rationale": "ready"}
            ),
            "model": "fake",
        }

    _inject_fake_gateway(monkeypatch, fake_generate)
    result = _run(run_turn(_req(locale="es")))
    assert result.kind == "action"
    assert "Respond entirely in Spanish" in captured["system_prompt"]

"""Tests for the Speech Buddy layer-3 LLM judge and SafetyFilter.check_async.

These exercise the production replacement for the ``_default_judge`` stub
without any network or ``litellm`` dependency: the real LLM call is faked by
injecting a stand-in ``llm_gateway`` module, and the filter is driven with
in-process async judge callables.
"""

from __future__ import annotations

import asyncio
import sys
import types
from typing import Optional

from ai_svc.speech_buddy import llm_judge as judge_mod
from ai_svc.speech_buddy.safety import SafetyFilter
from ai_svc.speech_buddy.types import SafetyFlagCategory


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


# --- SafetyFilter.check_async ------------------------------------------------


def test_check_async_without_judge_matches_sync_default():
    """No async judge → behaves like the deterministic sync default."""
    f = SafetyFilter()
    d = _run(f.check_async("I felt happy when my friend shared her snack.", source="child_input"))
    assert d.allowed is True
    # Same per-layer latency keys the sync path records.
    assert {"regex", "classifier", "llm_judge"} <= set(d.layer_latency_ms)


def test_check_async_awaits_real_judge_and_routes():
    """A configured async judge catches a paraphrase the regex layer misses."""

    async def fake_judge(text: str, source: str) -> Optional[SafetyFlagCategory]:
        return "self_harm" if "stop being around" in text.lower() else None

    f = SafetyFilter(async_judge=fake_judge)
    d = _run(f.check_async("I just want to stop being around anymore", source="child_input"))
    assert d.allowed is False
    assert d.flag is not None
    assert d.flag.category == "self_harm"
    assert d.flag.layer == "llm_judge"
    assert d.flag.severity == "hard"  # self_harm is a HARD category
    assert d.routed_text  # crisis script substituted


def test_check_async_regex_short_circuits_before_judge():
    """Layer 1 wins; the async judge is never consulted on a regex hit."""
    calls = {"n": 0}

    async def counting_judge(text: str, source: str):
        calls["n"] += 1
        return None

    f = SafetyFilter(async_judge=counting_judge)
    d = _run(f.check_async("I want to hurt myself", source="child_input"))
    assert d.allowed is False
    assert d.flag.layer == "regex"
    assert calls["n"] == 0


def test_check_async_judge_failure_fails_open():
    """A judge that raises must not break the turn — fail open to allow."""

    async def boom(text: str, source: str):
        raise RuntimeError("provider down")

    f = SafetyFilter(async_judge=boom)
    d = _run(f.check_async("totally ordinary sentence about recess", source="child_input"))
    assert d.allowed is True


# --- llm_judge_classify (gateway parsing) ------------------------------------


def _inject_fake_gateway(monkeypatch, fake_generate):
    """Put a stand-in llm_gateway module in sys.modules so the lazy import in
    llm_judge_classify resolves to it without importing litellm."""
    fake = types.ModuleType("ai_svc.services.llm_gateway")
    fake.generate_completion = fake_generate
    monkeypatch.setitem(sys.modules, "ai_svc.services.llm_gateway", fake)


def test_llm_judge_classify_parses_gateway_json(monkeypatch):
    async def fake_generate(**kwargs):
        return {"content": '{"category": "self_harm"}'}

    _inject_fake_gateway(monkeypatch, fake_generate)
    cat = _run(judge_mod.llm_judge_classify("i want to vanish forever", "child_input"))
    assert cat == "self_harm"


def test_llm_judge_classify_tolerates_chatty_wrapping(monkeypatch):
    async def fake_generate(**kwargs):
        return {"content": 'Sure: {"category": "abuse_disclosure"} hope that helps'}

    _inject_fake_gateway(monkeypatch, fake_generate)
    cat = _run(judge_mod.llm_judge_classify("someone keeps doing things to me", "child_input"))
    assert cat == "abuse_disclosure"


def test_llm_judge_classify_ignores_unknown_category(monkeypatch):
    async def fake_generate(**kwargs):
        return {"content": '{"category": "banana"}'}

    _inject_fake_gateway(monkeypatch, fake_generate)
    assert _run(judge_mod.llm_judge_classify("x", "child_input")) is None


def test_llm_judge_classify_fails_open_on_error(monkeypatch):
    async def boom(**kwargs):
        raise RuntimeError("provider down")

    _inject_fake_gateway(monkeypatch, boom)
    assert _run(judge_mod.llm_judge_classify("anything at all", "child_input")) is None


def test_llm_judge_classify_skips_empty_input():
    assert _run(judge_mod.llm_judge_classify("   ", "child_input")) is None


# --- provider gating ---------------------------------------------------------


def test_get_default_async_judge_off_by_default(monkeypatch):
    monkeypatch.delenv("SPEECH_BUDDY_JUDGE_PROVIDER", raising=False)
    assert judge_mod.get_default_async_judge() is None


def test_get_default_async_judge_enabled_with_llm(monkeypatch):
    monkeypatch.setenv("SPEECH_BUDDY_JUDGE_PROVIDER", "llm")
    assert judge_mod.get_default_async_judge() is not None

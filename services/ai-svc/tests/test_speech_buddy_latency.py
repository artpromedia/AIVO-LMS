"""Latency budget test for the Speech Buddy mock pipeline.

The acceptance bar (per task #40 acceptance criteria) is:
  median (p50) child end-of-utterance → first TTS audio byte < 1.2s on staging

This test runs the in-process mock pipeline (MockSTT + heuristic planner +
3-layer safety + MockTTS) 30 times and asserts the in-process p50 is well
under budget. Real-provider latency is captured separately on staging and
documented in docs/products/speech-buddy/agent-core.md.
"""
from __future__ import annotations

import asyncio
import statistics

from ai_svc.speech_buddy import (
    DefaultOrchestrator,
    DefaultToolset,
    EventEmitter,
    MockSTT,
    MockTTS,
    SafetyFilter,
)


def test_mock_pipeline_p50_under_budget():
    async def go():
        orch = DefaultOrchestrator(
            stt=MockSTT(),
            tts=MockTTS(),
            toolset=DefaultToolset(),
            emitter=EventEmitter(),
            safety=SafetyFilter(),
        )
        session = await orch.start_session(
            tenant_id="tenant-latency",
            learner_id="learner-latency",
            age_band="10-12",
            locale="en",
            consent_record_id="consent-abc",
        )
        samples_ms: list[float] = []
        for i in range(30):
            out = await orch.run_turn(
                session.id,
                text=f"This is turn number {i} and I'm asking what kind of game you like?",
            )
            samples_ms.append(out.trace.total_ms)
        p50 = statistics.median(samples_ms)
        p95 = sorted(samples_ms)[int(0.95 * len(samples_ms))]
        assert p50 < 1200.0, f"mock pipeline p50={p50:.1f}ms exceeded 1200ms budget"
        assert p95 < 1200.0, f"mock pipeline p95={p95:.1f}ms exceeded 1200ms budget"
    asyncio.new_event_loop().run_until_complete(go())

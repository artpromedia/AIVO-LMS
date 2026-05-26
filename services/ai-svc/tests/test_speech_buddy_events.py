"""Tests for the Sprint 12.5 event bus publishing path.

We assert the EventBusPublisher constructs a correctly-shaped envelope
(matching the AivoEvent TS type) and POSTs it to the configured bus
URL. Failures must never raise into the caller — the safety/orchestrator
path must keep working even when the bus is down.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from ai_svc.speech_buddy import events as events_mod


@pytest.fixture(autouse=True)
def reset_publisher(monkeypatch):
    events_mod.EventBusPublisher._client = None
    yield
    events_mod.EventBusPublisher._client = None


def test_event_bus_publishes_to_event_bus_url(monkeypatch):
    monkeypatch.setenv("EVENT_BUS_URL", "https://bus.example/api/events")
    monkeypatch.setattr(events_mod, "EVENT_BUS_URL", "https://bus.example/api/events")

    captured: dict = {}

    class FakeClient:
        def post(self, url, json=None):
            captured["url"] = url
            captured["body"] = json
            r = MagicMock()
            r.status_code = 202
            return r

        def close(self):
            pass

    monkeypatch.setattr(events_mod.EventBusPublisher, "_http", classmethod(lambda cls: FakeClient()))

    emitter = events_mod.EventEmitter()
    emitter.session_started(
        session_id="s1",
        age_band="10-12",
        locale="en-US",
        targeted_skills=("name_a_feeling",),
    )

    assert captured["url"] == "https://bus.example/api/events"
    body = captured["body"]
    assert body["type"] == events_mod.EVT_SESSION_STARTED
    assert body["source"] == "ai-svc.speech_buddy"
    assert body["payload"]["sessionId"] == "s1"
    assert body["payload"]["ageBand"] == "10-12"
    assert "timestamp" in body
    assert "id" in body


def test_event_bus_failure_does_not_raise(monkeypatch):
    """A 5xx / connection error from the bus must be swallowed so the
    speech-buddy session loop keeps working."""
    class FakeClient:
        def post(self, url, json=None):
            raise RuntimeError("connection refused")

    monkeypatch.setattr(events_mod.EventBusPublisher, "_http", classmethod(lambda cls: FakeClient()))

    emitter = events_mod.EventEmitter()
    # Must not raise.
    emitter.turn_recorded(
        session_id="s1",
        turn_index=0,
        correlation_id="cid",
        speaker="child",
        safety_flag_count=0,
    )
    # And the in-process emitted list still captures it (so the
    # secondary logger observer also fires).
    assert len(emitter.emitted) == 1


def test_structured_log_is_still_emitted_as_secondary_observer(monkeypatch, caplog):
    """The structured log line is preserved as a secondary observer."""
    class FakeClient:
        def post(self, url, json=None):
            r = MagicMock()
            r.status_code = 202
            return r

    monkeypatch.setattr(events_mod.EventBusPublisher, "_http", classmethod(lambda cls: FakeClient()))
    caplog.set_level("INFO", logger="ai-svc.speech_buddy.events")

    emitter = events_mod.EventEmitter()
    emitter.session_ended(
        session_id="s1",
        duration_seconds=42,
        turn_count=3,
        skill_evidence_totals={},
        quest_assigned=None,
        ended_reason="completed",
    )
    log_messages = [rec.getMessage() for rec in caplog.records]
    assert any("speech_buddy.event" in m for m in log_messages)

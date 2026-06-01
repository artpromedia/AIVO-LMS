"""Sprint 2 (production readiness) — Speech Buddy telemetry event outbox.

The EventEmitter telemetry path used to be log-only ("the structured log line
is the bus"), so skill-evidence/session events never reached the mastery
pipeline. It now writes a durable outbox and `flush_events()` drains it to
NATS. These tests pin that behaviour without a live broker.
"""
from __future__ import annotations

import asyncio
import json
import sys

from ai_svc.speech_buddy.events import EventEmitter


def test_emit_writes_durable_outbox(tmp_path, monkeypatch):
    monkeypatch.setenv("SPEECH_BUDDY_EVENT_OUTBOX_DIR", str(tmp_path))
    monkeypatch.delenv("NATS_URL", raising=False)
    em = EventEmitter()
    em.session_started(
        session_id="s1", age_band="6-8", locale="en", targeted_skills=("ask_open_question",)
    )
    em.skill_evidence(
        session_id="s1", learner_id_hash="h", age_band="6-8", skill="ask_open_question", weight=0.5
    )
    files = sorted(tmp_path.glob("*.json"))
    assert len(files) == 2
    types = [json.loads(f.read_text())["type"] for f in files]
    assert "speech_buddy.session.started" in types
    assert "speech_buddy.skill.evidence" in types


def test_flush_is_noop_without_nats(tmp_path, monkeypatch):
    monkeypatch.setenv("SPEECH_BUDDY_EVENT_OUTBOX_DIR", str(tmp_path))
    monkeypatch.delenv("NATS_URL", raising=False)
    em = EventEmitter()
    em.quest_assigned(session_id="s1", quest="q", skill="ask_open_question")
    assert asyncio.run(em.flush_events()) == 0
    # Event is preserved for a later flush once a broker is configured.
    assert len(list(tmp_path.glob("*.json"))) == 1


def test_flush_publishes_to_nats_and_clears_outbox(tmp_path, monkeypatch):
    monkeypatch.setenv("SPEECH_BUDDY_EVENT_OUTBOX_DIR", str(tmp_path))
    monkeypatch.setenv("NATS_URL", "nats://fake:4222")
    em = EventEmitter()
    em.session_ended(
        session_id="s1",
        duration_seconds=10,
        turn_count=3,
        skill_evidence_totals={"ask_open_question": 1.0},
        quest_assigned=None,
        ended_reason="completed",
    )

    published: list[tuple[str, bytes]] = []

    class FakeNC:
        async def publish(self, topic, data):
            published.append((topic, data))

        async def flush(self):
            pass

        async def drain(self):
            pass

    class FakeNats:
        async def connect(self, servers=None):
            return FakeNC()

    monkeypatch.setitem(sys.modules, "nats", FakeNats())

    assert asyncio.run(em.flush_events()) == 1
    assert len(published) == 1
    topic, data = published[0]
    assert topic == "speech_buddy.events"
    assert json.loads(data.decode())["type"] == "speech_buddy.session.ended"
    assert list(tmp_path.glob("*.json")) == []  # cleared on success


def test_flush_preserves_event_on_publish_failure(tmp_path, monkeypatch):
    monkeypatch.setenv("SPEECH_BUDDY_EVENT_OUTBOX_DIR", str(tmp_path))
    monkeypatch.setenv("NATS_URL", "nats://fake:4222")
    em = EventEmitter()
    em.turn_recorded(
        session_id="s1", turn_index=0, correlation_id="c", speaker="child", safety_flag_count=0
    )

    class BoomNC:
        async def publish(self, topic, data):
            raise RuntimeError("broker down")

        async def flush(self):
            pass

        async def drain(self):
            pass

    class FakeNats:
        async def connect(self, servers=None):
            return BoomNC()

    monkeypatch.setitem(sys.modules, "nats", FakeNats())

    assert asyncio.run(em.flush_events()) == 0
    # The event survives the outage for the next flush / ops sweep.
    assert len(list(tmp_path.glob("*.json"))) == 1

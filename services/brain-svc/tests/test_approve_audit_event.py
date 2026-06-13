"""Sprint C-06 — approve / amend / decline emit audit events in parity with
BRAIN_CLONED.

Before this sprint only the clone route emitted an audit event; the parent's
approval (the most consequential act) left no hash-chained trail. These tests
capture the emit_brain_audit call the handlers now make and assert the event
type + payload.

Same direct-call pattern as test_approve_rai_gate.py.

Run with: pytest services/brain-svc/tests/test_approve_audit_event.py -v
"""
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from brain_svc.models.schemas import (
    BrainApproveRequest,
    BrainAmendRequest,
    BrainDeclineRequest,
)
from brain_svc.routes.brain import approve_brain, amend_brain, decline_brain


def _fake_auth(sub: str = "parent_123", role: str = "PARENT"):
    return SimpleNamespace(sub=sub, role=role, user_id=sub, tenant_id="t_1")


def _fake_db_with_brain(version: int = 1):
    """MagicMock Session returning one pending brain row from SELECT; the
    PARENT-scope SELECT is satisfied by returning a parent_id matching auth."""
    db = MagicMock()
    brain_row = {
        "id": "bs_1",
        "version": version,
        "approval_status": "pending_parent_review",
        "mastery_levels": {"math": 0.5},
        "active_accommodations": [],
        "active_tutors": [],
        "xai_explanation": {},
        "disability_signals": {},
        "functioning_level_profile": {"level": "STANDARD"},
        "iep_profile": None,
        "sensory_profile": None,
        "functional_curriculum": None,
        "episodic_memory": [],
        "visual_identity": None,
        # _verify_parent_access for PARENT role reads parent_id from a learner
        # row; first() returns this same mapping, so parent_id must match auth.
        "parent_id": "parent_123",
    }
    select_result = MagicMock()
    select_result.mappings.return_value.first.return_value = brain_row
    # _verify_parent_access uses .first() (not .mappings().first()) on the
    # learners SELECT — return a tuple whose [0] is the matching parent id.
    select_result.first.return_value = ("parent_123",)
    db.execute.return_value = select_result
    return db


class _AuditSpy:
    def __init__(self):
        self.calls = []

    async def __call__(self, **kwargs):
        self.calls.append(kwargs)
        return None


@pytest.fixture
def audit_spy(monkeypatch):
    import brain_svc.routes.brain as brain_module

    spy = _AuditSpy()
    monkeypatch.setattr(brain_module, "emit_brain_audit", spy, raising=False)
    return spy


class TestApproveAuditEvent:
    @pytest.mark.asyncio
    async def test_approve_emits_brain_approved(self, audit_spy):
        request = BrainApproveRequest(
            consent_given=True,
            consent_version="2.0",
            rai_acknowledged=True,
            rai_version="5",
        )
        await approve_brain(
            learner_id="lr_1",
            request=request,
            db=_fake_db_with_brain(version=4),
            auth=_fake_auth(),
        )
        events = [c for c in audit_spy.calls if c.get("event_type") == "BRAIN_APPROVED"]
        assert len(events) == 1, f"expected one BRAIN_APPROVED, got {audit_spy.calls}"
        ev = events[0]
        assert ev["learner_id"] == "lr_1"
        assert ev["actor_user_id"] == "parent_123"
        assert ev["details"]["consent_version"] == "2.0"
        assert ev["details"]["rai_version"] == "5"
        # New version is the reviewed version + 1.
        assert ev["details"]["version"] == 5

    @pytest.mark.asyncio
    async def test_amend_emits_brain_amended(self, audit_spy):
        await amend_brain(
            learner_id="lr_1",
            request=BrainAmendRequest(parent_notes="Add context: loves dinosaurs."),
            db=_fake_db_with_brain(version=2),
            auth=_fake_auth(),
        )
        events = [c for c in audit_spy.calls if c.get("event_type") == "BRAIN_AMENDED"]
        assert len(events) == 1
        assert events[0]["details"]["version"] == 3

    @pytest.mark.asyncio
    async def test_decline_emits_brain_declined(self, audit_spy):
        await decline_brain(
            learner_id="lr_1",
            request=BrainDeclineRequest(reason="Too low."),
            db=_fake_db_with_brain(version=1),
            auth=_fake_auth(),
        )
        events = [c for c in audit_spy.calls if c.get("event_type") == "BRAIN_DECLINED"]
        assert len(events) == 1
        assert events[0]["details"]["reason"] == "Too low."

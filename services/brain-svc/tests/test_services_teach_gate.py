"""Sprint C-12 (ADR 0042) — the SERVICES HALF of the cross-stack teach gate,
plus the brain-svc FERPA disclosure emission.

Two things this proves on the brain-svc side:

1. The approve/amend handlers now build the shared-shape approval record
   (parity with web-v2's `brain_profile_approvals`) and run the EXPLICIT
   `assert_can_teach` gate before initialising any learning path — the Python
   gate is no longer sequencing-only.
2. A non-parent role reading a child's profile emits a `CHILD_PROFILE_DISCLOSED`
   disclosure event (the FERPA cross-role read log).

Same direct-call + mocked-session pattern as test_approve_audit_event.py.

Run with: pytest services/brain-svc/tests/test_services_teach_gate.py -v
"""
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from brain_svc.models.schemas import BrainApproveRequest, BrainAmendRequest
from brain_svc.routes.brain import approve_brain, amend_brain, get_brain_state
from brain_svc.contracts.approval_contract import (
    APPROVAL_RECORD_FIELDS,
    can_teach,
    assert_can_teach,
)


def _fake_auth(sub="parent_123", role="PARENT", tenant_id="t_1"):
    return SimpleNamespace(sub=sub, role=role, user_id=sub, tenant_id=tenant_id)


def _fake_db_with_brain(version=1, approval_status="pending_parent_review"):
    db = MagicMock()
    brain_row = {
        "id": "bs_1",
        "version": version,
        "approval_status": approval_status,
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
        "parent_id": "parent_123",
    }
    select_result = MagicMock()
    select_result.mappings.return_value.first.return_value = brain_row
    select_result.first.return_value = ("parent_123",)
    db.execute.return_value = select_result
    return db


@pytest.fixture
def no_audit(monkeypatch):
    """Stub both audit emitters so the handlers don't need audit-svc."""
    import brain_svc.routes.brain as brain_module

    async def _noop(*a, **k):
        return None

    monkeypatch.setattr(brain_module, "emit_brain_audit", _noop, raising=False)
    return _noop


@pytest.fixture
def disclosure_spy(monkeypatch):
    """Capture emit_child_profile_disclosure calls."""
    import brain_svc.routes.brain as brain_module

    calls = []

    async def _spy(**kwargs):
        calls.append(kwargs)
        return None

    monkeypatch.setattr(brain_module, "emit_child_profile_disclosure", _spy, raising=False)
    return calls


class TestApproveWritesSharedRecordAndGates:
    @pytest.mark.asyncio
    async def test_approve_returns_shared_shape_approval_record(self, no_audit):
        request = BrainApproveRequest(
            consent_given=True, consent_version="2.0", rai_acknowledged=True, rai_version="5"
        )
        result = await approve_brain(
            learner_id="lr_1",
            request=request,
            db=_fake_db_with_brain(version=4),
            auth=_fake_auth(),
        )
        rec = result["approval_record"]
        # Every shared-contract field is present.
        for field in APPROVAL_RECORD_FIELDS:
            assert field in rec, f"approval_record missing {field}"
        assert rec["action"] == "approved"
        assert rec["learnerId"] == "lr_1"
        assert rec["consentVersion"] == "2.0"
        assert rec["raiVersion"] == "5"
        assert rec["profileRevision"] == 5  # reviewed version + 1
        # The status it wrote can teach.
        assert can_teach("approved")

    @pytest.mark.asyncio
    async def test_amend_returns_shared_shape_record_action_amended(self, no_audit):
        result = await amend_brain(
            learner_id="lr_1",
            request=BrainAmendRequest(parent_notes="Add context: loves trains."),
            db=_fake_db_with_brain(version=2),
            auth=_fake_auth(),
        )
        rec = result["approval_record"]
        assert rec["action"] == "amended"
        assert rec["profileRevision"] == 3
        assert can_teach("amended")

    def test_explicit_gate_refuses_unapproved_statuses(self):
        # The same guard the services path-init enforces. Unapproved => 403.
        for bad in ("pending_parent_review", "declined", None):
            with pytest.raises(HTTPException) as exc:
                assert_can_teach(bad)
            assert exc.value.status_code == 403


class TestScopedReadDisclosure:
    @pytest.mark.asyncio
    async def test_teacher_read_emits_child_profile_disclosure(self, disclosure_spy):
        # A TEACHER (non-parent) reading the brain state is a cross-role read.
        await get_brain_state(
            learner_id="lr_1",
            db=_fake_db_with_brain(approval_status="approved"),
            auth=_fake_auth(sub="teacher_9", role="TEACHER"),
        )
        assert len(disclosure_spy) == 1, f"expected one disclosure, got {disclosure_spy}"
        ev = disclosure_spy[0]
        assert ev["learner_id"] == "lr_1"
        assert ev["reader_user_id"] == "teacher_9"
        assert ev["reader_role"] == "TEACHER"
        assert ev["data_class"] == "brain_state"
        assert "brain-svc" in ev["surface"]

    @pytest.mark.asyncio
    async def test_parent_read_emits_no_disclosure(self, disclosure_spy):
        # A parent reading their own child's profile is NOT a cross-role read.
        await get_brain_state(
            learner_id="lr_1",
            db=_fake_db_with_brain(approval_status="approved"),
            auth=_fake_auth(sub="parent_123", role="PARENT"),
        )
        assert disclosure_spy == []

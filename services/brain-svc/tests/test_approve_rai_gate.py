"""Sprint A4 — server-side enforcement of the Responsible-AI
acknowledgement gate on the brain approval endpoint.

The frontend (Sprint A4 frontend, deferred) disables the Approve
button until the parent expands the RAI panel and ticks the
acknowledgement checkbox. These tests are the defense-in-depth
server-side guard: a misbehaving client must be unable to mark a
clone "approved" without the acknowledgement.

Tests call the route function directly with mocked dependencies
rather than booting a TestClient — that keeps them fast and avoids
needing a Postgres / auth stack in the unit-test environment.

Run with: pytest services/brain-svc/tests/test_approve_rai_gate.py -v
"""
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from brain_svc.models.schemas import BrainApproveRequest
from brain_svc.routes.brain import approve_brain


def _fake_auth(sub: str = "parent_123", role: str = "admin"):
    # `admin` skips _verify_parent_access without needing a learner row.
    return SimpleNamespace(sub=sub, role=role)


def _fake_db_with_brain(version: int = 1):
    """Build a MagicMock Session that returns a single pending brain_state
    row from the first SELECT and accepts all subsequent UPDATE/INSERT
    statements as no-ops."""
    db = MagicMock()
    brain_row = {
        "id": "bs_1",
        "version": version,
        "approval_status": "pending_parent_review",
        "mastery_levels": {},
        "active_accommodations": [],
        "active_tutors": [],
        "xai_explanation": {},
        "disability_signals": {},
        "functioning_level_profile": {"level": "STANDARD"},
        "iep_profile": None,
        "sensory_profile": None,
        "functional_curriculum": None,
        "episodic_memory": None,
        "visual_identity": None,
    }
    # The route does two SELECTs (the second is _verify_parent_access for
    # PARENT role, which we skip via admin), then UPDATE + INSERT.
    select_first = MagicMock()
    select_first.mappings.return_value.first.return_value = brain_row
    db.execute.return_value = select_first
    return db


class TestApproveRaiGate:
    @pytest.mark.asyncio
    async def test_rejects_when_rai_not_acknowledged(self):
        request = BrainApproveRequest(
            consent_given=True,
            consent_version="1.0",
            rai_acknowledged=False,
        )
        with pytest.raises(HTTPException) as exc_info:
            await approve_brain(
                learner_id="lr_1",
                request=request,
                db=_fake_db_with_brain(),
                auth=_fake_auth(),
            )
        assert exc_info.value.status_code == 400
        assert "Responsible-AI" in exc_info.value.detail or "RAI" in exc_info.value.detail.upper() or "responsible" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_rejects_when_consent_not_given_even_if_rai_ack(self):
        # COPPA consent gate is checked first — make sure adding the RAI
        # ack field doesn't accidentally let an un-consented request through.
        request = BrainApproveRequest(
            consent_given=False,
            consent_version="1.0",
            rai_acknowledged=True,
        )
        with pytest.raises(HTTPException) as exc_info:
            await approve_brain(
                learner_id="lr_1",
                request=request,
                db=_fake_db_with_brain(),
                auth=_fake_auth(),
            )
        assert exc_info.value.status_code == 400
        assert "COPPA" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_persists_rai_acknowledgement_on_success(self, monkeypatch):
        # Force the post-approval learning-svc fan-out to no-op so we don't
        # need a real httpx connection in the test environment.
        import brain_svc.routes.brain as brain_module

        monkeypatch.setattr(brain_module, "emit_brain_audit", lambda *a, **k: None, raising=False)

        request = BrainApproveRequest(
            consent_given=True,
            consent_version="1.0",
            rai_acknowledged=True,
            rai_version="7",
        )
        db = _fake_db_with_brain(version=6)

        result = await approve_brain(
            learner_id="lr_1",
            request=request,
            db=db,
            auth=_fake_auth(),
        )

        assert result["status"] == "approved"
        # New response contract includes the RAI acknowledgement record.
        ack = result["rai_acknowledgement"]
        assert ack["rai_acknowledged"] is True
        assert ack["rai_version"] == "7"
        assert ack["parent_id"] == "parent_123"
        # Timestamp is ISO 8601 parseable.
        datetime.fromisoformat(ack["rai_timestamp"])

    @pytest.mark.asyncio
    async def test_defaults_rai_version_to_brain_state_version(self):
        # When the client doesn't pin rai_version, the route falls back
        # to the brain-state version the parent reviewed (so a later
        # re-clone bumps `version` and invalidates the ack window).
        request = BrainApproveRequest(
            consent_given=True,
            consent_version="1.0",
            rai_acknowledged=True,
            # rai_version intentionally omitted
        )
        db = _fake_db_with_brain(version=3)

        result = await approve_brain(
            learner_id="lr_1",
            request=request,
            db=db,
            auth=_fake_auth(),
        )
        assert result["rai_acknowledgement"]["rai_version"] == "3"

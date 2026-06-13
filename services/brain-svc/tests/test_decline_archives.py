"""Sprint C-06 — declining a brain profile ARCHIVES, it never destroys the
child's baseline work.

Before this sprint the decline handler deleted the brain state, every
snapshot, AND every `discovery_adventure` assessment_attempt for the learner
— wiping out the baseline the child actually completed. Declining is a parent
rejecting the AI's *inference*, not the child's effort, so it must now:

  - keep the brain_states row (approval_status flipped to 'declined'),
  - write a `parent_declined` snapshot for the trail,
  - and leave `assessment_attempts` untouched.

Tests call the route function directly with a SQL-capturing MagicMock Session
(same pattern as test_approve_rai_gate.py / test_brain_access_control.py) and
assert on the statements the handler issued.

Run with: pytest services/brain-svc/tests/test_decline_archives.py -v
"""
import re
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from brain_svc.models.schemas import BrainDeclineRequest
from brain_svc.routes.brain import decline_brain


def _fake_auth(sub: str = "parent_123", role: str = "admin"):
    # `admin` skips _verify_parent_access without needing a learner row.
    return SimpleNamespace(sub=sub, role=role)


def _norm(sql: str) -> str:
    return re.sub(r"\s+", " ", sql).strip().upper()


class _CapturingDb:
    """MagicMock-like Session that returns one pending brain row from the
    first SELECT and records every SQL statement it is asked to execute."""

    def __init__(self, version: int = 1, status: str = "pending_parent_review"):
        self.statements: list[str] = []
        self.committed = False
        self._brain_row = {
            "id": "bs_1",
            "version": version,
            "approval_status": status,
            "mastery_levels": {"math": 0.4},
            "active_accommodations": ["extended_time"],
            "active_tutors": ["nova"],
            "disability_signals": {},
            "functioning_level_profile": {"level": "STANDARD"},
            "iep_profile": None,
            "sensory_profile": None,
            "functional_curriculum": None,
            "episodic_memory": [],
            "visual_identity": None,
        }

    def execute(self, statement, params=None):
        # `statement` is a SQLAlchemy TextClause; str() yields the SQL.
        self.statements.append(str(statement))
        result = MagicMock()
        result.mappings.return_value.first.return_value = self._brain_row
        return result

    def commit(self):
        self.committed = True


async def _noop_audit(*a, **k):
    return None


@pytest.fixture(autouse=True)
def _stub_audit(monkeypatch):
    import brain_svc.routes.brain as brain_module

    monkeypatch.setattr(brain_module, "emit_brain_audit", _noop_audit, raising=False)


class TestDeclineArchives:
    @pytest.mark.asyncio
    async def test_does_not_delete_assessment_attempts(self):
        db = _CapturingDb()
        await decline_brain(
            learner_id="lr_1",
            request=BrainDeclineRequest(reason="The reading level looks too low."),
            db=db,
            auth=_fake_auth(),
        )
        # The whole point of the fix: no DELETE against assessment_attempts.
        attempts_deletes = [
            s for s in db.statements
            if "DELETE" in _norm(s) and "ASSESSMENT_ATTEMPTS" in _norm(s)
        ]
        assert attempts_deletes == [], (
            "decline must not delete the child's assessment_attempts: "
            f"{attempts_deletes}"
        )

    @pytest.mark.asyncio
    async def test_does_not_delete_the_brain_state_or_snapshots(self):
        db = _CapturingDb()
        await decline_brain(
            learner_id="lr_1",
            request=BrainDeclineRequest(reason=None),
            db=db,
            auth=_fake_auth(),
        )
        # No destructive DELETE of brain_states or brain_state_snapshots.
        any_delete = [s for s in db.statements if _norm(s).startswith("DELETE")]
        assert any_delete == [], f"decline must archive, not DELETE: {any_delete}"

    @pytest.mark.asyncio
    async def test_flips_status_to_declined(self):
        db = _CapturingDb()
        await decline_brain(
            learner_id="lr_1",
            request=BrainDeclineRequest(reason="Mismatch."),
            db=db,
            auth=_fake_auth(),
        )
        updates = [s for s in db.statements if _norm(s).startswith("UPDATE BRAIN_STATES")]
        assert len(updates) == 1
        assert "APPROVAL_STATUS = 'DECLINED'" in _norm(updates[0])

    @pytest.mark.asyncio
    async def test_writes_a_parent_declined_snapshot(self):
        db = _CapturingDb()
        result = await decline_brain(
            learner_id="lr_1",
            request=BrainDeclineRequest(reason="Mismatch."),
            db=db,
            auth=_fake_auth(),
        )
        snap_inserts = [
            s for s in db.statements
            if "INSERT INTO BRAIN_STATE_SNAPSHOTS" in _norm(s)
        ]
        assert len(snap_inserts) == 1
        assert "PARENT_DECLINED" in _norm(snap_inserts[0])
        assert result["status"] == "declined"
        assert result["snapshot_id"]
        assert db.committed is True

    @pytest.mark.asyncio
    async def test_rejects_when_already_approved(self):
        db = _CapturingDb(status="approved")
        with pytest.raises(HTTPException) as exc_info:
            await decline_brain(
                learner_id="lr_1",
                request=BrainDeclineRequest(reason=None),
                db=db,
                auth=_fake_auth(),
            )
        assert exc_info.value.status_code == 400

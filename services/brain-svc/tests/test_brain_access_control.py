"""Sprint C-02 — learner-scope enforcement on every brain/snapshot route.

`require_auth` only validates the JWT; before this sprint the brain-state,
history, rollback, context, regression-check, engagement and snapshot
endpoints performed no learner-scope check at all, so any authenticated
user could read (or roll back) any child's brain. These tests pin the
fix: reads require a verified relationship via
`brain_svc.services.access_control.verify_learner_access`, rollback is a
guardian act gated by `_verify_parent_access`, and snapshot detail
resolves the owning learner before any data is returned.

Tests call the route functions directly with mocked dependencies rather
than booting a TestClient — same pattern as test_approve_rai_gate.py.
The MagicMock Session dispatches on the SQL text against a tiny seeded
world so the real access-control helpers execute their actual queries:

  - lr_1 is parented by parent_1; lr_2 by parent_2.
  - teacher_1 holds the only ACCEPTED learner_teachers row, for lr_1.
  - lr_1 has a brain state and one snapshot (snap_1); lr_2 has snap_2.

Run with: pytest services/brain-svc/tests/test_brain_access_control.py -v
"""
import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from brain_svc.models.schemas import BrainRollbackRequest
from brain_svc.routes.brain import (
    check_regression,
    get_brain_context,
    get_brain_history,
    get_brain_state,
    rollback_brain,
    update_engagement_profile,
)
from brain_svc.routes.snapshots import get_snapshot, list_snapshots

LEARNER_ID = "lr_1"
OTHER_LEARNER_ID = "lr_2"
PARENT_ID = "parent_1"
OTHER_PARENT_ID = "parent_2"
TEACHER_ID = "teacher_1"

# Relationship seeds consulted by the SQL dispatcher below.
_LEARNER_PARENTS = {LEARNER_ID: PARENT_ID, OTHER_LEARNER_ID: OTHER_PARENT_ID}
_ACCEPTED_TEACHERS = {(LEARNER_ID, TEACHER_ID)}


def _auth(sub: str, role: str):
    return SimpleNamespace(sub=sub, role=role)


# The cast of callers exercised against lr_1's data.
PARENT = _auth(PARENT_ID, "PARENT")
ACCEPTED_TEACHER = _auth(TEACHER_ID, "TEACHER")
UNRELATED_TEACHER = _auth("teacher_999", "TEACHER")
UNRELATED_LEARNER = _auth(OTHER_LEARNER_ID, "LEARNER")
UNRELATED_PARENT = _auth(OTHER_PARENT_ID, "PARENT")  # real parent — of lr_2
SELF_LEARNER = _auth(LEARNER_ID, "LEARNER")
SERVICE = _auth("service", "service")
ADMIN = _auth("admin_1", "admin")
LOWERCASE_TEACHER = _auth("teacher_999", "teacher")  # the old engagement hole


def _brain_row(learner_id: str) -> dict:
    return {
        "id": f"bs_{learner_id}",
        "learner_id": learner_id,
        "version": 3,
        "approval_status": "approved",
        "mastery_levels": {"math": 0.5},
        "active_accommodations": [],
        "active_tutors": ["nova"],
        "xai_explanation": {},
        "disability_signals": {"dyslexia_markers": 0.2},
        "functioning_level_profile": {"level": "STANDARD"},
        "iep_profile": None,
        "sensory_profile": None,
        "functional_curriculum": None,
        "episodic_memory": [],
        "visual_identity": None,
    }


def _snapshot_row(snapshot_id: str, learner_id: str, version: int = 2) -> dict:
    return {
        "id": snapshot_id,
        "brain_state_id": f"bs_{learner_id}",
        "learner_id": learner_id,
        "version": version,
        "trigger": "parent_approved",
        "snapshot": json.dumps(
            {
                "mastery_levels": {"math": 0.4},
                "disability_signals": {},
                "functioning_level_profile": {"level": "STANDARD"},
                "iep_profile": {},
                "sensory_profile": {},
                "active_accommodations": [],
                "active_tutors": ["nova"],
            }
        ),
        "created_at": None,
    }


def _result(first=None, mfirst=None, mall=None):
    res = MagicMock()
    res.first.return_value = first
    res.mappings.return_value.first.return_value = mfirst
    res.mappings.return_value.all.return_value = mall if mall is not None else []
    return res


def _fake_db():
    """MagicMock Session whose execute() dispatches on the SQL text, so the
    real verify_learner_access / _verify_parent_access queries run against
    the seeded relationship world. Writes are accepted as no-ops."""
    brains = {LEARNER_ID: _brain_row(LEARNER_ID)}
    snapshots = [
        _snapshot_row("snap_1", LEARNER_ID),
        _snapshot_row("snap_2", OTHER_LEARNER_ID),
    ]
    db = MagicMock()

    def execute(stmt, params=None):
        sql = " ".join(str(stmt).split())
        p = params or {}
        # Access-control lookups.
        if "SELECT parent_id FROM learners" in sql:
            pid = _LEARNER_PARENTS.get(p.get("lid"))
            return _result(first=(pid,) if pid else None)
        if "FROM learner_teachers" in sql:
            linked = (p.get("lid"), p.get("uid")) in _ACCEPTED_TEACHERS
            return _result(first=(1,) if linked else None)
        if "FROM learner_caregivers" in sql or "FROM learner_therapists" in sql:
            return _result(first=None)
        # Writes (UPDATE brain_states / INSERT snapshot) are no-ops.
        if sql.startswith("UPDATE") or sql.startswith("INSERT"):
            return _result()
        # Snapshot reads.
        if "FROM brain_state_snapshots" in sql:
            if "WHERE id = :sid" in sql:
                for snap in snapshots:
                    if snap["id"] != p.get("sid"):
                        continue
                    if "learner_id = :lid" in sql and snap["learner_id"] != p.get("lid"):
                        continue
                    return _result(mfirst=snap)
                return _result(mfirst=None)
            rows = [s for s in snapshots if s["learner_id"] == p.get("lid")]
            return _result(mall=rows, mfirst=rows[0] if rows else None)
        # Latest brain state for a learner.
        if "FROM brain_states" in sql:
            return _result(mfirst=brains.get(p.get("lid")))
        # Context aggregation lookups (sensory/iep/goals/...) — empty.
        return _result()

    db.execute.side_effect = execute
    return db


async def _invoke(endpoint: str, db, auth):
    """Call one of the newly-scoped endpoints against lr_1's data."""
    if endpoint == "get_brain_state":
        return await get_brain_state(learner_id=LEARNER_ID, db=db, auth=auth)
    if endpoint == "get_brain_history":
        return await get_brain_history(learner_id=LEARNER_ID, db=db, auth=auth)
    if endpoint == "get_brain_context":
        return await get_brain_context(learner_id=LEARNER_ID, db=db, auth=auth)
    if endpoint == "check_regression":
        return await check_regression(learner_id=LEARNER_ID, db=db, auth=auth)
    if endpoint == "update_engagement":
        return await update_engagement_profile(
            learner_id=LEARNER_ID,
            request={"engagement": {"totalXp": 10, "level": 2, "eventType": "xp"}},
            db=db,
            auth=auth,
        )
    if endpoint == "list_snapshots":
        return await list_snapshots(learner_id=LEARNER_ID, db=db, auth=auth)
    if endpoint == "snapshot_detail":
        return await get_snapshot(snapshot_id="snap_1", db=db, auth=auth)
    if endpoint == "rollback":
        return await rollback_brain(
            learner_id=LEARNER_ID,
            request=BrainRollbackRequest(snapshot_id="snap_1"),
            db=db,
            auth=auth,
        )
    raise AssertionError(f"unknown endpoint {endpoint}")


SCOPED_READS = [
    "get_brain_state",
    "get_brain_history",
    "get_brain_context",
    "check_regression",
    "update_engagement",
    "list_snapshots",
    "snapshot_detail",
]
ALL_ENDPOINTS = SCOPED_READS + ["rollback"]

UNRELATED_CALLERS = [
    ("unrelated_teacher", UNRELATED_TEACHER),
    ("unrelated_learner", UNRELATED_LEARNER),
    ("unrelated_parent", UNRELATED_PARENT),
]


class TestUnrelatedCallersGet403:
    """No authenticated-but-unrelated principal can touch lr_1's brain."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("endpoint", ALL_ENDPOINTS)
    @pytest.mark.parametrize("caller_name,caller", UNRELATED_CALLERS)
    async def test_forbidden(self, endpoint, caller_name, caller):
        with pytest.raises(HTTPException) as exc_info:
            await _invoke(endpoint, _fake_db(), caller)
        assert exc_info.value.status_code == 403


class TestVerifiedCallersSucceed:
    """Parent of lr_1 and the ACCEPTED-linked teacher can use the scoped
    (non-rollback) endpoints; the matrix's 200 cases."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("endpoint", SCOPED_READS)
    @pytest.mark.parametrize(
        "caller_name,caller",
        [("parent", PARENT), ("accepted_teacher", ACCEPTED_TEACHER)],
    )
    async def test_allowed(self, endpoint, caller_name, caller):
        result = await _invoke(endpoint, _fake_db(), caller)
        assert result is not None

    @pytest.mark.asyncio
    async def test_parent_read_returns_brain_state(self):
        result = await get_brain_state(learner_id=LEARNER_ID, db=_fake_db(), auth=PARENT)
        assert result["learnerId"] == LEARNER_ID
        assert "disabilitySignals" in result

    @pytest.mark.asyncio
    async def test_history_returns_only_this_learners_snapshots(self):
        rows = await get_brain_history(learner_id=LEARNER_ID, db=_fake_db(), auth=PARENT)
        assert [r["id"] for r in rows] == ["snap_1"]


class TestRollbackIsGuardianOnly:
    """Rolling back a child's brain is parent/admin/service-only — an
    ACCEPTED teacher link is not enough, nor is the learner herself."""

    @pytest.mark.asyncio
    async def test_parent_can_roll_back(self):
        db = _fake_db()
        result = await rollback_brain(
            learner_id=LEARNER_ID,
            request=BrainRollbackRequest(snapshot_id="snap_1"),
            db=db,
            auth=PARENT,
        )
        assert result["status"] == "rolled_back"
        assert result["version"] == 4
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_admin_can_roll_back(self):
        result = await rollback_brain(
            learner_id=LEARNER_ID,
            request=BrainRollbackRequest(snapshot_id="snap_1"),
            db=_fake_db(),
            auth=ADMIN,
        )
        assert result["status"] == "rolled_back"

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "caller_name,caller",
        [("accepted_teacher", ACCEPTED_TEACHER), ("self_learner", SELF_LEARNER)],
    )
    async def test_non_guardians_cannot_roll_back(self, caller_name, caller):
        db = _fake_db()
        with pytest.raises(HTTPException) as exc_info:
            await rollback_brain(
                learner_id=LEARNER_ID,
                request=BrainRollbackRequest(snapshot_id="snap_1"),
                db=db,
                auth=caller,
            )
        assert exc_info.value.status_code == 403
        db.commit.assert_not_called()


class TestEngagementScope:
    """The old check let any user with the bare role string 'teacher'
    write engagement for any learner. Now: service principal allowed,
    learner allowed only for self, everyone else needs a verified link."""

    @pytest.mark.asyncio
    async def test_lowercase_teacher_role_no_longer_grants_access(self):
        with pytest.raises(HTTPException) as exc_info:
            await _invoke("update_engagement", _fake_db(), LOWERCASE_TEACHER)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_learner_can_sync_own_engagement(self):
        result = await _invoke("update_engagement", _fake_db(), SELF_LEARNER)
        assert result["status"] == "engagement_synced"

    @pytest.mark.asyncio
    async def test_service_principal_allowed(self):
        result = await _invoke("update_engagement", _fake_db(), SERVICE)
        assert result["status"] == "engagement_synced"


class TestSnapshotDetailScope:
    """GET /detail/{snapshot_id} resolves the snapshot's owner first:
    unknown ids 404, cross-learner reads 403, and the in-scope caller
    gets the row."""

    @pytest.mark.asyncio
    async def test_unknown_snapshot_is_404(self):
        with pytest.raises(HTTPException) as exc_info:
            await get_snapshot(snapshot_id="snap_missing", db=_fake_db(), auth=PARENT)
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_parent_cannot_read_another_childs_snapshot(self):
        # snap_2 belongs to lr_2 (parent_2's child); parent_1 must get 403.
        with pytest.raises(HTTPException) as exc_info:
            await get_snapshot(snapshot_id="snap_2", db=_fake_db(), auth=PARENT)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_accepted_teacher_link_does_not_cross_learners(self):
        # teacher_1 is ACCEPTED for lr_1 only; lr_2's snapshot stays closed.
        with pytest.raises(HTTPException) as exc_info:
            await get_snapshot(snapshot_id="snap_2", db=_fake_db(), auth=ACCEPTED_TEACHER)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_owning_parent_reads_snapshot(self):
        row = await get_snapshot(snapshot_id="snap_1", db=_fake_db(), auth=PARENT)
        assert row["id"] == "snap_1"
        assert row["learner_id"] == LEARNER_ID

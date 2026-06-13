"""Sprint C-13 — parent-readable regression insights + rollback change emit.

Two behaviours, both exercised with a SQL-capturing MagicMock Session (the same
pattern as test_decline_archives.py):

  1. GET /{learner_id}/regression-insights rewrites stored `causal_analyses`
     hypotheses into warm, NON-ALARMIST parent cards, always paired with a
     constructive next step, and never leaks the raw "dropped by X%" hypothesis.
     It is parent-scoped per C-02 (a teacher is 403).
  2. POST /{learner_id}/rollback emits a STRUCTURAL change record to the shared
     brain_profile_changes table (it restores supports/tutors/level).

Run with: pytest services/brain-svc/tests/test_regression_insights.py -v
"""
import re
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from brain_svc.models.schemas import BrainRollbackRequest
from brain_svc.routes.brain import get_regression_insights, rollback_brain


def _norm(sql: str) -> str:
    return re.sub(r"\s+", " ", sql).strip().upper()


def _parent_auth(sub="parent_123", role="admin"):
    # `admin` clears _verify_parent_access without needing a learner row.
    return SimpleNamespace(sub=sub, role=role, tenant_id="t_1", user_id=sub)


class _InsightsDb:
    """Returns one learner name row, then a causal_analyses row, on successive
    SELECTs. Captures every statement."""

    def __init__(self, analyses_rows):
        self.statements = []
        self._queue = [
            [{"name": "Maya"}],  # learner name
            analyses_rows,  # causal_analyses
        ]

    def execute(self, statement, params=None):
        self.statements.append(str(statement))
        result = MagicMock()
        rows = self._queue.pop(0) if self._queue else []
        result.mappings.return_value.all.return_value = rows
        result.mappings.return_value.first.return_value = rows[0] if rows else None
        return result

    def commit(self):
        pass


class TestRegressionInsights:
    @pytest.mark.asyncio
    async def test_rewrites_hypothesis_to_warm_parent_language(self):
        raw = "Mastery in math dropped by 22.0% (from 0.80 to 0.62)."
        db = _InsightsDb([
            {
                "id": "ca_1",
                "domain": "math",
                "mastery_drop": 0.18,
                "previous_mastery": 0.80,
                "current_mastery": 0.62,
                "hypothesis": raw,
                "confidence": 0.6,
                "status": "DETECTED",
                "created_at": "2026-06-13T00:00:00",
            }
        ])
        out = await get_regression_insights(learner_id="lr_1", db=db, auth=_parent_auth())
        assert len(out["insights"]) == 1
        card = out["insights"][0]
        # Never leak the raw deficit-framed hypothesis.
        assert raw not in card["headline"]
        assert raw not in card["body"]
        assert "dropped by" not in card["body"].lower()
        # Warm + constructive: a next step is always present.
        assert card["nextStep"]
        assert "math" in card["area"]
        assert "Maya" in card["headline"] or "Maya" in card["body"]

    @pytest.mark.asyncio
    async def test_empty_when_no_detections(self):
        db = _InsightsDb([])
        out = await get_regression_insights(learner_id="lr_1", db=db, auth=_parent_auth())
        assert out["insights"] == []

    @pytest.mark.asyncio
    async def test_teacher_is_forbidden_c02_scope(self):
        # A bare TEACHER role (no parent link) must be rejected — a regression
        # insight reveals a learning-difficulty signal.
        db = _InsightsDb([])
        with pytest.raises(HTTPException) as exc:
            await get_regression_insights(
                learner_id="lr_1", db=db, auth=SimpleNamespace(sub="t1", role="TEACHER", tenant_id="t_1", user_id="t1")
            )
        assert exc.value.status_code == 403


class _RollbackDb:
    """Returns a snapshot row then the current brain row; records statements."""

    def __init__(self):
        self.statements = []
        self.committed = False
        self._snapshot = {
            "id": "snap_1",
            "learner_id": "lr_1",
            "snapshot": {
                "mastery_levels": {"math": 0.4},
                "active_accommodations": ["extended_time"],
                "active_tutors": ["nova"],
                "functioning_level_profile": {"level": "STANDARD"},
            },
        }
        self._current = {"id": "bs_1", "version": 3}
        self._first_select_done = False

    def execute(self, statement, params=None):
        sql = str(statement)
        self.statements.append(sql)
        result = MagicMock()
        if "BRAIN_STATE_SNAPSHOTS" in _norm(sql) and _norm(sql).startswith("SELECT"):
            result.mappings.return_value.first.return_value = self._snapshot
        elif _norm(sql).startswith("SELECT"):
            result.mappings.return_value.first.return_value = self._current
        else:
            result.mappings.return_value.first.return_value = None
        return result

    def commit(self):
        self.committed = True


class TestRollbackEmitsChange:
    @pytest.mark.asyncio
    async def test_rollback_writes_a_structural_change_record(self):
        db = _RollbackDb()
        out = await rollback_brain(
            learner_id="lr_1",
            request=BrainRollbackRequest(snapshot_id="snap_1"),
            db=db,
            auth=_parent_auth(),
        )
        assert out["status"] == "rolled_back"
        change_inserts = [
            s for s in db.statements if "INSERT INTO BRAIN_PROFILE_CHANGES" in _norm(s)
        ]
        assert len(change_inserts) == 1, "rollback must emit one change record"
        assert db.committed is True

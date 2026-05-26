"""Unit tests for the AAC board route (Sprint 12.5).

We test the pure board-composition helpers + a thin in-memory stub for
the SQLAlchemy session so we don't need a live Postgres for these
assertions. The integration of `verify_learner_access` is exercised
elsewhere; here we focus on:

  - rich IEP -> board includes every targeted domain's vocabulary
  - empty IEP -> falls back to the core + communication board
  - unknown learner -> route raises 404
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from brain_svc.routes import aac_board


def _make_db(*, learner_exists: bool, goal_domains: list[str], cursor=None):
    """Return a MagicMock that mimics the SQLAlchemy Session surface used
    by the route (execute().scalar() and execute().mappings().all())."""
    db = MagicMock()

    def execute(query, params=None):  # noqa: ARG001 — params unused in stub
        result = MagicMock()
        q = str(query).lower()
        if "from learners" in q:
            result.scalar.return_value = 1 if learner_exists else None
        elif "from iep_goals" in q:
            mappings = MagicMock()
            mappings.all.return_value = [{"domain": d} for d in goal_domains]
            result.mappings.return_value = mappings
        elif "curriculum_cursor" in q:
            result.scalar.return_value = cursor
        else:
            result.scalar.return_value = None
            result.mappings.return_value.all.return_value = []
        return result

    db.execute.side_effect = execute
    return db


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------
def test_normalise_domain_aliases():
    assert aac_board._normalise_domain("Communication") == "communication"
    assert aac_board._normalise_domain("ELA") == "ela"
    assert aac_board._normalise_domain("Daily Living") == "daily_living"
    assert aac_board._normalise_domain("self help") == "daily_living"
    assert aac_board._normalise_domain("") is None
    assert aac_board._normalise_domain("astronaut training") is None


def test_core_board_always_present():
    board = aac_board._build_board(set())
    # 30 core symbols, sorted by rank, every one tagged "core / feeling / …"
    assert len(board) == 30
    ids = [s["symbol_id"] for s in board]
    assert "core.yes" in ids
    assert "core.thank_you" in ids
    # Sorted ascending by frequency_rank.
    ranks = [s["frequency_rank"] for s in board]
    assert ranks == sorted(ranks)


def test_board_appends_domain_vocab_when_iep_covers_domain():
    board = aac_board._build_board({"math", "ela"})
    ids = [s["symbol_id"] for s in board]
    assert "math.one" in ids
    assert "ela.book" in ids
    # Core still present.
    assert "core.yes" in ids
    # Communication vocab NOT added unless requested.
    assert "comm.greet" not in ids


def test_board_dedupes_by_symbol_id():
    # Calling twice with the same domain should not duplicate.
    one = aac_board._build_board({"communication"})
    seen = [s["symbol_id"] for s in one]
    assert len(seen) == len(set(seen))


# ---------------------------------------------------------------------------
# Route integration (with mocked db + auth/access bypass)
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def bypass_access(monkeypatch):
    monkeypatch.setattr(aac_board, "verify_learner_access", lambda *a, **kw: None)


@pytest.mark.asyncio
async def test_route_rich_iep_returns_all_targeted_domains(monkeypatch):
    db = _make_db(
        learner_exists=True,
        goal_domains=["communication", "math", "Social Emotional"],
    )
    response = await aac_board.get_aac_board(
        learner_id="00000000-0000-0000-0000-000000000001",
        db=db,
        auth=MagicMock(),
    )
    ids = {s["symbol_id"] for s in response["items"]}
    assert "comm.greet" in ids
    assert "math.one" in ids
    assert "sel.calm" in ids
    # And of course the core.
    assert "core.yes" in ids
    # Source domains were normalised.
    assert "communication" in response["source_domains"]
    assert "math" in response["source_domains"]
    assert "social_emotional" in response["source_domains"]


@pytest.mark.asyncio
async def test_route_empty_iep_falls_back_to_core_plus_communication():
    db = _make_db(learner_exists=True, goal_domains=[])
    response = await aac_board.get_aac_board(
        learner_id="00000000-0000-0000-0000-000000000002",
        db=db,
        auth=MagicMock(),
    )
    ids = {s["symbol_id"] for s in response["items"]}
    assert "core.yes" in ids
    assert "comm.greet" in ids  # default fallback domain
    assert "math.one" not in ids  # nothing else
    assert "communication" in response["source_domains"]


@pytest.mark.asyncio
async def test_route_unknown_learner_404():
    from fastapi import HTTPException

    db = _make_db(learner_exists=False, goal_domains=[])
    with pytest.raises(HTTPException) as exc_info:
        await aac_board.get_aac_board(
            learner_id="ffffffff-ffff-ffff-ffff-ffffffffffff",
            db=db,
            auth=MagicMock(),
        )
    assert exc_info.value.status_code == 404

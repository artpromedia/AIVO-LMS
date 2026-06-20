import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from mastery_svc.models import tables  # noqa: F401 — register models on Base
from mastery_svc.models.database import Base
from mastery_svc.models.schemas import ObserveRequest
from mastery_svc.services import mastery_store


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def test_observe_creates_row_and_moves_mastery(db):
    row, dup = mastery_store.observe(
        db,
        ObserveRequest(learner_id="L1", tenant_id="T1", skill_id="math.add", subject="math", correct=True, difficulty="medium", event_id="e1"),
    )
    assert dup is False
    assert row.n_obs == 1
    p1 = row.p_mastery

    row2, dup2 = mastery_store.observe(
        db,
        ObserveRequest(learner_id="L1", skill_id="math.add", subject="math", correct=True, event_id="e2"),
    )
    assert dup2 is False
    assert row2.p_mastery > p1
    assert row2.n_obs == 2


def test_observe_is_idempotent_on_event_id(db):
    req = ObserveRequest(learner_id="L2", skill_id="math.add", subject="math", correct=True, event_id="dup-1")
    row, dup = mastery_store.observe(db, req)
    assert dup is False
    p, n = row.p_mastery, row.n_obs

    row_again, dup_again = mastery_store.observe(db, req)  # exact replay
    assert dup_again is True
    assert row_again.p_mastery == p
    assert row_again.n_obs == n  # not double-counted


def test_trend_rises_on_correct_streak(db):
    for i in range(5):
        mastery_store.observe(
            db,
            ObserveRequest(learner_id="L3", skill_id="s1", subject="math", correct=True, event_id=f"t{i}"),
        )
    row = mastery_store.get_skill(db, "L3", "s1")
    assert row.last_trend == "rising"


def test_next_skill_picks_lowest_mastery(db):
    mastery_store.observe(db, ObserveRequest(learner_id="L4", skill_id="easy", subject="math", correct=True, event_id="a1"))
    mastery_store.observe(db, ObserveRequest(learner_id="L4", skill_id="hard", subject="math", correct=False, event_id="b1"))
    nxt = mastery_store.next_skill(db, "L4", "math")
    assert nxt.skill_id == "hard"

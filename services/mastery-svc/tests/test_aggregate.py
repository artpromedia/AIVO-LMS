import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from mastery_svc.models import tables  # noqa: F401 — register models
from mastery_svc.models.database import Base
from mastery_svc.models.schemas import ObserveRequest
from mastery_svc.services import mastery_store
from mastery_svc.services.aggregate import mastery_band, mean_p_by_subject


def test_mean_p_by_subject_matches_mean_of_skills():
    rows = [("math", 0.8), ("math", 0.4), ("reading", 0.6)]
    agg = mean_p_by_subject(rows)
    assert agg["math"] == 0.6  # (0.8 + 0.4) / 2 — the subject aggregate is the mean of its skills
    assert agg["reading"] == 0.6


def test_mean_p_by_subject_empty():
    assert mean_p_by_subject([]) == {}


def test_mastery_band_buckets_match_scoring_policy():
    assert mastery_band(0.10) == "not_started"
    assert mastery_band(0.30) == "emerging"
    assert mastery_band(0.50) == "approaching"
    assert mastery_band(0.80) == "on_grade_level"
    assert mastery_band(0.95) == "stretching"
    # boundaries are exclusive-upper, matching masteryLevelFromScore
    assert mastery_band(0.15) == "emerging"
    assert mastery_band(0.40) == "approaching"
    assert mastery_band(0.90) == "stretching"


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


def test_subject_aggregate_tracks_each_session_no_lag(db):
    """P6 regression for the P2 fix: the subject aggregate reflects each session's per-skill update
    immediately — it never lags a stale snapshot."""
    def subject_mean():
        rows = mastery_store.list_skills(db, "L", "math")
        return mean_p_by_subject([(r.subject, r.p_mastery) for r in rows])["math"]

    mastery_store.observe(db, ObserveRequest(learner_id="L", skill_id="math.add", subject="math", correct=True, event_id="a1"))
    after_first = subject_mean()
    # A second correct answer on the same skill must move the SUBJECT aggregate in the same session.
    mastery_store.observe(db, ObserveRequest(learner_id="L", skill_id="math.add", subject="math", correct=True, event_id="a2"))
    after_second = subject_mean()
    assert after_second > after_first

    # Aggregate is always exactly the mean of the live per-skill rows (no stale copy).
    rows = mastery_store.list_skills(db, "L", "math")
    assert round(after_second, 4) == round(sum(r.p_mastery for r in rows) / len(rows), 4)

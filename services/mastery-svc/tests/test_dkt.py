import os

import pytest

torch = pytest.importorskip("torch")  # DKT tests require torch; skipped cleanly when absent.

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from mastery_svc import config
from mastery_svc.models import tables  # noqa: F401
from mastery_svc.models.database import Base
from mastery_svc.models.schemas import ObserveRequest
from mastery_svc.services import dkt, mastery_store


def test_auc_score_basics():
    assert dkt.auc_score([0, 0, 1, 1], [0.1, 0.2, 0.8, 0.9]) == 1.0  # perfect ranking
    assert dkt.auc_score([1, 1, 1], [0.5, 0.6, 0.7]) == 0.5  # one class → undefined → 0.5


def test_dkt_beats_bkt_baseline_on_heldout_auc():
    """Acceptance: held-out next-step AUC beats the BKT baseline on the same split (DKT exploits the
    cross-skill transfer structure BKT's per-skill independence cannot model)."""
    sequences, _ = dkt.synthetic_sequences(num_learners=320, seq_len=60, seed=11)
    vocab = dkt.build_vocab(sequences)
    _model, metrics = dkt.train(sequences, vocab, epochs=15, seed=11)
    assert metrics["n_val_pairs"] > 100
    assert metrics["dkt_auc"] > 0.5
    assert metrics["dkt_auc"] > metrics["bkt_auc"], metrics
    assert metrics["dkt_auc"] > metrics["baseline_auc"], metrics


def test_checkpoint_roundtrip_and_serving_shape(tmp_path):
    sequences, _ = dkt.synthetic_sequences(num_learners=120, seed=3)
    vocab = dkt.build_vocab(sequences)
    model, _ = dkt.train(sequences, vocab, epochs=6, seed=3)
    path = str(tmp_path / "dkt.pt")
    dkt.save_checkpoint(model, vocab, path, version="dkt-test")

    svc = dkt.DktService()
    assert svc.load(path) is True
    assert svc.version == "dkt-test"
    pred = svc.predict([("s0", True), ("s0", True), ("s1", False)], "s0")
    assert pred is not None
    assert 0.0 < pred.p < 1.0
    # theta = logit(p); both are independently rounded to 4dp so allow rounding slack.
    assert abs(pred.theta - dkt._logit(pred.p)) < 1e-3
    # Unknown skill / empty history → None (caller falls back to BKT).
    assert svc.predict([("s0", True)], "unknown-skill") is None
    assert svc.predict([], "s0") is None


@pytest.fixture()
def dkt_db(tmp_path):
    # Train + load a model, point the backend at DKT with a low cold-start floor.
    sequences, _ = dkt.synthetic_sequences(num_learners=120, seed=5)
    vocab = dkt.build_vocab(sequences)
    model, _ = dkt.train(sequences, vocab, epochs=6, seed=5)
    path = str(tmp_path / "dkt.pt")
    dkt.save_checkpoint(model, vocab, path)
    assert dkt.service.load(path)

    prev_backend = os.environ.get("AIVO_MODEL_BACKEND")
    prev_min = config.DKT_MIN_OBS
    os.environ["AIVO_MODEL_BACKEND"] = "dkt"
    config.DKT_MIN_OBS = 3

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        dkt.service._loaded = False
        config.DKT_MIN_OBS = prev_min
        if prev_backend is None:
            os.environ.pop("AIVO_MODEL_BACKEND", None)
        else:
            os.environ["AIVO_MODEL_BACKEND"] = prev_backend


def test_cold_start_falls_back_to_bkt_then_serves_dkt(dkt_db):
    db = dkt_db
    # First two observations are below DKT_MIN_OBS (3) → BKT serves.
    for i in range(2):
        row, _ = mastery_store.observe(
            db, ObserveRequest(learner_id="LD", skill_id="s0", subject="math", correct=True, event_id=f"c{i}")
        )
    assert row.model_version == "bkt-v1", "cold-start must serve BKT"

    # Once history crosses the floor, the same contract now serves DKT.
    for i in range(2, 6):
        row, _ = mastery_store.observe(
            db, ObserveRequest(learner_id="LD", skill_id="s0", subject="math", correct=True, event_id=f"c{i}")
        )
    assert row.model_version == "dkt-v1", "warm learner on a dkt subject serves DKT"
    # Serving parity: identical contract shape, valid values.
    assert 0.0 < row.p_mastery < 1.0
    assert row.last_trend in ("rising", "stable", "declining")
    assert row.n_obs == 6

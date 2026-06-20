"""
Persistence + update logic over the BKT model. Thin layer between the routes and
``bkt.py`` so the routes stay declarative and the update is unit-testable against a
SQLite session.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from mastery_svc import config
from mastery_svc.models.schemas import ObserveRequest
from mastery_svc.models.tables import LearnerSkillMastery, MasteryObservation
from mastery_svc.services import bkt, dkt
from mastery_svc.services.aggregate import sync_brain_state_aggregate


def _trend(recent: list[float]) -> str:
    if not recent or len(recent) < 2:
        return "stable"
    delta = recent[-1] - recent[0]
    if delta > config.TREND_EPS:
        return "rising"
    if delta < -config.TREND_EPS:
        return "declining"
    return "stable"


def get_skill(db: Session, learner_id: str, skill_id: str) -> LearnerSkillMastery | None:
    return (
        db.query(LearnerSkillMastery)
        .filter(
            LearnerSkillMastery.learner_id == learner_id,
            LearnerSkillMastery.skill_id == skill_id,
        )
        .first()
    )


def list_skills(db: Session, learner_id: str, subject: str | None = None) -> list[LearnerSkillMastery]:
    q = db.query(LearnerSkillMastery).filter(LearnerSkillMastery.learner_id == learner_id)
    if subject:
        q = q.filter(LearnerSkillMastery.subject == subject)
    return q.order_by(LearnerSkillMastery.skill_id).all()


def observe(db: Session, req: ObserveRequest) -> tuple[LearnerSkillMastery | None, bool]:
    """Apply one graded answer. Returns (row, duplicate). Idempotent on event_id."""
    if req.event_id:
        seen = (
            db.query(MasteryObservation)
            .filter(MasteryObservation.event_id == req.event_id)
            .first()
        )
        if seen:
            return get_skill(db, req.learner_id, req.skill_id), True

    params = bkt.BktParams.from_dict(config.params_for_subject(req.subject))
    row = get_skill(db, req.learner_id, req.skill_id)

    if row is None:
        delta = config.DIFFICULTY_PRIOR_DELTA.get((req.difficulty or "").lower(), 0.0)
        p0 = bkt.cold_start_prior(params, delta)
        row = LearnerSkillMastery(
            learner_id=req.learner_id,
            tenant_id=req.tenant_id,
            skill_id=req.skill_id,
            subject=req.subject or "DEFAULT",
            p_mastery=p0,
            theta=bkt.theta_from_p(p0),
            p_init=p0,
            n_obs=0,
            last_trend="stable",
            recent_p=[round(p0, 4)],
            model_version=config.MODEL_VERSION,
        )
        db.add(row)

    p_new = bkt.bkt_update(row.p_mastery, bool(req.correct), params)
    recent = list(row.recent_p or [])
    recent.append(round(p_new, 4))
    recent = recent[-config.TREND_WINDOW:]

    row.p_mastery = p_new
    row.theta = bkt.theta_from_p(p_new)
    row.n_obs = (row.n_obs or 0) + 1
    row.recent_p = recent  # reassign (not mutate) so SQLAlchemy persists the JSON change
    row.last_trend = _trend(recent)
    row.model_version = config.MODEL_VERSION

    db.add(
        MasteryObservation(
            learner_id=req.learner_id,
            tenant_id=req.tenant_id,
            skill_id=req.skill_id,
            subject=req.subject,
            correct=bool(req.correct),
            difficulty=req.difficulty,
            latency_ms=req.latency_ms,
            source=req.source,
            event_id=req.event_id,
            model_version=config.MODEL_VERSION,
        )
    )
    db.commit()
    db.refresh(row)

    # P1 — DKT refine: when the subject is dkt-backed, the model is loaded, and the learner has
    # enough history, replace the BKT posterior with the LSTM's prediction (BKT remains the committed
    # baseline + cold-start fallback). Dark-launch computes but does not serve. Runs BEFORE the
    # aggregate so brain_states reflects the served model.
    _maybe_apply_dkt(db, row, req)

    # P2 — keep brain_states.mastery_levels a fresh per-subject aggregate of the per-skill rows
    # (best-effort; no-op when brain_states is absent). This is what makes the brain improve every
    # session instead of lagging until the next recommendation cycle.
    sync_brain_state_aggregate(db, req.learner_id, row.subject)
    return row, False


def _maybe_apply_dkt(db: Session, row: LearnerSkillMastery, req: ObserveRequest) -> None:
    if config.model_backend_for_subject(row.subject) != "dkt":
        return
    if not dkt.service.is_loaded() or (row.n_obs or 0) < config.DKT_MIN_OBS:
        return  # cold-start / not loaded → keep BKT
    history = [
        (o.skill_id, bool(o.correct))
        for o in db.query(MasteryObservation)
        .filter(MasteryObservation.learner_id == req.learner_id)
        .order_by(MasteryObservation.created_at)
        .all()
    ]
    pred = dkt.service.predict(history, req.skill_id)
    if pred is None or config.dkt_dark_launch():
        return  # unknown skill, or dark-launch (compute but don't serve)

    recent = list(row.recent_p or [])
    if recent:
        recent[-1] = pred.p
    else:
        recent = [pred.p]
    row.p_mastery = pred.p
    row.theta = pred.theta
    row.model_version = pred.model_version
    row.recent_p = recent
    row.last_trend = _trend(recent)
    db.commit()
    db.refresh(row)


def next_skill(db: Session, learner_id: str, subject: str) -> LearnerSkillMastery | None:
    """Lowest-mastery skill in the subject — the recommended thing to work on next."""
    return (
        db.query(LearnerSkillMastery)
        .filter(
            LearnerSkillMastery.learner_id == learner_id,
            LearnerSkillMastery.subject == subject,
        )
        .order_by(LearnerSkillMastery.p_mastery.asc())
        .first()
    )

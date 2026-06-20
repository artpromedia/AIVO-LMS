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
from mastery_svc.services import bkt


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
    return row, False


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

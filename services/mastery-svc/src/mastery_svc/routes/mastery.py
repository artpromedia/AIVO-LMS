"""
The mastery model contract (stable across BKT → DKT):

    POST /api/mastery/observe                              record a graded answer
    GET  /api/mastery/next-skill/{learner_id}/{subject}    lowest-mastery skill to work on
    GET  /api/mastery/difficulty-target/{learner_id}/{skill_id}   delivery band + next difficulty
    GET  /api/mastery/{learner_id}/{skill_id}              one skill's state
    GET  /api/mastery/{learner_id}                         all tracked skills

Literal-prefixed routes are declared before the parametrized ``/{learner_id}`` ones
so FastAPI never mistakes ``next-skill``/``difficulty-target`` for a learner id.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from mastery_svc.auth import AuthClaims, require_auth
from mastery_svc.models.database import get_db
from mastery_svc.models.schemas import (
    DifficultyTarget,
    NextSkill,
    ObserveRequest,
    ObserveResponse,
    SkillMastery,
)
from mastery_svc.services import mastery_store
from mastery_svc.services.banding import delivery_level_from_theta, target_difficulty_for_p

router = APIRouter()


def _to_out(row) -> SkillMastery:
    return SkillMastery(
        skill_id=row.skill_id,
        subject=row.subject,
        p=round(row.p_mastery, 4),
        theta=round(row.theta, 4),
        trend=row.last_trend,
        n_obs=row.n_obs,
        model_version=row.model_version,
    )


@router.post("/observe", response_model=ObserveResponse)
def observe(
    req: ObserveRequest,
    db: Session = Depends(get_db),
    _: AuthClaims = Depends(require_auth),
) -> ObserveResponse:
    row, duplicate = mastery_store.observe(db, req)
    return ObserveResponse(
        applied=not duplicate,
        duplicate=duplicate,
        mastery=_to_out(row) if row else None,
    )


@router.get("/next-skill/{learner_id}/{subject}", response_model=NextSkill)
def next_skill(
    learner_id: str,
    subject: str,
    db: Session = Depends(get_db),
    _: AuthClaims = Depends(require_auth),
) -> NextSkill:
    row = mastery_store.next_skill(db, learner_id, subject)
    if not row:
        raise HTTPException(status_code=404, detail="No skills tracked for this learner/subject yet")
    return NextSkill(
        skill_id=row.skill_id,
        rationale=f"Lowest demonstrated mastery in {subject}: p={row.p_mastery:.2f} ({row.last_trend}).",
    )


@router.get("/difficulty-target/{learner_id}/{skill_id}", response_model=DifficultyTarget)
def difficulty_target(
    learner_id: str,
    skill_id: str,
    enrolled_band: str = Query("12", description="Enrolled grade band the delivery level is relative to"),
    db: Session = Depends(get_db),
    _: AuthClaims = Depends(require_auth),
) -> DifficultyTarget:
    row = mastery_store.get_skill(db, learner_id, skill_id)
    if not row:
        raise HTTPException(status_code=404, detail="Skill not tracked yet")
    return DifficultyTarget(
        skill_id=skill_id,
        delivery_level=delivery_level_from_theta(row.theta, enrolled_band),
        theta=round(row.theta, 4),
        target_difficulty=target_difficulty_for_p(row.p_mastery),
    )


@router.get("/{learner_id}/{skill_id}", response_model=SkillMastery)
def get_one(
    learner_id: str,
    skill_id: str,
    db: Session = Depends(get_db),
    _: AuthClaims = Depends(require_auth),
) -> SkillMastery:
    row = mastery_store.get_skill(db, learner_id, skill_id)
    if not row:
        raise HTTPException(status_code=404, detail="Skill not tracked yet")
    return _to_out(row)


@router.get("/{learner_id}")
def get_all(
    learner_id: str,
    subject: str | None = Query(None),
    db: Session = Depends(get_db),
    _: AuthClaims = Depends(require_auth),
) -> dict:
    rows = mastery_store.list_skills(db, learner_id, subject)
    return {
        r.skill_id: {
            "p": round(r.p_mastery, 4),
            "theta": round(r.theta, 4),
            "trend": r.last_trend,
            "n_obs": r.n_obs,
            "subject": r.subject,
            # recent posterior window — lets consumers (e.g. brain-svc regression) assess the series.
            "recent_p": list(r.recent_p or []),
        }
        for r in rows
    }

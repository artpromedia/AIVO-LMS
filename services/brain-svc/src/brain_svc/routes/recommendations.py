import uuid
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from brain_svc.models.database import get_db
from brain_svc.models.schemas import RecommendationCreate, RecommendationResolve
from brain_svc.services.recommendation_generator import generate_for_learner
from brain_svc.auth import AuthClaims, require_auth

router = APIRouter()


@router.post("/generate/{learner_id}")
async def generate_recommendations(
    learner_id: str,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    """Run the automatic recommendation generator for one learner.

    This inspects causal_analyses, iep_profiles, assessment_attempts and
    iep_goals, then emits new PENDING brain_recommendations rows for any
    signal that does not already have a pending recommendation. Safe to
    call repeatedly — duplicates are skipped via a payload-based dedup key.
    """
    return generate_for_learner(db, learner_id)

@router.post("/")
async def create_recommendation(request: RecommendationCreate, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    rec_id = str(uuid.uuid4())
    db.execute(
        text("""INSERT INTO brain_recommendations
            (id, tenant_id, learner_id, type, status, title, description, payload, created_at)
            VALUES (:id, :tid, :lid, :type, 'PENDING', :title, :desc, :payload, :now)"""),
        {
            "id": rec_id,
            "tid": request.tenant_id,
            "lid": request.learner_id,
            "type": request.type,
            "title": request.title,
            "desc": request.description,
            "payload": json.dumps(request.payload),
            "now": datetime.utcnow(),
        }
    )
    db.commit()
    return {"id": rec_id, "status": "PENDING"}

@router.get("/{learner_id}")
async def list_recommendations(learner_id: str, status: str = None, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    query = "SELECT * FROM brain_recommendations WHERE learner_id = :lid"
    params = {"lid": learner_id}
    if status:
        query += " AND status = :status"
        params["status"] = status
    query += " ORDER BY created_at DESC"
    results = db.execute(text(query), params).mappings().all()
    return [dict(r) for r in results]

@router.put("/{recommendation_id}/resolve")
async def resolve_recommendation(recommendation_id: str, request: RecommendationResolve, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    result = db.execute(
        text("SELECT id FROM brain_recommendations WHERE id = :id"),
        {"id": recommendation_id}
    ).first()
    if not result:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    db.execute(
        text("""UPDATE brain_recommendations SET
            status = :status, parent_notes = :notes, resolved_at = :now
            WHERE id = :id"""),
        {
            "status": request.status,
            "notes": request.parent_notes,
            "now": datetime.utcnow(),
            "id": recommendation_id,
        }
    )
    db.commit()
    return {"id": recommendation_id, "status": request.status}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from brain_svc.models.database import get_db
from brain_svc.auth import AuthClaims, require_auth

router = APIRouter()

@router.get("/{learner_id}")
async def list_snapshots(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    results = db.execute(
        text("SELECT id, brain_state_id, learner_id, version, trigger, created_at FROM brain_state_snapshots WHERE learner_id = :lid ORDER BY version DESC"),
        {"lid": learner_id}
    ).mappings().all()
    return [dict(r) for r in results]

@router.get("/detail/{snapshot_id}")
async def get_snapshot(snapshot_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    result = db.execute(
        text("SELECT * FROM brain_state_snapshots WHERE id = :sid"),
        {"sid": snapshot_id}
    ).mappings().first()
    if not result:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return dict(result)

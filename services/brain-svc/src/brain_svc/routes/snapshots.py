from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from brain_svc.models.database import get_db
from brain_svc.services.access_control import verify_learner_access
from brain_svc.auth import AuthClaims, require_auth

router = APIRouter()

@router.get("/{learner_id}")
async def list_snapshots(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    verify_learner_access(db, auth, learner_id)

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
    # Snapshots are not addressed by learner in this route, so resolve the
    # owning learner from the row and verify the caller against it before
    # any snapshot data leaves the service.
    verify_learner_access(db, auth, str(result["learner_id"]))
    return dict(result)

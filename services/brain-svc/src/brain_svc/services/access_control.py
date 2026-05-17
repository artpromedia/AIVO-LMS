import json
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from brain_svc.auth import AuthClaims


def verify_learner_access(db: Session, auth: AuthClaims, learner_id: str):
    if auth.role in ("admin", "service", "PLATFORM_ADMIN"):
        return
    if auth.role == "PARENT":
        learner = db.execute(
            text("SELECT parent_id FROM learners WHERE id = :lid"),
            {"lid": learner_id}
        ).first()
        if not learner or str(learner[0]) != auth.sub:
            raise HTTPException(status_code=403, detail="Not authorized for this learner")
        return
    if auth.role == "TEACHER":
        access = db.execute(
            text("SELECT 1 FROM learner_teachers WHERE learner_id = :lid AND teacher_user_id = :uid AND status = 'ACCEPTED' LIMIT 1"),
            {"lid": learner_id, "uid": auth.sub}
        ).first()
        if access:
            return
    if auth.role == "CAREGIVER":
        access = db.execute(
            text("SELECT 1 FROM learner_caregivers WHERE learner_id = :lid AND caregiver_user_id = :uid AND status = 'ACCEPTED' LIMIT 1"),
            {"lid": learner_id, "uid": auth.sub}
        ).first()
        if access:
            return
    if auth.role == "THERAPIST":
        access = db.execute(
            text("SELECT 1 FROM learner_therapists WHERE learner_id = :lid AND therapist_user_id = :uid AND status = 'ACCEPTED' LIMIT 1"),
            {"lid": learner_id, "uid": auth.sub}
        ).first()
        if access:
            return
    raise HTTPException(status_code=403, detail="Not authorized to access this learner's data")


def safe_json_parse(val, default=None):
    if default is None:
        default = {}
    if val is None:
        return default
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return default
    return default

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from brain_svc.models.database import get_db
from brain_svc.services.curriculum_engine import (
    extract_curriculum_standards,
    generate_scope_sequence,
    generate_topic_sequence_for_path,
)
from brain_svc.services.access_control import verify_learner_access, safe_json_parse
from brain_svc.auth import AuthClaims, require_auth

logger = logging.getLogger("brain-svc.curriculum")

router = APIRouter()


class CurriculumPullRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    grade_level: Optional[str] = None


class ScopeSequenceRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    term_count: int = Field(default=4, ge=1, le=8)


class TopicSequenceRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    current_mastery: float = Field(default=0.0, ge=0.0, le=1.0)
    completed_topics: list = []


@router.post("/{learner_id}/pull-standards")
async def pull_curriculum_standards(
    learner_id: str,
    request: CurriculumPullRequest,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    verify_learner_access(db, auth, learner_id)

    learner = db.execute(
        text("""SELECT curriculum_framework, curriculum_alignment, grade_level,
                       functioning_level, zip_code, country
                FROM learners WHERE id = :lid"""),
        {"lid": learner_id}
    ).mappings().first()

    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")

    curriculum_alignment = safe_json_parse(learner.get("curriculum_alignment"))
    framework = learner.get("curriculum_framework") or curriculum_alignment.get("framework", "Common Core State Standards")
    standards_code = curriculum_alignment.get("standards", "CCSS")
    state = curriculum_alignment.get("state")
    district_id = curriculum_alignment.get("districtId")
    grade_level = request.grade_level or learner.get("grade_level") or "3"

    brain = db.execute(
        text("SELECT functioning_level_profile FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    functioning_level = "STANDARD"
    if brain:
        flp = safe_json_parse(brain.get("functioning_level_profile"))
        functioning_level = flp.get("level", "STANDARD")

    try:
        standards = await extract_curriculum_standards(
            framework=framework,
            standards_code=standards_code,
            subject=request.subject,
            grade_level=grade_level,
            functioning_level=functioning_level,
            state=state,
            district_id=district_id,
        )
    except Exception as e:
        logger.error(f"Standards extraction failed for {learner_id}: {e}")
        raise HTTPException(status_code=503, detail="Curriculum standards extraction temporarily unavailable")

    if "error" in standards or "parse_error" in standards:
        raise HTTPException(status_code=502, detail="Failed to extract curriculum standards from AI")

    db.execute(
        text("""UPDATE brain_states
                SET curriculum_alignment = :ca, updated_at = NOW()
                WHERE learner_id = :lid
                AND id = (SELECT id FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1)"""),
        {
            "ca": json.dumps({
                **curriculum_alignment,
                "pulled_standards": {
                    request.subject: {
                        "framework": framework,
                        "grade_level": grade_level,
                        "standard_count": len(standards.get("standards", [])),
                        "domains": standards.get("domains", []),
                    }
                },
            }),
            "lid": learner_id,
        }
    )
    db.commit()

    return {
        "learnerId": learner_id,
        "framework": framework,
        "subject": request.subject,
        "gradeLevel": grade_level,
        "functioningLevel": functioning_level,
        "standards": standards,
    }


@router.post("/{learner_id}/scope-sequence")
async def generate_learner_scope_sequence(
    learner_id: str,
    request: ScopeSequenceRequest,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    verify_learner_access(db, auth, learner_id)

    learner = db.execute(
        text("""SELECT curriculum_framework, curriculum_alignment, grade_level, functioning_level
                FROM learners WHERE id = :lid"""),
        {"lid": learner_id}
    ).mappings().first()

    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")

    brain = db.execute(
        text("""SELECT mastery_levels, active_accommodations, functioning_level_profile
                FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"""),
        {"lid": learner_id}
    ).mappings().first()

    if not brain:
        raise HTTPException(status_code=404, detail="Brain state not found — clone brain first")

    mastery_levels = safe_json_parse(brain.get("mastery_levels"))
    accommodations = safe_json_parse(brain.get("active_accommodations"), [])
    flp = safe_json_parse(brain.get("functioning_level_profile"))
    functioning_level = flp.get("level", "STANDARD")

    curriculum_alignment = safe_json_parse(learner.get("curriculum_alignment"))
    framework = learner.get("curriculum_framework") or curriculum_alignment.get("framework", "Common Core State Standards")
    grade_level = learner.get("grade_level") or "3"

    try:
        scope = await generate_scope_sequence(
            framework=framework,
            subject=request.subject,
            grade_level=grade_level,
            mastery_levels=mastery_levels,
            functioning_level=functioning_level,
            accommodations=accommodations if isinstance(accommodations, list) else [],
            term_count=request.term_count,
        )
    except Exception as e:
        logger.error(f"Scope & sequence generation failed for {learner_id}: {e}")
        raise HTTPException(status_code=503, detail="Scope and sequence generation temporarily unavailable")

    if isinstance(scope, dict) and ("error" in scope or "parse_error" in scope):
        raise HTTPException(status_code=502, detail="Failed to generate scope and sequence from AI")

    return {
        "learnerId": learner_id,
        "framework": framework,
        "subject": request.subject,
        "gradeLevel": grade_level,
        "functioningLevel": functioning_level,
        "scopeSequence": scope,
    }


@router.post("/{learner_id}/topic-sequence")
async def generate_learner_topic_sequence(
    learner_id: str,
    request: TopicSequenceRequest,
    db: Session = Depends(get_db),
    auth: AuthClaims = Depends(require_auth),
):
    verify_learner_access(db, auth, learner_id)

    learner = db.execute(
        text("SELECT curriculum_framework, curriculum_alignment, grade_level FROM learners WHERE id = :lid"),
        {"lid": learner_id}
    ).mappings().first()

    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")

    brain = db.execute(
        text("SELECT functioning_level_profile FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    flp = safe_json_parse(brain.get("functioning_level_profile") if brain else None)
    functioning_level = flp.get("level", "STANDARD")

    curriculum_alignment = safe_json_parse(learner.get("curriculum_alignment"))
    framework = learner.get("curriculum_framework") or curriculum_alignment.get("framework", "Common Core State Standards")
    grade_level = learner.get("grade_level") or "3"

    try:
        topics = await generate_topic_sequence_for_path(
            framework=framework,
            subject=request.subject,
            grade_level=grade_level,
            current_mastery=request.current_mastery,
            functioning_level=functioning_level,
            completed_topics=request.completed_topics,
        )
    except Exception as e:
        logger.error(f"Topic sequence generation failed for {learner_id}: {e}")
        raise HTTPException(status_code=503, detail="Topic sequence generation temporarily unavailable")

    if not topics or (topics and not isinstance(topics[0], dict)):
        raise HTTPException(status_code=502, detail="Failed to generate valid topic sequence from AI")

    saved_to_path = False
    path = db.execute(
        text("SELECT id FROM learning_paths WHERE learner_id = :lid AND subject = :subj LIMIT 1"),
        {"lid": learner_id, "subj": request.subject}
    ).mappings().first()

    if path:
        db.execute(
            text("UPDATE learning_paths SET topic_sequence = :ts, updated_at = NOW() WHERE id = :pid"),
            {"ts": json.dumps(topics), "pid": path["id"]}
        )
        db.commit()
        saved_to_path = True

    return {
        "learnerId": learner_id,
        "subject": request.subject,
        "topicCount": len(topics),
        "topics": topics,
        "savedToPath": saved_to_path,
    }

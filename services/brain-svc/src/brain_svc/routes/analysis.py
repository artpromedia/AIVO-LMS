import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from brain_svc.models.database import get_db
from brain_svc.services.llm_gateway import generate_completion
from brain_svc.services.access_control import verify_learner_access, safe_json_parse
from brain_svc.auth import AuthClaims, require_auth

logger = logging.getLogger("brain-svc.analysis")

router = APIRouter()

BRAIN_ANALYST_SYSTEM = """You are AIVO's Brain Analyst — an AI specialist in neurodiversity-affirming educational assessment.

You analyze a learner's Brain Clone data (mastery levels, accommodations, sensory profile, IEP goals, episodic memory) and provide:
1. A plain-language summary of the learner's current state for parents/caregivers
2. Strengths identified from the data
3. Areas needing support (framed positively, never deficit-focused)
4. Actionable recommendations for the care team
5. Accommodation effectiveness insights

Rules:
- Use person-first or identity-first language as appropriate
- Never use deficit framing — focus on what the learner CAN do
- Recommendations must be evidence-based and specific
- Flag any data gaps that would improve analysis
- Keep summaries under 300 words
- Output valid JSON"""

REGRESSION_ANALYST_SYSTEM = """You are AIVO's Regression Analyst — an AI specialist in understanding learning pattern changes.

When a learner's mastery drops, you analyze potential causes by examining:
- Recent episodic memory events
- Parent-reported events
- Accommodation changes
- Session patterns

Provide a nuanced, non-alarmist analysis. Mastery fluctuations are normal. Only flag genuine concerns.
Output valid JSON with: hypothesis, confidence (0-1), contributing_factors[], recommended_actions[], reassurance_note."""


def _redact_for_llm(context: dict) -> dict:
    redacted = dict(context)
    learner = redacted.get("learner", {})
    if learner.get("name"):
        learner["name"] = "Learner"
    redacted["learner"] = learner
    return redacted


@router.post("/{learner_id}/ai-summary")
async def generate_brain_summary(learner_id: str, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    verify_learner_access(db, auth, learner_id)

    brain = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain state not found")

    brain_data = dict(brain)
    for field in ["mastery_levels", "disability_signals", "active_accommodations",
                  "active_tutors", "episodic_memory", "sensory_profile",
                  "iep_profile", "functioning_level_profile", "visual_identity"]:
        brain_data[field] = safe_json_parse(brain_data.get(field), [] if field in ("active_accommodations", "active_tutors", "episodic_memory") else {})

    learner = db.execute(
        text("SELECT name, grade_level, communication_mode, diagnoses FROM learners WHERE id = :lid"),
        {"lid": learner_id}
    ).mappings().first()

    # Alias the real iep_goals columns (domain / goal_text / current_progress)
    # to the keys the prompt builder downstream already expects (goal_area /
    # description / progress_percent). The legacy column names never existed in
    # the schema of record (packages/db/src/schema/learners.ts), so the prior
    # query 500'd the moment a learner had an active IEP goal.
    iep_goals = db.execute(
        text("SELECT domain        AS goal_area, "
             "       goal_text     AS description, "
             "       status, "
             "       current_progress AS progress_percent "
             "FROM iep_goals WHERE learner_id = :lid AND status = 'active'"),
        {"lid": learner_id}
    ).mappings().all()

    context = _redact_for_llm({
        "learner": dict(learner) if learner else {},
        "mastery_levels": brain_data.get("mastery_levels", {}),
        "accommodations": brain_data.get("active_accommodations", []),
        "tutors": brain_data.get("active_tutors", []),
        "functioning_level": brain_data.get("functioning_level_profile", {}),
        "sensory_profile": brain_data.get("sensory_profile", {}),
        "iep_goals": [dict(g) for g in iep_goals],
        "recent_episodes": (brain_data.get("episodic_memory", []) or [])[-10:],
    })

    user_prompt = f"""Analyze this learner's Brain Clone and provide a parent-friendly summary.

Brain Clone Data:
{json.dumps(context, indent=2, default=str)}

Respond with JSON:
{{
  "summary": "plain language overview",
  "strengths": ["strength1", "strength2"],
  "support_areas": ["area1", "area2"],
  "recommendations": ["rec1", "rec2"],
  "accommodation_insights": "how current accommodations are working",
  "data_gaps": ["any missing data that would help"]
}}"""

    try:
        result = await generate_completion(
            system_prompt=BRAIN_ANALYST_SYSTEM,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=1500,
        )

        try:
            content = result["content"]
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            analysis = json.loads(content.strip())
        except (json.JSONDecodeError, IndexError):
            analysis = {"summary": result["content"]}

        return {
            "learnerId": learner_id,
            "analysis": analysis,
            "model": result["model"],
            "tokens": result["total_tokens"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI summary generation failed: {e}")
        raise HTTPException(status_code=503, detail="AI analysis temporarily unavailable")


@router.post("/{learner_id}/ai-regression-analysis")
async def analyze_regression(learner_id: str, domain: str = None, db: Session = Depends(get_db), auth: AuthClaims = Depends(require_auth)):
    verify_learner_access(db, auth, learner_id)

    analyses = db.execute(
        text("""SELECT * FROM causal_analyses WHERE learner_id = :lid
                AND status = 'DETECTED' ORDER BY created_at DESC LIMIT 5"""),
        {"lid": learner_id}
    ).mappings().all()

    if not analyses:
        return {"learnerId": learner_id, "message": "No regressions detected", "analyses": []}

    brain = db.execute(
        text("SELECT episodic_memory FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id}
    ).mappings().first()

    episodic = []
    if brain:
        episodic = safe_json_parse(brain.get("episodic_memory"), [])
        if isinstance(episodic, list):
            episodic = episodic[-20:]
        else:
            episodic = []

    events = db.execute(
        text("SELECT event_type, description, occurred_at FROM parent_reported_events WHERE learner_id = :lid ORDER BY occurred_at DESC LIMIT 10"),
        {"lid": learner_id}
    ).mappings().all()

    context = {
        "regressions": [
            {
                "domain": a.get("domain"),
                "mastery_drop": a.get("mastery_drop"),
                "previous_mastery": a.get("previous_mastery"),
                "current_mastery": a.get("current_mastery"),
                "hypothesis": a.get("hypothesis"),
            }
            for a in analyses
        ],
        "recent_episodes": episodic,
        "parent_events": [dict(e) for e in events],
    }

    user_prompt = f"""Analyze these learning regressions and provide insights for the care team.

Regression Data:
{json.dumps(context, indent=2, default=str)}

Respond with JSON:
{{
  "overall_assessment": "brief overview",
  "regression_analyses": [
    {{
      "domain": "domain name",
      "hypothesis": "what might explain this",
      "confidence": 0.0-1.0,
      "contributing_factors": ["factor1"],
      "recommended_actions": ["action1"],
      "reassurance_note": "context for parents"
    }}
  ],
  "care_team_notes": "overall guidance"
}}"""

    try:
        result = await generate_completion(
            system_prompt=REGRESSION_ANALYST_SYSTEM,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=1500,
        )

        try:
            content = result["content"]
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            analysis = json.loads(content.strip())
        except (json.JSONDecodeError, IndexError):
            analysis = {"overall_assessment": result["content"]}

        return {
            "learnerId": learner_id,
            "analysis": analysis,
            "model": result["model"],
            "tokens": result["total_tokens"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI regression analysis failed: {e}")
        raise HTTPException(status_code=503, detail="AI analysis temporarily unavailable")

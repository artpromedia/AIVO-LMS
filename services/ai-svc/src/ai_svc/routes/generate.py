import json
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..services.llm_gateway import generate_completion
from ..services.budget_caps import BudgetExceeded
from ..services.prompt_builder import build_content_generation_prompt, build_tutor_system_prompt
from ..audit import emit_ai_audit
from ..services.quality_gate import run_quality_gate
from ..services.baseline_generator import build_baseline_generation_prompt
from ..services.responsible_ai_client import evaluate as evaluate_responsible_ai

logger = logging.getLogger("ai-svc.generate")

router = APIRouter(prefix="/api/ai", tags=["content-generation"])


class ContentRequest(BaseModel):
    subject: str
    topic: str
    grade_target: str = "THIRD"
    delivery_level: str = "THIRD"
    functioning_level: str = "STANDARD"
    content_type: str = "LESSON"
    brain_context: dict = {}
    max_tokens: int = 2000


class ContentResponse(BaseModel):
    content: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    quality_score: float
    quality_gate_passed: bool
    quality_gate_log: dict


class TutorChatRequest(BaseModel):
    tutor_sku: str
    learner_id: str
    functioning_level: str = "STANDARD"
    brain_context: dict = {}
    messages: list[dict] = []
    max_tokens: int = 1500
    locale: Optional[str] = None


class TutorChatResponse(BaseModel):
    response: str
    model: str
    prompt_tokens: int
    completion_tokens: int


@router.post("/generate", response_model=ContentResponse)
async def generate_content(req: ContentRequest):
    system_prompt, user_prompt = build_content_generation_prompt(
        subject=req.subject,
        topic=req.topic,
        grade_target=req.grade_target,
        delivery_level=req.delivery_level,
        functioning_level=req.functioning_level,
        brain_context=req.brain_context,
        content_type=req.content_type,
    )

    try:
        result = await generate_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=req.max_tokens,
            tenant_id=req.brain_context.get("tenant_id"),
        )
    except BudgetExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM generation failed: {str(e)}")

    quality = run_quality_gate(
        content=result["content"],
        delivery_level=req.delivery_level,
        functioning_level=req.functioning_level,
        sensory_profile=req.brain_context.get("sensory_profile"),
        accommodations=req.brain_context.get("active_accommodations"),
        model_used=result.get("model"),
        learner_id=req.brain_context.get("learner_id"),
        tenant_id=req.brain_context.get("tenant_id"),
        content_type="lesson_content",
    )

    # Sprint 10: responsible-AI evaluation in warn mode. Flag-gated; a
    # violation logs and is surfaced in the response but does not fail
    # the legacy quality gate.
    rai_result = await evaluate_responsible_ai(
        learner_id=str(req.brain_context.get("learner_id") or ""),
        context_type="lesson",
        input_summary=f"{req.subject} / {req.topic}",
        output={"content": result["content"], "subject": req.subject, "topic": req.topic},
        learner_profile_summary={
            "functioningLevel": req.functioning_level,
            "accommodations": req.brain_context.get("active_accommodations") or [],
        },
        policy_mode="warn",
    )
    if rai_result and not rai_result.get("allowed", True):
        logger.warning(
            "responsible-AI flagged generated content: %s",
            {"severity": rai_result.get("severity"), "subject": req.subject},
        )

    await emit_ai_audit(
        event_type="AI_CONTENT_GENERATED",
        tenant_id=req.brain_context.get("tenant_id"),
        learner_id=req.brain_context.get("learner_id"),
        details={
            "model": result.get("model"),
            "subject": req.subject,
            "topic": req.topic,
            "promptTokens": result.get("prompt_tokens"),
            "completionTokens": result.get("completion_tokens"),
            "qualityScore": quality.get("score"),
            "qualityGatePassed": quality.get("passed"),
            "responsibleAiAllowed": (rai_result or {}).get("allowed", True),
        },
    )

    return ContentResponse(
        content=result["content"],
        model=result["model"],
        prompt_tokens=result["prompt_tokens"],
        completion_tokens=result["completion_tokens"],
        quality_score=quality["score"],
        quality_gate_passed=quality["passed"],
        quality_gate_log=quality,
    )


@router.post("/tutor/chat", response_model=TutorChatResponse)
async def tutor_chat(req: TutorChatRequest):
    system_prompt = build_tutor_system_prompt(
        tutor_sku=req.tutor_sku,
        brain_context=req.brain_context,
        functioning_level=req.functioning_level,
        locale=req.locale,
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(req.messages)

    try:
        result = await generate_completion(
            system_prompt=system_prompt,
            user_prompt=req.messages[-1]["content"] if req.messages else "Hello! What shall we learn today?",
            max_tokens=req.max_tokens,
            tenant_id=req.brain_context.get("tenant_id"),
        )
    except BudgetExceeded as e:
        raise HTTPException(status_code=429, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM chat failed: {str(e)}")

    # Sprint 10: responsible-AI evaluation in warn mode for tutor chat.
    rai_result = await evaluate_responsible_ai(
        learner_id=str(req.brain_context.get("learner_id") or ""),
        context_type="chat",
        input_summary=req.messages[-1]["content"] if req.messages else "",
        output=result["content"],
        learner_profile_summary={
            "functioningLevel": req.functioning_level,
            "accommodations": req.brain_context.get("active_accommodations") or [],
        },
        policy_mode="warn",
    )
    if rai_result and not rai_result.get("allowed", True):
        logger.warning(
            "responsible-AI flagged tutor chat: severity=%s",
            rai_result.get("severity"),
        )

    return TutorChatResponse(
        response=result["content"],
        model=result["model"],
        prompt_tokens=result["prompt_tokens"],
        completion_tokens=result["completion_tokens"],
    )


class BaselineRequest(BaseModel):
    parent_assessment: dict
    functioning_level: str = "STANDARD"
    iep: Optional[dict] = None
    district: Optional[dict] = None
    interest_profile: Optional[dict] = None
    # All three of these are OPTIONAL — the prompt builder degrades
    # gracefully when any (or all) are absent, so a learner with only
    # a parent assessment still gets a baseline generation.
    caregiver_perspectives: Optional[list] = None
    teacher_assessment: Optional[dict] = None


class BaselineResponse(BaseModel):
    questions: list
    subjects: list
    model: str
    prompt_tokens: int
    completion_tokens: int


@router.post("/generate-baseline", response_model=BaselineResponse)
async def generate_baseline(req: BaselineRequest):
    from ..services.baseline_generator import SUBJECTS

    system_prompt, user_prompt = build_baseline_generation_prompt(
        req.parent_assessment,
        iep=req.iep,
        district=req.district,
        interest_profile=req.interest_profile,
        caregiver_perspectives=req.caregiver_perspectives,
        teacher_assessment=req.teacher_assessment,
    )

    try:
        result = await generate_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=4000,
            temperature=0.6,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM baseline generation failed: {str(e)}")

    raw = result["content"].strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]

    try:
        parsed = json.loads(raw)
        questions = parsed.get("questions", [])
    except json.JSONDecodeError:
        logger.error(f"Failed to parse baseline JSON: {raw[:200]}")
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for baseline questions")

    REQUIRED_SUBJECTS = {"math", "ela", "science", "speech", "sel", "life_skills", "executive_function"}
    valid_questions = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        if not all(k in q for k in ("id", "subject", "questionText", "options", "correctAnswer")):
            continue
        if not isinstance(q["options"], list) or len(q["options"]) < 2:
            continue
        valid_answers = {o.get("value") for o in q["options"] if isinstance(o, dict) and "value" in o}
        if q["correctAnswer"] not in valid_answers:
            continue
        if q.get("subject") not in REQUIRED_SUBJECTS:
            continue
        valid_questions.append(q)

    if len(valid_questions) < 14:
        raise HTTPException(status_code=502, detail=f"AI generated too few valid questions ({len(valid_questions)}), expected at least 14")

    questions = valid_questions

    return BaselineResponse(
        questions=questions,
        subjects=SUBJECTS,
        model=result["model"],
        prompt_tokens=result["prompt_tokens"],
        completion_tokens=result["completion_tokens"],
    )


class DiscoveryChapterRequest(BaseModel):
    parent_assessment: dict
    chapter: dict
    functioning_level: str = "STANDARD"
    iep: Optional[dict] = None
    district: Optional[dict] = None
    interest_profile: Optional[dict] = None
    # Optional — see BaselineRequest for the same rationale.
    caregiver_perspectives: Optional[list] = None
    teacher_assessment: Optional[dict] = None


class DiscoveryChapterResponse(BaseModel):
    chapter_id: str
    activities: dict
    model: str
    prompt_tokens: int
    completion_tokens: int


@router.post("/generate-discovery-chapter", response_model=DiscoveryChapterResponse)
async def generate_discovery_chapter(req: DiscoveryChapterRequest):
    from ..services.baseline_generator import build_discovery_adventure_prompt

    system_prompt, user_prompt = build_discovery_adventure_prompt(
        req.parent_assessment,
        req.chapter,
        iep=req.iep,
        district=req.district,
        interest_profile=req.interest_profile,
        caregiver_perspectives=req.caregiver_perspectives,
        teacher_assessment=req.teacher_assessment,
    )

    try:
        result = await generate_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=4000,
            temperature=0.7,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM discovery generation failed: {str(e)}")

    raw = result["content"].strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]

    try:
        parsed = json.loads(raw)
        activities = parsed.get("activities", {})
    except json.JSONDecodeError:
        logger.error(f"Failed to parse discovery chapter JSON: {raw[:300]}")
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for discovery chapter")

    for tier in ("easy", "medium", "hard"):
        tier_acts = activities.get(tier, [])
        valid = []
        for act in tier_acts:
            if not isinstance(act, dict):
                continue
            if not all(k in act for k in ("id", "title", "narration", "interaction")):
                continue
            choices = act.get("choices", [])
            if isinstance(choices, list) and len(choices) >= 2:
                has_correct = any(c.get("isCorrect") for c in choices if isinstance(c, dict))
                if has_correct:
                    valid.append(act)
        activities[tier] = valid

    total_valid = sum(len(activities.get(t, [])) for t in ("easy", "medium", "hard"))
    if total_valid < 2:
        raise HTTPException(status_code=502, detail=f"AI generated too few valid activities ({total_valid})")

    return DiscoveryChapterResponse(
        chapter_id=req.chapter.get("id", "unknown"),
        activities=activities,
        model=result["model"],
        prompt_tokens=result["prompt_tokens"],
        completion_tokens=result["completion_tokens"],
    )


class IEPParseRequest(BaseModel):
    document_text: str
    learner_name: str = ""
    learner_age: Optional[int] = None


class IEPParseResponse(BaseModel):
    goals: list
    accommodations: list
    disability_categories: list
    recommended_functioning_level: str
    summary: str
    model: str


@router.post("/parse-iep", response_model=IEPParseResponse)
async def parse_iep_document(request: IEPParseRequest):
    if not request.document_text or len(request.document_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Document text too short for IEP parsing")

    system_prompt = """You are an expert special education IEP (Individualized Education Program) document analyst.
Parse the provided IEP document text and extract structured data.

Return a JSON object with these exact fields:
{
  "goals": [
    {
      "domain": "math|ela|speech|behavior|motor|social|life_skills|executive_function",
      "sub_domain": "optional — for motor goals one of: locomotor|object_control|balance|midline_crossing|heavy_work|vestibular|fine_motor|handwriting_prep|adapted_pe (DAPE). Detect DAPE-related goals from phrases like 'Adapted PE', 'DAPE', 'Gross Motor', 'Fine Motor', 'Motor Planning', 'Locomotor', 'Object Control', 'Midline Crossing', 'Handwriting Legibility'.",
      "description": "Goal description",
      "baseline": "Current performance level",
      "target": "Expected performance level",
      "measurable_criteria": "How progress will be measured"
    }
  ],
  "accommodations": [
    {
      "type": "presentation|response|setting|timing|behavioral",
      "description": "Accommodation description",
      "frequency": "always|as_needed|daily|weekly"
    }
  ],
  "disability_categories": ["autism", "specific_learning_disability", "speech_language_impairment", "etc"],
  "recommended_functioning_level": "STANDARD|SUPPORTED|LOW_VERBAL|NON_VERBAL|PRE_SYMBOLIC",
  "summary": "Brief 2-3 sentence summary of the learner's profile"
}

Use these guidelines for recommended_functioning_level:
- STANDARD: Grade-level academic goals, minimal accommodations
- SUPPORTED: Below grade level, needs accommodations but communicates verbally
- LOW_VERBAL: Significant language delays, needs visual supports, limited verbal output
- NON_VERBAL: Uses AAC/alternative communication, cause-and-effect learning
- PRE_SYMBOLIC: Pre-academic, sensory-based learning, requires full adult support

Return ONLY valid JSON, no markdown formatting."""

    user_prompt = f"Parse this IEP document:\n\n{request.document_text[:8000]}"

    try:
        result = await generate_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=2000,
        )
    except Exception as e:
        logger.error(f"IEP parse LLM error: {e}")
        raise HTTPException(status_code=502, detail="AI service unavailable for IEP parsing")

    raw = result["content"].strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse IEP JSON: {raw[:200]}")
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for IEP parsing")

    return IEPParseResponse(
        goals=parsed.get("goals", []),
        accommodations=parsed.get("accommodations", []),
        disability_categories=parsed.get("disability_categories", []),
        recommended_functioning_level=parsed.get("recommended_functioning_level", "SUPPORTED"),
        summary=parsed.get("summary", "IEP document parsed successfully"),
        model=result["model"],
    )


class EligibilitySuggestRequest(BaseModel):
    referral_reason: str = ""
    assessment_areas: list = []
    observations: str = ""
    parent_input: str = ""


class EligibilitySuggestResponse(BaseModel):
    eligible_likely: bool
    suggested_categories: list
    rationale: str
    recommended_next_steps: list
    confidence: int
    model: str


@router.post("/eligibility-suggest", response_model=EligibilitySuggestResponse)
async def eligibility_suggest(request: EligibilitySuggestRequest):
    """
    Suggest IDEA disability categories based on a teacher-led evaluation.
    Returns a JSON recommendation. The actual eligibility decision is always
    made by the IEP team — this endpoint is decision-support only.
    """
    system_prompt = """You are a special education evaluator helping an IEP team
synthesize evaluation data into a draft eligibility recommendation under IDEA.
You DO NOT make the final decision; you produce a structured suggestion the team
will review.

Return ONLY valid JSON with this exact shape:
{
  "eligible_likely": true|false,
  "suggested_categories": ["autism" | "specific_learning_disability" | "speech_language_impairment" | "other_health_impairment" | "emotional_disturbance" | "intellectual_disability" | "developmental_delay" | "hearing_impairment" | "visual_impairment" | "orthopedic_impairment" | "traumatic_brain_injury" | "multiple_disabilities" | "deaf_blindness" | "deafness"],
  "rationale": "2-4 sentence rationale citing the strongest evidence from the evaluation areas and observations.",
  "recommended_next_steps": ["short action item", "another action item"],
  "confidence": 0-100
}

Be conservative. If evidence is thin, set eligible_likely=false and recommend
additional assessments in next_steps. Do not invent findings that are not in
the input. Use IDEA category labels exactly as listed above.
"""

    areas_str = json.dumps(request.assessment_areas, ensure_ascii=False)[:4000]
    user_prompt = f"""Evaluation referral reason:
{request.referral_reason or "(none provided)"}

Assessment areas (JSON):
{areas_str}

Teacher observations:
{(request.observations or "(none provided)")[:3000]}

Parent input:
{(request.parent_input or "(none provided)")[:2000]}
"""

    try:
        result = await generate_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=900,
        )
    except Exception as e:
        logger.error(f"Eligibility suggest LLM error: {e}")
        raise HTTPException(status_code=502, detail="AI service unavailable for eligibility suggestion")

    raw = result["content"].strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse eligibility JSON: {raw[:200]}")
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for eligibility suggestion")

    confidence = parsed.get("confidence", 0)
    try:
        confidence = max(0, min(100, int(confidence)))
    except (TypeError, ValueError):
        confidence = 0

    raw_eligible = parsed.get("eligible_likely", False)
    if isinstance(raw_eligible, bool):
        eligible_likely = raw_eligible
    elif isinstance(raw_eligible, str):
        eligible_likely = raw_eligible.strip().lower() in ("true", "yes", "1")
    elif isinstance(raw_eligible, (int, float)):
        eligible_likely = bool(raw_eligible)
    else:
        eligible_likely = False

    cats = parsed.get("suggested_categories") or []
    if not isinstance(cats, list):
        cats = []
    cats = [str(c) for c in cats if isinstance(c, (str, int))]

    next_steps = parsed.get("recommended_next_steps") or []
    if not isinstance(next_steps, list):
        next_steps = []
    next_steps = [str(s) for s in next_steps if isinstance(s, (str, int))]

    return EligibilitySuggestResponse(
        eligible_likely=eligible_likely,
        suggested_categories=cats,
        rationale=str(parsed.get("rationale", "")),
        recommended_next_steps=next_steps,
        confidence=confidence,
        model=result["model"],
    )


class DraftGoalRequest(BaseModel):
    concern: str
    domain: str = "academic"
    grade_level: Optional[str] = None
    sub_domain: Optional[str] = None


class DraftGoalResponse(BaseModel):
    goal_text: str
    domain: str
    sub_domain: Optional[str]
    baseline: str
    target_criteria: str
    measurable_criteria: str
    model: str


@router.post("/draft-goal", response_model=DraftGoalResponse)
async def draft_iep_goal(req: DraftGoalRequest):
    """Turn a short concern statement into a SMART annual IEP goal.

    Used by the IEP authoring editor when a teacher clicks
    "AI draft this goal". The AI never overwrites teacher edits — the UI
    only fills empty fields with the response.
    """
    concern = (req.concern or "").strip()
    if len(concern) < 5:
        raise HTTPException(status_code=400, detail="Concern statement is too short")

    domain = (req.domain or "academic").strip().lower()
    grade = (req.grade_level or "unspecified").strip()
    sub_domain = (req.sub_domain or "").strip() or None

    system_prompt = """You write SMART annual IEP goals for special education teams.

Return ONE goal as JSON with these exact fields:
{
  "goal_text": "Specific, measurable, achievable, relevant, time-bound (1 year) goal sentence.",
  "domain": "math|ela|speech|behavior|motor|social|life_skills|executive_function|adaptive",
  "sub_domain": "optional — for motor goals: locomotor|object_control|balance|midline_crossing|heavy_work|vestibular|fine_motor|handwriting_prep|adapted_pe",
  "baseline": "1 sentence describing current performance level (concrete observation).",
  "target_criteria": "1 sentence describing the success criterion (e.g. '4 of 5 trials across 3 sessions').",
  "measurable_criteria": "How progress is measured (data collection method)."
}

Rules:
- Goal must be observable & measurable — no vague verbs ("will understand"). Prefer "will demonstrate", "will produce", "will complete".
- Always include a measurable criterion (% accuracy, # of trials, frequency, duration).
- Stay age/grade-appropriate.
- Return ONLY the JSON object, no markdown."""

    user_prompt = (
        f"Concern: {concern}\n"
        f"Domain: {domain}\n"
        f"Grade level: {grade}\n"
        f"Sub-domain (optional): {sub_domain or 'none'}\n\n"
        "Draft one SMART annual goal."
    )

    try:
        result = await generate_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=600,
        )
    except Exception as e:
        logger.error(f"Goal drafter LLM error: {e}")
        raise HTTPException(status_code=502, detail="AI service unavailable for goal drafting")

    raw = result["content"].strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse goal JSON: {raw[:200]}")
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for goal drafting")

    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="AI returned invalid shape for goal drafting")

    return DraftGoalResponse(
        goal_text=str(parsed.get("goal_text") or "").strip(),
        domain=str(parsed.get("domain") or domain).strip(),
        sub_domain=(str(parsed["sub_domain"]).strip() if parsed.get("sub_domain") else None),
        baseline=str(parsed.get("baseline") or "").strip(),
        target_criteria=str(parsed.get("target_criteria") or "").strip(),
        measurable_criteria=str(parsed.get("measurable_criteria") or "").strip(),
        model=result["model"],
    )

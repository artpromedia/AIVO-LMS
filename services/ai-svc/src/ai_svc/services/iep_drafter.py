"""Sprint 6 — Baseline → IEP draft pipeline.

Consumes the learner profile produced by the adaptive baseline (theta
placement, modality fit, frustration tolerance) + the parent assessment
+ per-subject baseline scores, and produces a draft IEP that a teacher
or therapist can review and finalise. Output conforms to
``IEPDraftPayload`` (pydantic) so the route layer can validate strictly
and the audit trail can store the structured object.

The draft itself is decision-SUPPORT, not a decision: every goal,
accommodation, and service minute lands in the draft as ``status =
ai_draft``. The team reviews + edits before the IEP is finalised.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, ValidationError

from .baseline_schemas import REQUIRED_SUBJECTS


# ── Pydantic output schema ─────────────────────────────────────────


ALLOWED_DOMAINS = (
    "math", "ela", "science", "speech",
    "sel", "life_skills", "executive_function",
    "behaviour", "motor", "adaptive",
)

ALLOWED_ACCOMMODATION_TYPES = (
    "presentation", "response", "setting", "timing", "behavioural",
)

ALLOWED_SERVICE_TYPES = (
    "SPED", "SLP", "OT", "PT", "COUNSELING", "ABA", "BEHAVIOUR_SUPPORT",
)


class IepDraftGoal(BaseModel):
    domain: str = Field(min_length=1, max_length=64)
    goalText: str = Field(min_length=10, max_length=600)
    baseline: str = Field(default="", max_length=400)
    targetCriteria: str = Field(default="", max_length=400)
    measurableCriteria: str = Field(default="", max_length=400)
    evidence: list[str] = Field(default_factory=list)


class IepDraftAccommodation(BaseModel):
    type: str = Field(min_length=1, max_length=32)
    description: str = Field(min_length=4, max_length=400)
    frequency: str = Field(default="as_needed", max_length=32)
    rationale: str = Field(default="", max_length=400)
    priority: int = Field(default=2, ge=1, le=5)


class IepDraftService(BaseModel):
    serviceType: str = Field(min_length=1, max_length=32)
    minutesPerWeek: int = Field(ge=0, le=600)
    frequency: str = Field(default="weekly", max_length=32)
    location: str = Field(default="school", max_length=64)
    rationale: str = Field(default="", max_length=400)


class IepDraftPayload(BaseModel):
    summary: str = Field(min_length=20, max_length=1500)
    goals: list[IepDraftGoal] = Field(min_length=3, max_length=24)
    accommodations: list[IepDraftAccommodation] = Field(min_length=1, max_length=12)
    services: list[IepDraftService] = Field(default_factory=list, max_length=8)
    risks: list[str] = Field(default_factory=list)
    """Short, plain-language items the team should verify (e.g. "draft
    inferred SLP minutes from speech score alone — confirm with SLP
    evaluation")."""


# ── Prompt construction ────────────────────────────────────────────


def _format_profile(profile: dict[str, Any] | None) -> str:
    if not profile:
        return "## Learner Profile\n(No baseline profile on file — calibrate broadly to the parent assessment.)"
    theta = profile.get("thetaPlacement")
    proc = profile.get("processingSpeedMs")
    frust = profile.get("frustrationRate")
    tol = profile.get("frustrationTolerance")
    attn = profile.get("attentionRunLength")
    modality = profile.get("modalityFit") or []
    mod_lines: list[str] = []
    if isinstance(modality, list):
        for m in modality[:6]:
            if not isinstance(m, dict):
                continue
            mod_lines.append(
                f"  - {m.get('modality', '?')}: accuracy {m.get('accuracy', 0):.0%} "
                f"(n={m.get('n', '?')})"
            )
    mod_block = "\n".join(mod_lines) if mod_lines else "  - (no modality breakdown)"
    return f"""## Learner Profile (from completed baseline)
- Theta placement (logit scale): {theta if theta is not None else 'unknown'}
- Processing speed: {proc if proc is not None else 'unknown'} ms (median, correct items)
- Frustration rate: {frust if frust is not None else 'unknown'}
- Frustration tolerance: {tol or 'unknown'}
- Sustained attention run length: {attn if attn is not None else 'unknown'} items

### Modality fit
{mod_block}"""


def _format_domain_scores(scores: dict[str, Any] | None) -> str:
    if not isinstance(scores, dict) or not scores:
        return "## Baseline Domain Scores\n(no per-subject scores recorded)"
    lines: list[str] = []
    for subj in REQUIRED_SUBJECTS:
        row = scores.get(subj)
        if not isinstance(row, dict):
            continue
        correct = row.get("correct", "?")
        total = row.get("total", "?")
        diff = row.get("difficulty", "?")
        lat = row.get("avgLatencyMs", "?")
        lines.append(
            f"  - {subj}: {correct}/{total} correct (avg difficulty {diff}, "
            f"avg latency {lat} ms)"
        )
    if not lines:
        return "## Baseline Domain Scores\n(no per-subject scores recorded)"
    return "## Baseline Domain Scores\n" + "\n".join(lines)


def build_iep_draft_prompt(
    *,
    parent_assessment: dict[str, Any],
    learning_profile: dict[str, Any] | None,
    domain_scores: dict[str, Any] | None,
    iep_context: dict[str, Any] | None = None,
) -> tuple[str, str]:
    """Return ``(system_prompt, user_prompt)`` for the IEP drafter.

    The system prompt orients the model around its role (decision
    SUPPORT, not decision-making). The user prompt embeds the
    structured inputs + the strict JSON output contract.
    """

    functioning_level = parent_assessment.get("functioningLevel", "STANDARD")
    diagnoses = parent_assessment.get("diagnoses") or []
    responses = parent_assessment.get("responses") or {}
    strengths = responses.get("str-1") or []
    challenges = responses.get("ch-1") or []
    interests = responses.get("pref-1") or []
    if not isinstance(strengths, list):
        strengths = []
    if not isinstance(challenges, list):
        challenges = []
    if not isinstance(interests, list):
        interests = []

    iep_block = ""
    if isinstance(iep_context, dict) and iep_context:
        disability = iep_context.get("disabilityCategories") or []
        accom = iep_context.get("accommodations") or []
        iep_block = f"""
## Existing IEP Context
- Disability categories: {', '.join(disability) if disability else 'none recorded'}
- Existing accommodations on file: {len(accom) if isinstance(accom, list) else 0}
- Grade level (IEP): {iep_context.get('gradeLevel') or 'unspecified'}
"""

    system_prompt = f"""You are AIVO's IEP drafter. Your job is to synthesize a learner's
parent intake, completed adaptive baseline, and (when present) existing
IEP context into a draft IEP that a special-education team will REVIEW
and edit before finalising.

You are decision-SUPPORT, not the decision. Every output is provisional.
Never invent diagnoses, never imply a placement decision. Tag every
service-minute recommendation with a rationale grounded in the inputs.

## Learner — High Level
- Functioning level: {functioning_level}
- Diagnoses reported: {', '.join(diagnoses) if diagnoses else 'none'}
- Strengths (parent-reported): {', '.join(strengths) if strengths else 'not specified'}
- Challenges (parent-reported): {', '.join(challenges) if challenges else 'not specified'}
- Interests (parent-reported): {', '.join(interests) if interests else 'not specified'}
{iep_block}
{_format_profile(learning_profile)}

{_format_domain_scores(domain_scores)}

## Output Rules
- Return ONE JSON object exactly matching the schema in the user prompt.
- Goals must be SMART (specific, measurable, achievable, relevant, time-bound).
  Avoid vague verbs like "will understand"; prefer "will demonstrate",
  "will produce", "will complete".
- Each goal MUST include a measurableCriteria (e.g. "4 of 5 trials across
  3 sessions" or "80 percent accuracy over 2 weeks").
- Accommodations: rank by priority (1 = most impactful) and provide a
  short rationale referencing the input that motivated the choice.
- Services: only recommend service minutes you can JUSTIFY from the
  inputs. If you cannot justify a service, omit it. NEVER recommend
  >300 minutes per week for any single service. Use SPED for general
  special-ed minutes, SLP for speech-language, OT for occupational
  therapy, PT for physical therapy, COUNSELING for SEL/mental health,
  ABA / BEHAVIOUR_SUPPORT only when behaviour is the documented driver.
- Add risks[] entries for ANY recommendation where the evidence is
  thin — the IEP team needs to verify those before signing.
- Do not include code fences in your output. Return ONLY the JSON object."""

    user_prompt = """Draft the IEP now. Return ONLY a JSON object with this exact shape:
{
  "summary": "2-4 sentence executive summary grounded in the inputs.",
  "goals": [
    {
      "domain": "math|ela|science|speech|sel|life_skills|executive_function|behaviour|motor|adaptive",
      "goalText": "SMART annual goal sentence.",
      "baseline": "Current performance level (1 sentence, concrete).",
      "targetCriteria": "What success looks like (1 sentence).",
      "measurableCriteria": "Data collection method + threshold.",
      "evidence": ["short reason from inputs", "another reason"]
    }
  ],
  "accommodations": [
    {
      "type": "presentation|response|setting|timing|behavioural",
      "description": "What the accommodation IS.",
      "frequency": "always|daily|weekly|as_needed",
      "rationale": "Why this learner — cite a strength / challenge / score.",
      "priority": 1-5
    }
  ],
  "services": [
    {
      "serviceType": "SPED|SLP|OT|PT|COUNSELING|ABA|BEHAVIOUR_SUPPORT",
      "minutesPerWeek": 0-300,
      "frequency": "weekly|biweekly|monthly",
      "location": "school|home|telehealth|community",
      "rationale": "Short justification from the inputs."
    }
  ],
  "risks": ["short risk #1", "short risk #2"]
}

Rules summary:
  - 3-5 goals per active domain (math + ela + at least 1 SEL or speech goal
    when those signals are weak in the baseline). Total goals 3-24.
  - 1-12 accommodations, with priority 1 reserved for "if this isn't in
    place the learner can't access the curriculum".
  - services is OPTIONAL; only include items you can justify.
  - risks SHOULD be present for any low-evidence recommendation."""

    return system_prompt, user_prompt


# ── Validation ─────────────────────────────────────────────────────


def validate_iep_draft(raw: dict[str, Any]) -> tuple[IepDraftPayload | None, list[str]]:
    try:
        payload = IepDraftPayload.model_validate(raw)
    except ValidationError as exc:
        errors: list[str] = []
        for err in exc.errors():
            loc = ".".join(str(x) for x in err.get("loc", ()))
            msg = err.get("msg", "validation error")
            errors.append(f"{loc}: {msg}")
        return None, errors

    # Domain whitelist (we allow ALLOWED_DOMAINS only — anything else
    # marks a hallucinated domain).
    bad_domains: list[str] = []
    for idx, g in enumerate(payload.goals):
        if g.domain not in ALLOWED_DOMAINS:
            bad_domains.append(f"goals[{idx}].domain={g.domain}")
    if bad_domains:
        return None, ["unknown goal domains: " + ", ".join(bad_domains)]

    # Service type whitelist.
    bad_services: list[str] = []
    for idx, s in enumerate(payload.services):
        if s.serviceType not in ALLOWED_SERVICE_TYPES:
            bad_services.append(f"services[{idx}].serviceType={s.serviceType}")
    if bad_services:
        return None, ["unknown service types: " + ", ".join(bad_services)]

    # Accommodation type whitelist.
    bad_accoms: list[str] = []
    for idx, a in enumerate(payload.accommodations):
        if a.type not in ALLOWED_ACCOMMODATION_TYPES:
            bad_accoms.append(f"accommodations[{idx}].type={a.type}")
    if bad_accoms:
        return None, ["unknown accommodation types: " + ", ".join(bad_accoms)]

    return payload, []

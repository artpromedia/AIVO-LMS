import json
import logging
from typing import Optional

from brain_svc.services.curriculum_validator import (
    fetch_valid_codes,
    validate_nodes,
)
from brain_svc.services.llm_gateway import generate_completion

logger = logging.getLogger("brain-svc.curriculum_engine")

# ADR 0040/0041: curriculum-svc is the authoritative source of standards.
# This engine is a SCAFFOLDING layer — it rephrases and sequences catalogue
# standards for a learner; it must never invent standard codes. The prompt
# below forbids it, and extract_curriculum_standards() additionally drops
# any code the model emits that is absent from the catalogue.
CURRICULUM_EXTRACTOR_SYSTEM = """You are AIVO's Curriculum Scaffolding Engine. You do NOT decide what the curriculum is — curriculum-svc is the single authoritative source of standards. Your job is to rephrase, scaffold, and sequence the catalogue standards you are given for a learner's functioning level.

Rules:
- NEVER invent a standard code. Use ONLY the standard codes listed in the "Authoritative catalogue codes" provided to you. Any code you output that is not in that list will be rejected and dropped.
- Rephrase descriptions into clear, learner-friendly language and adapt scope/sequence for the functioning level.
- For modified/functional curricula, describe alternate achievement of the PROVIDED standards — do not introduce new codes.
- Reference prerequisites only by codes that appear in the provided list.
- Output valid JSON only."""


# Coarse map from engine subject labels to curriculum-svc subject tokens.
_CATALOGUE_SUBJECT = {
    "math": "math",
    "mathematics": "math",
    "maths": "math",
    "ela": "ela",
    "english": "ela",
    "english language arts": "ela",
    "language arts": "ela",
    "reading": "ela",
}


def _catalogue_subject(subject: str) -> str:
    s = (subject or "").strip().lower()
    return _CATALOGUE_SUBJECT.get(s, s)

SCOPE_SEQUENCE_SYSTEM = """You are AIVO's Scope & Sequence Generator — an expert in building personalized learning progressions aligned to educational standards.

Given a learner's current mastery levels, curriculum framework, and grade level, generate a term-by-term scope and sequence that:
1. Starts from the learner's current demonstrated ability
2. Follows the framework's recommended progression
3. Accounts for any accommodations or modified pacing
4. Includes cross-curricular connections where natural
5. Builds toward grade-level expectations at the learner's pace

Output valid JSON only."""


async def extract_curriculum_standards(
    framework: str,
    standards_code: str,
    subject: str,
    grade_level: str,
    functioning_level: str = "STANDARD",
    state: Optional[str] = None,
    district_id: Optional[str] = None,
    country: Optional[str] = None,
    region: Optional[str] = None,
    postal_code: Optional[str] = None,
) -> dict:
    # Authoritative codes the model is allowed to scaffold. None means the
    # catalogue could not be consulted — in that case we refuse to emit any
    # standards rather than trust unvalidated LLM output (ADR 0041).
    valid_codes = await fetch_valid_codes(
        subject=_catalogue_subject(subject),
        grade_band=grade_level,
        country=country,
        region=region,
        postal_code=postal_code,
        district_id=district_id,
    )
    allowed = sorted(valid_codes) if valid_codes else []
    allowed_block = (
        "Authoritative catalogue codes (use ONLY these): "
        + (", ".join(allowed) if allowed else "(none available)")
    )

    user_prompt = f"""Scaffold the authoritative curriculum standards for this learner context:

Framework: {framework}
Standards Code: {standards_code}
Subject: {subject}
Grade Level: {grade_level}
Functioning Level: {functioning_level}
{f'State: {state}' if state else ''}
{f'District: {district_id}' if district_id else ''}
{f'Country: {country}' if country else ''}
{f'Region: {region}' if region else ''}

{allowed_block}

Respond with JSON:
{{
  "framework": "{framework}",
  "subject": "{subject}",
  "grade_level": "{grade_level}",
  "standards": [
    {{
      "code": "standard identifier code",
      "domain": "domain/strand name",
      "cluster": "cluster/category",
      "description": "full standard description",
      "priority": "essential|important|supporting",
      "prerequisite_standards": ["prior standard codes"],
      "complexity_level": 1-5
    }}
  ],
  "domains": [
    {{
      "name": "domain name",
      "description": "what this domain covers",
      "weight": 0.0-1.0,
      "standard_count": 0
    }}
  ],
  "grade_band_expectations": {{
    "by_end_of_year": ["key expectations"],
    "critical_areas": ["focus areas for this grade"]
  }},
  "functioning_level_adaptations": {{
    "modified_standards": ["any alternate achievement standards"],
    "pacing_notes": "recommended pacing adjustments",
    "prerequisite_gaps": ["skills to address first"]
  }}
}}"""

    try:
        result = await generate_completion(
            system_prompt=CURRICULUM_EXTRACTOR_SYSTEM,
            user_prompt=user_prompt,
            temperature=0.2,
            max_tokens=3000,
        )
        data = _parse_llm_json(result, "standards")
    except Exception as e:
        logger.error(f"Curriculum extraction failed: {e}")
        return {"error": str(e), "framework": framework, "subject": subject}

    return _validate_standards(data, valid_codes)


def _validate_standards(data: dict, valid_codes: set[str] | None) -> dict:
    """Drop any LLM-emitted standard whose code is not in the catalogue.

    If the catalogue was unreachable (``valid_codes is None``) we emit NO
    standards — the engine never serves unvalidated LLM codes (ADR 0041).
    """
    if not isinstance(data, dict) or not isinstance(data.get("standards"), list):
        return data
    if valid_codes is None:
        rejected = [{"code": s.get("code"), "reason": "catalogue_unavailable"} for s in data["standards"]]
        data["standards"] = []
        data["validation"] = {"catalogue_available": False, "rejected": rejected}
        return data
    result = validate_nodes(data["standards"], valid_codes)
    data["standards"] = result.accepted
    data["validation"] = {"catalogue_available": True, "rejected": result.rejected}
    return data


async def generate_scope_sequence(
    framework: str,
    subject: str,
    grade_level: str,
    mastery_levels: dict,
    functioning_level: str = "STANDARD",
    accommodations: list = None,
    term_count: int = 4,
) -> dict:
    user_prompt = f"""Generate a personalized scope and sequence for this learner:

Framework: {framework}
Subject: {subject}
Grade Level: {grade_level}
Functioning Level: {functioning_level}
Current Mastery: {json.dumps(mastery_levels)}
Active Accommodations: {json.dumps(accommodations or [])}
Number of Terms: {term_count}

Respond with JSON:
{{
  "subject": "{subject}",
  "total_terms": {term_count},
  "terms": [
    {{
      "term_number": 1,
      "title": "term title",
      "duration_weeks": 9,
      "units": [
        {{
          "title": "unit title",
          "duration_weeks": 3,
          "standards_addressed": ["standard codes"],
          "learning_objectives": ["specific objectives"],
          "key_vocabulary": ["terms"],
          "prerequisite_check": "what learner needs first",
          "assessments": ["formative and summative"],
          "accommodations_applied": ["relevant accommodations"],
          "cross_curricular": ["connections to other subjects"]
        }}
      ],
      "mastery_targets": {{"domain": 0.0-1.0}}
    }}
  ],
  "pacing_rationale": "why this pacing works for this learner",
  "differentiation_notes": "how content is adapted"
}}"""

    try:
        result = await generate_completion(
            system_prompt=SCOPE_SEQUENCE_SYSTEM,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=4000,
        )
        return _parse_llm_json(result, "scope_sequence")
    except Exception as e:
        logger.error(f"Scope & sequence generation failed: {e}")
        return {"error": str(e), "subject": subject}


async def generate_topic_sequence_for_path(
    framework: str,
    subject: str,
    grade_level: str,
    current_mastery: float,
    functioning_level: str = "STANDARD",
    completed_topics: list = None,
) -> list:
    user_prompt = f"""Generate the next 10 topic sequence for a learner's learning path:

Framework: {framework}
Subject: {subject}
Grade Level: {grade_level}
Current Mastery: {current_mastery}
Functioning Level: {functioning_level}
Already Completed: {json.dumps(completed_topics or [])}

Respond with a JSON array of topic objects:
[
  {{
    "topic": "topic name",
    "standard_codes": ["aligned standards"],
    "prerequisite_topics": ["topics needed first"],
    "estimated_sessions": 2-5,
    "difficulty": 1-5,
    "description": "what the learner will learn"
  }}
]"""

    try:
        result = await generate_completion(
            system_prompt=CURRICULUM_EXTRACTOR_SYSTEM,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=2000,
        )
        parsed = _parse_llm_json(result, "topics")
        if isinstance(parsed, list):
            return parsed
        return parsed.get("topics", [])
    except Exception as e:
        logger.error(f"Topic sequence generation failed: {e}")
        return []


def _parse_llm_json(result: dict, context: str):
    try:
        content = result["content"]
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        return json.loads(content.strip())
    except (json.JSONDecodeError, IndexError) as e:
        logger.warning(f"Failed to parse LLM JSON for {context}: {e}")
        return {"raw_response": result["content"], "parse_error": str(e)}

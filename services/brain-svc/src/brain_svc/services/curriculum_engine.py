import json
import logging
from typing import Optional
from brain_svc.services.llm_gateway import generate_completion

logger = logging.getLogger("brain-svc.curriculum_engine")

CURRICULUM_EXTRACTOR_SYSTEM = """You are AIVO's Curriculum Standards Engine — an expert in educational standards across all US states, international frameworks, and special education standards.

Given a curriculum framework, subject, grade level, and functioning level, generate the specific learning standards, objectives, and scope-and-sequence that should guide this learner's educational path.

Rules:
- Use REAL standards codes and descriptions from the specified framework
- For US state standards, use actual standard identifiers (e.g., CCSS.MATH.3.OA.A.1, TEKS 3.4A)
- Adapt scope and sequence for the learner's functioning level
- For modified/functional curricula, include alternate achievement standards
- Include prerequisite skills and extension opportunities
- Keep standards relevant to the specific grade band
- Output valid JSON only"""

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
) -> dict:
    user_prompt = f"""Extract the specific curriculum standards for this learner context:

Framework: {framework}
Standards Code: {standards_code}
Subject: {subject}
Grade Level: {grade_level}
Functioning Level: {functioning_level}
{f'State: {state}' if state else ''}
{f'District: {district_id}' if district_id else ''}

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
        return _parse_llm_json(result, "standards")
    except Exception as e:
        logger.error(f"Curriculum extraction failed: {e}")
        return {"error": str(e), "framework": framework, "subject": subject}


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

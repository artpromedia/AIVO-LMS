"""Pydantic schemas for baseline-question structured outputs (Sprint 2).

The baseline pipeline previously parsed the LLM's JSON output by hand
and rejected items field-by-field. That worked but it was lossy:
malformed items were dropped silently, schema drift was invisible to
ops, and we had no way to retry the LLM with concrete feedback. These
schemas formalize the contract so the route layer can:

  * validate the entire payload in one pass (pydantic)
  * surface structured validation errors back to the LLM for an
    auto-correction retry
  * pass a JSON schema to providers that support response_format /
    structured outputs (Anthropic, OpenAI, Gemini all honor the hint
    via LiteLLM)
  * gain new fields (skillId, standardRef, bloomLevel) without breaking
    older generations — every new field is OPTIONAL and back-compat
    with the Sprint B1 frontend zod schema.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator


REQUIRED_SUBJECTS: tuple[str, ...] = (
    "math",
    "ela",
    "science",
    "speech",
    "sel",
    "life_skills",
    "executive_function",
)

ALLOWED_DIFFICULTIES_TEXT: tuple[str, ...] = (
    "foundational", "easy", "approaching", "grade_level",
    "moderate", "stretch", "hard", "advanced",
)

ALLOWED_BLOOM_LEVELS: tuple[str, ...] = (
    "remember", "understand", "apply", "analyze", "evaluate", "create",
)


class BaselineOption(BaseModel):
    value: str = Field(min_length=1, max_length=200)
    label: str = Field(min_length=1, max_length=500)


class BaselineQuestion(BaseModel):
    """One generated baseline question.

    Required fields mirror the Sprint B1 frontend zod schema so a
    payload validated here is guaranteed to round-trip through the
    web-v2 BFF without re-rejection. New fields are OPTIONAL so older
    LLM outputs (pre-Sprint-2) still parse cleanly.
    """

    id: str = Field(min_length=1, max_length=200)
    subject: str = Field(min_length=1, max_length=64)
    questionText: str = Field(min_length=1, max_length=2000)
    options: list[BaselineOption] = Field(min_length=2, max_length=10)
    correctAnswer: str = Field(min_length=1, max_length=200)

    # Optional metadata. None of these block validation when absent.
    difficulty: str | int | None = None
    explanation: str | None = Field(default=None, max_length=2000)
    skillId: str | None = Field(default=None, max_length=200)
    standardRef: str | None = Field(default=None, max_length=200)
    bloomLevel: str | None = None
    interactionType: str | None = Field(default=None, max_length=64)
    accommodationsApplied: list[str] | None = None
    functioningLevelTag: str | None = Field(default=None, max_length=32)

    @field_validator("subject")
    @classmethod
    def _subject_in_allow_list(cls, v: str) -> str:
        if v not in REQUIRED_SUBJECTS:
            raise ValueError(
                f"subject {v!r} must be one of {REQUIRED_SUBJECTS}"
            )
        return v

    @field_validator("difficulty")
    @classmethod
    def _normalize_difficulty(cls, v: Any) -> Any:
        # Accept ints (1/2/3 legacy), text labels, or None. Anything else
        # gets coerced to None rather than rejecting the whole question.
        if v is None:
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, str) and v.strip():
            return v.strip().lower()
        return None

    @field_validator("bloomLevel")
    @classmethod
    def _bloom_level_known(cls, v: str | None) -> str | None:
        if v is None:
            return None
        lower = v.strip().lower()
        return lower if lower in ALLOWED_BLOOM_LEVELS else None

    @model_validator(mode="after")
    def _correct_answer_in_options(self) -> "BaselineQuestion":
        values = {o.value for o in self.options}
        if self.correctAnswer not in values:
            raise ValueError(
                f"correctAnswer {self.correctAnswer!r} must equal one of "
                f"the option values {sorted(values)}"
            )
        return self


class BaselineGenerationPayload(BaseModel):
    """Top-level payload the baseline generator is expected to return."""

    questions: list[BaselineQuestion] = Field(min_length=1)


# JSON schema literal — keep it stable so it can be embedded in the
# user prompt for providers that don't enforce structured outputs.
# Hand-written rather than pulled from `.model_json_schema()` so we can
# strip pydantic-specific noise the LLM doesn't need to see.
BASELINE_OUTPUT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["questions"],
    "additionalProperties": False,
    "properties": {
        "questions": {
            "type": "array",
            "minItems": 14,
            "items": {
                "type": "object",
                "required": [
                    "id", "subject", "questionText", "options", "correctAnswer",
                ],
                "additionalProperties": False,
                "properties": {
                    "id": {"type": "string"},
                    "subject": {"type": "string", "enum": list(REQUIRED_SUBJECTS)},
                    "questionText": {"type": "string"},
                    "options": {
                        "type": "array",
                        "minItems": 2,
                        "maxItems": 10,
                        "items": {
                            "type": "object",
                            "required": ["value", "label"],
                            "additionalProperties": False,
                            "properties": {
                                "value": {"type": "string"},
                                "label": {"type": "string"},
                            },
                        },
                    },
                    "correctAnswer": {"type": "string"},
                    "difficulty": {
                        "oneOf": [
                            {"type": "string"},
                            {"type": "integer"},
                            {"type": "null"},
                        ]
                    },
                    "explanation": {"type": ["string", "null"]},
                    "skillId": {"type": ["string", "null"]},
                    "standardRef": {"type": ["string", "null"]},
                    "bloomLevel": {
                        "type": ["string", "null"],
                        "enum": [*ALLOWED_BLOOM_LEVELS, None],
                    },
                    "interactionType": {"type": ["string", "null"]},
                    "accommodationsApplied": {
                        "type": ["array", "null"],
                        "items": {"type": "string"},
                    },
                    "functioningLevelTag": {"type": ["string", "null"]},
                },
            },
        }
    },
}


def render_schema_prompt_section() -> str:
    """Format the JSON schema as a prompt-ready section the LLM reads
    BEFORE the example payload. We keep it concise — listing the schema
    rules in plain language outperforms dumping the raw JSON schema for
    most providers.
    """
    return """## Output Schema (STRICT)
You MUST return a JSON object that matches this contract exactly. The
host service validates with pydantic and will REJECT any item that
fails. On rejection your output is discarded; do not invent extra
fields, do not omit required fields.

Top level:
  { "questions": [ <question>, ... ] }   # at least 14, target 42

Each question object:
  {
    "id":            string,   # required, unique per response
    "subject":       string,   # required, one of: math|ela|science|speech|sel|life_skills|executive_function
    "questionText":  string,   # required, ≤ 2000 chars
    "options":       Option[], # required, 2..10 entries
    "correctAnswer": string,   # required, MUST equal one of options[].value
    "difficulty":    string|int|null,  # optional: easy|moderate|hard or 1|2|3
    "explanation":   string|null,      # optional rationale
    "skillId":       string|null,      # optional, prefer a curriculum-svc anchor when grounding is present
    "standardRef":   string|null,      # optional, e.g. "ccss-math.3.OA.A.1"
    "bloomLevel":    string|null,      # optional: remember|understand|apply|analyze|evaluate|create
    "interactionType":      string|null,  # e.g. multiple_choice
    "accommodationsApplied": string[]|null,
    "functioningLevelTag":   string|null
  }

  where Option = { "value": string, "label": string }

Hard rules:
  - correctAnswer MUST be one of the values in options[].value (exact match).
  - subject MUST be from the allow-list above; do not invent new subjects.
  - Return ONE JSON object only. No markdown, no code fences, no commentary."""


def validate_baseline_payload(raw: dict[str, Any]) -> tuple[BaselineGenerationPayload | None, list[str]]:
    """Validate ``raw`` against ``BaselineGenerationPayload``.

    Returns ``(payload, [])`` on success, or ``(None, [error, ...])`` on
    failure with one human-readable string per violation so the route
    layer can either retry the LLM with the feedback or persist the
    errors for inspection.
    """
    try:
        payload = BaselineGenerationPayload.model_validate(raw)
    except ValidationError as exc:
        errors: list[str] = []
        for err in exc.errors():
            loc = ".".join(str(x) for x in err.get("loc", ()))
            msg = err.get("msg", "validation error")
            errors.append(f"{loc}: {msg}")
        return None, errors
    return payload, []


def validate_questions_subset(raw: dict[str, Any]) -> tuple[list[BaselineQuestion], list[str]]:
    """Best-effort validation that returns the subset of questions that
    individually validate, plus per-item error messages for the rest.
    Used when partial success is preferable to outright rejection.
    """
    items = (raw or {}).get("questions") or []
    if not isinstance(items, list):
        return [], ["questions: must be an array"]
    good: list[BaselineQuestion] = []
    errors: list[str] = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            errors.append(f"questions[{idx}]: must be an object")
            continue
        try:
            good.append(BaselineQuestion.model_validate(item))
        except ValidationError as exc:
            for err in exc.errors():
                loc = ".".join(str(x) for x in err.get("loc", ()))
                msg = err.get("msg", "validation error")
                errors.append(f"questions[{idx}].{loc}: {msg}")
    return good, errors

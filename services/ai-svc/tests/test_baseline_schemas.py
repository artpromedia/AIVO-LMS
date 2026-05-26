"""Tests for the Sprint 2 structured-output schema for baseline items.

Covers BaselineQuestion validation, the BaselineGenerationPayload
top-level container, the partial-validation salvage helper, and the
prompt rendering of the schema section. Together with the route-layer
auto-correction retry these tests pin down the structured-output
contract baseline-llm.ts on the frontend re-validates.
"""
from __future__ import annotations

import pytest

from ai_svc.services.baseline_schemas import (
    BASELINE_OUTPUT_JSON_SCHEMA,
    BaselineGenerationPayload,
    BaselineQuestion,
    render_schema_prompt_section,
    validate_baseline_payload,
    validate_questions_subset,
)
from ai_svc.services.baseline_generator import build_baseline_generation_prompt


VALID_QUESTION: dict = {
    "id": "m1",
    "subject": "math",
    "questionText": "What is 2 + 2?",
    "options": [
        {"value": "a", "label": "3"},
        {"value": "b", "label": "4"},
        {"value": "c", "label": "5"},
        {"value": "d", "label": "6"},
    ],
    "correctAnswer": "b",
}


class TestBaselineQuestion:
    def test_minimal_required_fields_validate(self) -> None:
        q = BaselineQuestion.model_validate(VALID_QUESTION)
        assert q.id == "m1"
        assert q.subject == "math"
        assert q.correctAnswer == "b"
        assert q.skillId is None

    def test_optional_fields_round_trip(self) -> None:
        full = {
            **VALID_QUESTION,
            "id": "m2",
            "difficulty": "easy",
            "explanation": "Two plus two equals four.",
            "skillId": "ccss-math.K.OA.A.1",
            "standardRef": "CCSS-Math K.OA.A.1",
            "bloomLevel": "remember",
            "interactionType": "multiple_choice",
            "accommodationsApplied": ["read_aloud", "extended_time"],
            "functioningLevelTag": "STANDARD",
        }
        q = BaselineQuestion.model_validate(full)
        assert q.skillId == "ccss-math.K.OA.A.1"
        assert q.bloomLevel == "remember"
        assert q.accommodationsApplied == ["read_aloud", "extended_time"]

    def test_unknown_bloom_level_coerced_to_none(self) -> None:
        q = BaselineQuestion.model_validate({**VALID_QUESTION, "bloomLevel": "fortune-telling"})
        assert q.bloomLevel is None

    def test_subject_outside_enum_rejected(self) -> None:
        with pytest.raises(Exception):
            BaselineQuestion.model_validate({**VALID_QUESTION, "subject": "art"})

    def test_correct_answer_must_be_in_options(self) -> None:
        bad = {**VALID_QUESTION, "correctAnswer": "z"}
        with pytest.raises(Exception):
            BaselineQuestion.model_validate(bad)

    def test_too_few_options_rejected(self) -> None:
        bad = {**VALID_QUESTION, "options": [{"value": "a", "label": "one"}], "correctAnswer": "a"}
        with pytest.raises(Exception):
            BaselineQuestion.model_validate(bad)

    def test_missing_required_field_rejected(self) -> None:
        bad = {k: v for k, v in VALID_QUESTION.items() if k != "questionText"}
        with pytest.raises(Exception):
            BaselineQuestion.model_validate(bad)

    def test_difficulty_accepts_int_or_text(self) -> None:
        q1 = BaselineQuestion.model_validate({**VALID_QUESTION, "difficulty": 2})
        q2 = BaselineQuestion.model_validate({**VALID_QUESTION, "difficulty": "Easy"})
        assert q1.difficulty == 2
        assert q2.difficulty == "easy"


class TestPayload:
    def test_payload_round_trip(self) -> None:
        payload = BaselineGenerationPayload.model_validate(
            {"questions": [VALID_QUESTION, {**VALID_QUESTION, "id": "m2"}]}
        )
        assert len(payload.questions) == 2

    def test_empty_payload_rejected(self) -> None:
        with pytest.raises(Exception):
            BaselineGenerationPayload.model_validate({"questions": []})


class TestValidateBaselinePayload:
    def test_happy_path(self) -> None:
        out, errs = validate_baseline_payload(
            {"questions": [VALID_QUESTION, {**VALID_QUESTION, "id": "m2"}]}
        )
        assert out is not None
        assert errs == []
        assert len(out.questions) == 2

    def test_returns_structured_errors_on_failure(self) -> None:
        bad = {"questions": [{**VALID_QUESTION, "subject": "art"}]}
        out, errs = validate_baseline_payload(bad)
        assert out is None
        assert any("subject" in e for e in errs)


class TestValidateQuestionsSubset:
    def test_keeps_good_drops_bad(self) -> None:
        items = [
            VALID_QUESTION,                                # valid
            {**VALID_QUESTION, "id": "x", "subject": "art"},  # invalid subject
            {**VALID_QUESTION, "id": "m3"},                # valid
            "not a dict",                                  # invalid type
        ]
        good, errs = validate_questions_subset({"questions": items})
        assert len(good) == 2
        assert good[0].id in {"m1", "m3"}
        assert any("subject" in e for e in errs)
        assert any("must be an object" in e for e in errs)

    def test_missing_questions_returns_empty(self) -> None:
        good, errs = validate_questions_subset({})
        assert good == []


class TestSchemaInPrompt:
    def test_schema_section_appended_to_baseline_prompt(self) -> None:
        sys, user = build_baseline_generation_prompt(
            {
                "communicationMode": "verbal",
                "functioningLevel": "STANDARD",
                "diagnoses": [],
                "responses": {},
            }
        )
        # Sprint 2 — schema must appear in the user prompt so the LLM
        # sees the strict contract right before generating.
        assert "Output Schema (STRICT)" in user
        assert "math|ela|science|speech|sel|life_skills|executive_function" in user
        assert "correctAnswer MUST be one of the values in options[].value" in user

    def test_schema_constant_matches_render(self) -> None:
        # Spot-check the JSON schema constant covers the required fields.
        props = BASELINE_OUTPUT_JSON_SCHEMA["properties"]["questions"]["items"]["properties"]
        for required in ("id", "subject", "questionText", "options", "correctAnswer"):
            assert required in props
        assert render_schema_prompt_section().strip().startswith("## Output Schema")

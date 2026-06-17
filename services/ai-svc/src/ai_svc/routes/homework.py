"""Homework adaptation and OCR routes."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..vision.ocr_processor import process_ocr
from ..vision.homework_adapter import adapt_homework
from ..services.llm_gateway import generate_completion
from ..services.prompt_builder import (
    build_tutor_system_prompt,
    _build_language_directive,
    _effective_locale,
)
from ..services.responsible_ai_client import evaluate as evaluate_responsible_ai

logger = logging.getLogger("ai-svc.homework")

router = APIRouter(prefix="/api/ai/homework", tags=["homework"])


class OCRRequest(BaseModel):
    image_base64: str | None = None
    text_input: str | None = None
    mime_type: str = "image/jpeg"


class AdaptRequest(BaseModel):
    extracted_problems: list[dict[str, Any]] = Field(default_factory=list)
    brain_context: dict[str, Any] = Field(default_factory=dict)
    subject: str = "math"


class HomeworkChatRequest(BaseModel):
    tutor_sku: str
    learner_id: str
    functioning_level: str = "STANDARD"
    brain_context: dict[str, Any] = Field(default_factory=dict)
    homework_context: dict[str, Any] = Field(default_factory=dict)
    messages: list[dict[str, str]] = Field(default_factory=list)
    max_tokens: int = 1500
    locale: str | None = None


_HOMEWORK_AGENT_SYSTEM_PROMPT = """You are the AIVO Homework Helper — a patient, encouraging AI tutor that helps students work through their homework.

## Core Principles
1. NEVER give direct answers. Use Socratic questioning to guide the student.
2. Break complex problems into smaller, manageable steps.
3. Celebrate effort and progress, not just correct answers.
4. If the student is stuck after 2-3 hints, provide a worked example for a SIMILAR problem, then return to the original.
5. Track which problems the student has attempted and completed.

## Interaction Style
- Start by acknowledging the specific problem the student is working on
- Ask guiding questions ("What do you think the first step would be?")
- Provide visual scaffolding when helpful (use simple text diagrams, number lines, etc.)
- Give specific, encouraging feedback ("Great thinking! You identified the right operation.")
- If the student gets frustrated, offer a break or switch to an easier problem first

## Functioning Level Adaptations
- STANDARD: Full Socratic dialogue, multi-step reasoning, age-appropriate language
- SUPPORTED: Shorter questions, more concrete examples, frequent check-ins
- LOW_VERBAL: Very short responses (1-2 sentences), picture references, yes/no questions when possible
- NON_VERBAL: Guide the parent/caregiver through helping the child with real objects
- PRE_SYMBOLIC: Guide the parent through sensory-based learning activities related to the concept

{tutor_context}

## Current Homework
{homework_summary}
"""


@router.post("/ocr")
async def homework_ocr(body: OCRRequest):
    if not body.image_base64 and not body.text_input:
        raise HTTPException(status_code=400, detail="Either image_base64 or text_input is required")

    try:
        result = await process_ocr(
            image_base64=body.image_base64,
            text_input=body.text_input,
            mime_type=body.mime_type,
        )
        return result.to_dict()
    except Exception as e:
        logger.error(f"OCR failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@router.post("/adapt")
async def adapt_homework_route(body: AdaptRequest):
    if not body.extracted_problems:
        raise HTTPException(status_code=400, detail="extracted_problems is required")

    try:
        result = await adapt_homework(
            extracted_problems=body.extracted_problems,
            brain_context=body.brain_context,
            subject=body.subject,
        )
        return result.to_dict()
    except Exception as e:
        logger.error(f"Adaptation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Homework adaptation failed: {str(e)}")


@router.post("/chat")
async def homework_chat(body: HomeworkChatRequest):
    tutor_system = build_tutor_system_prompt(
        tutor_sku=body.tutor_sku,
        brain_context=body.brain_context,
        functioning_level=body.functioning_level,
        locale=body.locale,
    )

    homework_summary = ""
    if body.homework_context:
        problems = body.homework_context.get("adapted_problems", [])
        if problems:
            homework_summary = "Problems being worked on:\n"
            for p in problems[:10]:
                num = p.get("problem_number", "?")
                text = p.get("adapted", p.get("original", ""))
                homework_summary += f"- Problem {num}: {text[:200]}\n"

    system_prompt = _HOMEWORK_AGENT_SYSTEM_PROMPT.format(
        tutor_context=f"You are acting as the homework helper with the persona context:\n{tutor_system[:500]}",
        homework_summary=homework_summary or "No specific homework loaded yet.",
    )

    # Re-append the language directive AFTER the homework wrapper so the
    # final instruction the model sees is "respond in {language}". The
    # wrapper above is hard-coded English and would otherwise pull the
    # response back to English even when the persona block asked for Spanish.
    # An explicit (valid) locale wins; otherwise fall back to the learner's
    # stored instruction language so the helper matches their enrolled language.
    resolved_locale = _effective_locale(body.locale, body.brain_context)
    system_prompt += "\n" + _build_language_directive(resolved_locale)

    try:
        result = await generate_completion(
            system_prompt=system_prompt,
            user_prompt=body.messages[-1]["content"] if body.messages else "I need help with my homework!",
            max_tokens=body.max_tokens,
            temperature=0.7,
        )

        # Sprint 10: responsible-AI evaluation for homework output. Catches
        # final_answer_before_attempt and other homework-integrity violations.
        rai_result = await evaluate_responsible_ai(
            learner_id=str(body.brain_context.get("learner_id") or ""),
            context_type="homework",
            input_summary=body.messages[-1]["content"] if body.messages else "",
            output=result["content"],
            learner_profile_summary={
                "functioningLevel": body.functioning_level,
                "accommodations": body.brain_context.get("active_accommodations") or [],
            },
            policy_mode="warn",
        )
        if rai_result and not rai_result.get("allowed", True):
            logger.warning(
                "responsible-AI flagged homework response: severity=%s",
                rai_result.get("severity"),
            )

        return {
            "response": result["content"],
            "model": result["model"],
            "prompt_tokens": result["prompt_tokens"],
            "completion_tokens": result["completion_tokens"],
        }
    except Exception as e:
        logger.error(f"Homework chat failed: {e}")
        raise HTTPException(status_code=503, detail=f"Homework chat failed: {str(e)}")

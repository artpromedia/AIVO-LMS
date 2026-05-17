"""Curriculum upload parsing route.

Takes raw text or an image (e.g. weekly syllabus, lesson outline) and
returns a structured "focus" object the tutor can align around.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

_INTERNAL_TOKEN = os.environ.get("INTERNAL_AI_TOKEN") or (
    "dev-tutor-svc-internal"
    if os.environ.get("NODE_ENV", "development") != "production"
    else None
)
if _INTERNAL_TOKEN is None:
    raise RuntimeError(
        "INTERNAL_AI_TOKEN must be set in production (shared with tutor-svc)."
    )

from ..services.llm_gateway import generate_completion
from ..vision.ocr_processor import process_ocr

logger = logging.getLogger("ai-svc.curriculum")

router = APIRouter(prefix="/api/ai/curriculum", tags=["curriculum"])


_PARSE_SYSTEM_PROMPT = """You are an expert curriculum analyst. Read the provided
syllabus, lesson plan, weekly outline, or homework packet and extract a
structured "focus" so an AI tutor can align its sessions to what the learner is
studying right now.

Return ONLY a JSON object (no markdown fences) with this exact shape:
{
  "title": "short human title for this focus, e.g. 'Week of Apr 22 - Fractions Intro'",
  "subject": "math|ela|science|history|coding|speech|sel|art|other",
  "weekStart": "YYYY-MM-DD or null",
  "weekEnd": "YYYY-MM-DD or null",
  "topics": ["3-8 specific topic strings"],
  "keywords": ["concrete vocabulary the tutor should reference"],
  "standards": ["any standard codes mentioned, e.g. 3.NF.A.1"],
  "skills": ["measurable skills the learner should practice"],
  "summary": "1-3 sentence plain-English description of the week",
  "confidence": 0.0
}

Rules:
- Use null for fields you genuinely cannot infer.
- Pick a single best subject for the whole document.
- Keep topics CONCRETE (e.g. "comparing fractions with same denominator"
  rather than "fractions").
- Confidence is 0.0-1.0; lower it if the document is ambiguous or sparse.
- Do not invent standard codes that are not present in the source text.
- If the document has no time information, both weekStart and weekEnd are null.
"""


class ParseRequest(BaseModel):
    text: str | None = None
    image_base64: str | None = None
    mime_type: str = "image/jpeg"
    hinted_subject: str | None = None
    hinted_week_start: str | None = None
    hinted_week_end: str | None = None
    max_tokens: int = Field(default=1500, ge=200, le=4000)


class ParseResponse(BaseModel):
    title: str | None = None
    subject: str = "other"
    weekStart: str | None = None
    weekEnd: str | None = None
    topics: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    standards: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    summary: str = ""
    confidence: float = 0.0
    raw_text: str = ""
    model: str = ""


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("\n", 1)
        raw = parts[1] if len(parts) > 1 else raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    return raw.strip()


def _coerce_str_list(v: Any, limit: int = 20) -> list[str]:
    if not isinstance(v, list):
        return []
    out: list[str] = []
    for item in v:
        if isinstance(item, str):
            s = item.strip()
            if s:
                out.append(s[:200])
        if len(out) >= limit:
            break
    return out


@router.post("/parse", response_model=ParseResponse)
async def parse_curriculum(
    req: ParseRequest,
    x_internal_auth: str | None = Header(default=None, alias="X-Internal-Auth"),
):
    # This endpoint is reachable through the public /api/ai/* rewrite, but it
    # is only meant to be called by tutor-svc. Require an internal shared
    # token so it cannot be used as a free LLM/OCR amplifier.
    if x_internal_auth != _INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not req.text and not req.image_base64:
        raise HTTPException(status_code=400, detail="Either text or image_base64 is required")

    raw_text = (req.text or "").strip()
    if req.image_base64 and not raw_text:
        try:
            doc = await process_ocr(
                image_base64=req.image_base64,
                mime_type=req.mime_type or "image/jpeg",
            )
            raw_text = doc.raw_text or doc.handwritten_text or ""
            if not raw_text and doc.problems:
                raw_text = "\n".join(p.problem_text for p in doc.problems if p.problem_text)
        except Exception as e:
            logger.error(f"Curriculum OCR failed: {e}")
            raise HTTPException(status_code=502, detail="Failed to extract text from uploaded image")

    raw_text = raw_text[:16000]
    if len(raw_text) < 20:
        raise HTTPException(
            status_code=400,
            detail="Not enough readable content found to parse a curriculum focus",
        )

    hint_lines: list[str] = []
    if req.hinted_subject:
        hint_lines.append(f"Likely subject: {req.hinted_subject}")
    if req.hinted_week_start:
        hint_lines.append(f"Hinted weekStart: {req.hinted_week_start}")
    if req.hinted_week_end:
        hint_lines.append(f"Hinted weekEnd: {req.hinted_week_end}")
    hint_block = ("\n".join(hint_lines) + "\n\n") if hint_lines else ""

    user_prompt = f"{hint_block}Curriculum source text:\n\n{raw_text}"

    try:
        result = await generate_completion(
            system_prompt=_PARSE_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=req.max_tokens,
            temperature=0.2,
        )
    except Exception as e:
        logger.error(f"Curriculum parse LLM error: {e}")
        raise HTTPException(status_code=503, detail="AI service unavailable for curriculum parsing")

    try:
        parsed = json.loads(_strip_fences(result["content"]))
    except json.JSONDecodeError:
        logger.error(f"Curriculum parse JSON error: {result['content'][:300]}")
        raise HTTPException(status_code=502, detail="AI returned invalid JSON for curriculum parse")

    subject = (parsed.get("subject") or req.hinted_subject or "other").lower().strip()
    valid_subjects = {"math", "ela", "science", "history", "coding", "speech", "sel", "art", "other"}
    if subject not in valid_subjects:
        subject = "other"

    confidence_raw = parsed.get("confidence", 0.0)
    try:
        confidence = max(0.0, min(1.0, float(confidence_raw)))
    except (TypeError, ValueError):
        confidence = 0.0

    return ParseResponse(
        title=(parsed.get("title") or "")[:255] or None,
        subject=subject,
        weekStart=parsed.get("weekStart") or req.hinted_week_start,
        weekEnd=parsed.get("weekEnd") or req.hinted_week_end,
        topics=_coerce_str_list(parsed.get("topics"), limit=12),
        keywords=_coerce_str_list(parsed.get("keywords"), limit=20),
        standards=_coerce_str_list(parsed.get("standards"), limit=20),
        skills=_coerce_str_list(parsed.get("skills"), limit=12),
        summary=(parsed.get("summary") or "")[:1000],
        confidence=confidence,
        raw_text=raw_text,
        model=result.get("model", ""),
    )

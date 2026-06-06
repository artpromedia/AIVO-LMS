"""
Whole-term / trimester syllabus parsing route (Sprint 6).

``POST /api/ai/curriculum/parse-term`` takes the extracted text of a
full-term syllabus (per subject) and returns an ordered scope-&-sequence
the brain-svc pacing engine consumes. Unlike the weekly parser this does
not truncate: large documents are chunked on unit boundaries.
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from ..services.term_syllabus_parser import parse_term_syllabus

logger = logging.getLogger("ai-svc.term_syllabus")

_INTERNAL_TOKEN = os.environ.get("INTERNAL_AI_TOKEN") or (
    "dev-tutor-svc-internal"
    if os.environ.get("NODE_ENV", "development") != "production"
    else None
)
if _INTERNAL_TOKEN is None:
    raise RuntimeError("INTERNAL_AI_TOKEN must be set in production (shared with tutor-svc).")

router = APIRouter(prefix="/api/ai/curriculum", tags=["curriculum"])


class ParseTermRequest(BaseModel):
    text: str = Field(..., min_length=1)
    subject: str | None = Field(default=None, max_length=64)
    term_count: int = Field(default=1, ge=1, le=4)
    use_llm: bool = True


class TermUnit(BaseModel):
    title: str
    duration_weeks: int = 1
    topics: list[str] = []
    learning_objectives: list[str] = []
    standards_addressed: list[str] = []
    key_vocabulary: list[str] = []


class TermBlock(BaseModel):
    term_number: int
    title: str | None = None
    units: list[TermUnit] = []


class ParseTermResponse(BaseModel):
    subject: str | None = None
    source: str = "uploaded_term_syllabus"
    total_terms: int = 0
    unit_count: int = 0
    terms: list[TermBlock] = []


@router.post("/parse-term", response_model=ParseTermResponse)
async def parse_term(
    request: ParseTermRequest,
    x_internal_auth: str | None = Header(default=None, alias="X-Internal-Auth"),
) -> ParseTermResponse:
    if x_internal_auth != _INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

    scope = await parse_term_syllabus(
        request.text,
        subject=request.subject,
        term_count=request.term_count,
        use_llm=request.use_llm,
    )
    terms = scope.get("terms", [])
    unit_count = sum(len(t.get("units", [])) for t in terms)
    if unit_count == 0:
        raise HTTPException(status_code=422, detail="No week/unit content found in the document")
    return ParseTermResponse(
        subject=scope.get("subject"),
        source=scope.get("source", "uploaded_term_syllabus"),
        total_terms=scope.get("total_terms", len(terms)),
        unit_count=unit_count,
        terms=terms,
    )

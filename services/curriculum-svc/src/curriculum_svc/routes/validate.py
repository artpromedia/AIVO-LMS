"""
Syllabus ↔ jurisdiction validation endpoint (Sprint 7, G8).

``POST /api/curriculum/validate`` checks an uploaded syllabus's topics and
standards against the learner's jurisdiction-approved packs and returns
``matched`` / ``unmatched`` / ``suggestions``. Off-curriculum items are
flagged for review — never silently accepted.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from curriculum_svc.auth import Principal, require_service_or_user
from curriculum_svc.catalogue import get_catalogue
from curriculum_svc.routes.jurisdictions import resolve_jurisdiction_or_http
from curriculum_svc.validation import validate_topics_and_standards

router = APIRouter()


class ValidateRequest(BaseModel):
    # Jurisdiction locator (US zip/district or country+region).
    country: str | None = Field(default=None, max_length=8)
    region: str | None = Field(default=None, max_length=64)
    postalCode: str | None = Field(default=None, max_length=12)
    districtId: str | None = Field(default=None, max_length=128)
    zipCode: str | None = Field(default=None, max_length=10)
    subject: str = Field(..., min_length=1, max_length=64)
    gradeBand: str = Field(..., min_length=1, max_length=32)
    topics: list[str] = Field(default_factory=list)
    standards: list[str] = Field(default_factory=list)


class MatchedOut(BaseModel):
    kind: str
    input: str
    skillId: str


class UnmatchedOut(BaseModel):
    kind: str
    input: str
    reason: str


class SuggestionOut(BaseModel):
    input: str
    candidates: list[str]


class ValidateResponse(BaseModel):
    jurisdictionDistrictId: str
    frameworkCode: str
    matched: list[MatchedOut]
    unmatched: list[UnmatchedOut]
    suggestions: list[SuggestionOut]
    offCurriculumCount: int


@router.post("/validate", response_model=ValidateResponse)
def validate_syllabus(
    request: ValidateRequest,
    _auth: Principal = Depends(require_service_or_user),
) -> ValidateResponse:
    if not request.topics and not request.standards:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of `topics` or `standards` to validate.",
        )

    # Resolve the jurisdiction. Backward compatible with US callers that
    # pass only a zipCode/districtId (no country) — that implies US.
    postal = request.postalCode or request.zipCode
    effective_country = request.country
    if not effective_country:
        if postal or request.districtId:
            effective_country = "US"
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide `country` (with region/postalCode) or a US `zipCode`.",
            )
    resolved = resolve_jurisdiction_or_http(
        effective_country, request.region, postal, request.districtId
    )

    cat = get_catalogue()
    approved_skills = cat.list_skills(
        subject=request.subject,
        grade_band=request.gradeBand,
        district_id=resolved.district_id,
    )

    result = validate_topics_and_standards(approved_skills, request.topics, request.standards)

    return ValidateResponse(
        jurisdictionDistrictId=resolved.district_id,
        frameworkCode=resolved.framework_code,
        matched=[MatchedOut(kind=m.kind, input=m.input, skillId=m.skillId) for m in result.matched],
        unmatched=[
            UnmatchedOut(kind=u.kind, input=u.input, reason=u.reason) for u in result.unmatched
        ],
        suggestions=[
            SuggestionOut(input=s.input, candidates=list(s.candidates)) for s in result.suggestions
        ],
        offCurriculumCount=len(result.unmatched),
    )

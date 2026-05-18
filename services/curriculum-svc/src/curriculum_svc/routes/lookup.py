"""
Curriculum lookup endpoints.

These are deliberately read-only and side-effect-free — the service is
the canonical replacement for ad-hoc LLM-synthesized curriculum, and any
caller (brain-svc, tutor-svc, admin UI) should be able to memoize the
responses indefinitely.

Learner-serving calls must include the ZIP code captured during
enrollment. The service resolves ZIP → district and filters curriculum
packs so learners receive only district-authorized curriculum.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from curriculum_svc.auth import require_service_or_user
from curriculum_svc.catalogue import District, Skill, get_catalogue


router = APIRouter()


class SkillOut(BaseModel):
    id: str
    subject: str
    gradeBand: str
    label: str
    summary: str
    prerequisites: list[str]

    @classmethod
    def from_skill(cls, s: Skill) -> "SkillOut":
        return cls(
            id=s.id,
            subject=s.subject,
            gradeBand=s.grade_band,
            label=s.label,
            summary=s.summary,
            prerequisites=list(s.prerequisites),
        )


class DistrictOut(BaseModel):
    id: str
    name: str
    state: str
    zipCodes: list[str]

    @classmethod
    def from_district(cls, d: District) -> "DistrictOut":
        return cls(id=d.id, name=d.name, state=d.state, zipCodes=list(d.zip_codes))


class ContentPackOut(BaseModel):
    id: str
    title: str
    subject: str
    gradeBand: str
    skillIds: list[str]
    districtIds: list[str]


class LookupResponse(BaseModel):
    district: DistrictOut | None = None
    skills: list[SkillOut]
    contentPacks: list[ContentPackOut]


class DistrictResolveResponse(BaseModel):
    zipCode: str
    district: DistrictOut


def _resolve_district_from_zip(zip_code: str) -> tuple[str, District]:
    cat = get_catalogue()
    try:
        normalized = cat.normalize_zip_code(zip_code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    district = cat.resolve_district_by_zip(normalized)
    if district is None:
        raise HTTPException(status_code=404, detail=f"No district curriculum mapping found for ZIP code {normalized}.")
    return normalized, district


@router.get("/districts/resolve", response_model=DistrictResolveResponse)
def resolve_district(
    zipCode: str = Query(..., min_length=5, max_length=10),
    _auth: str = Depends(require_service_or_user),
) -> DistrictResolveResponse:
    """Resolve the learner's enrollment ZIP code to the district whose
    curriculum should be served.
    """
    normalized, district = _resolve_district_from_zip(zipCode)
    return DistrictResolveResponse(zipCode=normalized, district=DistrictOut.from_district(district))


@router.get("/lookup", response_model=LookupResponse)
def lookup(
    subject: str | None = Query(default=None, max_length=64),
    gradeBand: str | None = Query(default=None, max_length=8),
    skillId: str | None = Query(default=None, max_length=128),
    zipCode: str = Query(..., min_length=5, max_length=10),
    _auth: str = Depends(require_service_or_user),
) -> LookupResponse:
    """Lookup over the district-scoped catalogue.

    `zipCode` is required and must come from enrollment. The service
    resolves it to a district, then returns only curriculum packs and
    skills available to that district. This prevents the baseline,
    lesson, and tutor flows from serving generic or wrong-district
    curriculum to a learner.

    `skillId` returns one specific skill node plus its immediate
    prerequisites only when that skill is available in the learner's
    district curriculum.
    """
    if not subject and not gradeBand and not skillId:
        raise HTTPException(
            status_code=400,
            detail="At least one of `subject`, `gradeBand`, or `skillId` must be provided.",
        )

    cat = get_catalogue()
    _, district = _resolve_district_from_zip(zipCode)

    if skillId:
        target = cat.get_skill(skillId)
        if not target:
            raise HTTPException(status_code=404, detail=f"Unknown skillId: {skillId}")
        if not cat.skill_is_available_to_district(skillId, district.id):
            raise HTTPException(
                status_code=403,
                detail=f"Skill {skillId} is not available in district {district.id} curriculum.",
            )
        skills = [SkillOut.from_skill(target)]
        for pre_id in target.prerequisites:
            pre = cat.get_skill(pre_id)
            if pre and cat.skill_is_available_to_district(pre_id, district.id):
                skills.append(SkillOut.from_skill(pre))
        return LookupResponse(district=DistrictOut.from_district(district), skills=skills, contentPacks=[])

    skills = [
        SkillOut.from_skill(s)
        for s in cat.list_skills(subject=subject, grade_band=gradeBand, district_id=district.id)
    ]
    packs = [
        ContentPackOut(
            id=p.id,
            title=p.title,
            subject=p.subject,
            gradeBand=p.grade_band,
            skillIds=list(p.skill_ids),
            districtIds=list(p.district_ids),
        )
        for p in cat.list_packs(subject=subject, grade_band=gradeBand, district_id=district.id)
    ]
    return LookupResponse(district=DistrictOut.from_district(district), skills=skills, contentPacks=packs)


class PrereqPathResponse(BaseModel):
    skillId: str
    district: DistrictOut
    path: list[SkillOut]


@router.get("/skills/{skill_id}/path", response_model=PrereqPathResponse)
def prereq_path(
    skill_id: str,
    zipCode: str = Query(..., min_length=5, max_length=10),
    _auth: str = Depends(require_service_or_user),
) -> PrereqPathResponse:
    """Return the prerequisite chain leading up to a skill, prerequisites
    first, filtered to the learner's district curriculum.
    """
    cat = get_catalogue()
    _, district = _resolve_district_from_zip(zipCode)
    target = cat.get_skill(skill_id)
    if not target:
        raise HTTPException(status_code=404, detail=f"Unknown skill_id: {skill_id}")
    if not cat.skill_is_available_to_district(skill_id, district.id):
        raise HTTPException(
            status_code=403,
            detail=f"Skill {skill_id} is not available in district {district.id} curriculum.",
        )
    path = [SkillOut.from_skill(s) for s in cat.prerequisite_path(skill_id, district_id=district.id)]
    return PrereqPathResponse(skillId=skill_id, district=DistrictOut.from_district(district), path=path)

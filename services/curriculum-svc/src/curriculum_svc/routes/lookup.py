"""
Curriculum lookup endpoints.

These are deliberately read-only and side-effect-free — the service is
the canonical replacement for ad-hoc LLM-synthesized curriculum, and any
caller (brain-svc, tutor-svc, admin UI) should be able to memoize the
responses indefinitely.

Learner-serving calls must identify the learner's jurisdiction: a US
``zipCode``/``districtId`` or a ``country`` (+ optional ``region``) for
non-US learners. The service resolves it to a district and filters
curriculum packs so learners receive only jurisdiction-authorized
curriculum. See ``routes/jurisdictions.py`` for the resolver.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from curriculum_svc.auth import Principal, require_service_or_user
from curriculum_svc.catalogue import District, Skill, get_catalogue
from curriculum_svc.routes.jurisdictions import resolve_jurisdiction_or_http

router = APIRouter()


class SkillOut(BaseModel):
    id: str
    subject: str
    gradeBand: str
    label: str
    summary: str
    prerequisites: list[str]
    source: str = ""

    @classmethod
    def from_skill(cls, s: Skill) -> "SkillOut":
        return cls(
            id=s.id,
            subject=s.subject,
            gradeBand=s.grade_band,
            label=s.label,
            summary=s.summary,
            prerequisites=list(s.prerequisites),
            source=s.source,
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


def _resolve_lookup_district(
    country: str | None,
    region: str | None,
    zip_code: str | None,
    postal_code: str | None,
    district_id: str | None,
) -> District:
    """Resolve the district a lookup should be scoped to.

    Backward compatible: a bare ``zipCode`` (no ``country``) is treated as
    a US lookup, preserving the original ZIP→district behaviour. Supplying
    ``country`` enables NG/AE/GB/… resolution. A recognised-but-unseeded
    country yields a 404, never US content.
    """
    effective_country = country
    postal = postal_code or zip_code  # zipCode remains the US postal field.
    if not effective_country:
        if postal or district_id:
            effective_country = "US"
        else:
            raise HTTPException(
                status_code=400,
                detail="Provide `country` (with optional region/postalCode) or a US `zipCode`.",
            )
    resolved = resolve_jurisdiction_or_http(effective_country, region, postal, district_id)
    district = get_catalogue().get_district(resolved.district_id)
    if district is None:
        # Defensive: the resolver only ever returns seeded district ids.
        raise HTTPException(
            status_code=404,
            detail=f"district {resolved.district_id} not found",
        )
    return district


@router.get("/districts/resolve", response_model=DistrictResolveResponse)
def resolve_district(
    zipCode: str = Query(..., min_length=5, max_length=10),
    _auth: Principal = Depends(require_service_or_user),
) -> DistrictResolveResponse:
    """Resolve the learner's enrollment ZIP code to the district whose
    curriculum should be served. (US ZIP path — see
    ``/jurisdictions/resolve`` for the internationalized resolver.)
    """
    normalized, district = _resolve_district_from_zip(zipCode)
    return DistrictResolveResponse(zipCode=normalized, district=DistrictOut.from_district(district))


@router.get("/lookup", response_model=LookupResponse)
def lookup(
    subject: str | None = Query(default=None, max_length=64),
    gradeBand: str | None = Query(default=None, max_length=16),
    skillId: str | None = Query(default=None, max_length=128),
    zipCode: str | None = Query(default=None, max_length=10),
    country: str | None = Query(default=None, max_length=8),
    region: str | None = Query(default=None, max_length=64),
    postalCode: str | None = Query(default=None, max_length=12),
    districtId: str | None = Query(default=None, max_length=128),
    _auth: Principal = Depends(require_service_or_user),
) -> LookupResponse:
    """Lookup over the jurisdiction-scoped catalogue.

    The learner's jurisdiction must be identifiable: pass either a US
    `zipCode` (or `postalCode`) / `districtId`, or a `country` (with
    optional `region`) for non-US learners. The service resolves it to a
    district and returns only curriculum packs and skills available to
    that district, so the baseline, lesson, and tutor flows never serve
    generic or wrong-jurisdiction curriculum.

    `skillId` returns one specific skill node plus its immediate
    prerequisites only when that skill is available in the learner's
    jurisdiction curriculum.
    """
    if not subject and not gradeBand and not skillId:
        raise HTTPException(
            status_code=400,
            detail="At least one of `subject`, `gradeBand`, or `skillId` must be provided.",
        )

    cat = get_catalogue()
    district = _resolve_lookup_district(country, region, zipCode, postalCode, districtId)

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
    _auth: Principal = Depends(require_service_or_user),
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

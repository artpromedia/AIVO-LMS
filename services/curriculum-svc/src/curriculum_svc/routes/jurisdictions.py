"""
Jurisdiction resolution endpoint.

Resolves ``{country, region?, postalCode?, districtId?}`` to the concrete
district scope and governing framework a learner should receive. This is
the internationalized entry point that lets non-US learners be served
their own curriculum instead of being rejected (gap G3).

A recognised-but-unseeded country returns an explicit 404 — never US/CCSS
content (see ADR 0040).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from curriculum_svc.auth import Principal, require_service_or_user
from curriculum_svc.catalogue import get_catalogue
from curriculum_svc.jurisdiction import (
    JurisdictionNotSeededError,
    MalformedJurisdictionError,
    ResolvedJurisdiction,
    UnknownJurisdictionError,
)

router = APIRouter()


class ResolvedJurisdictionOut(BaseModel):
    country: str
    region: str | None = None
    districtId: str
    districtName: str
    frameworkCode: str
    frameworkName: str
    gradeBandScheme: str

    @classmethod
    def from_resolved(cls, r: ResolvedJurisdiction) -> "ResolvedJurisdictionOut":
        return cls(
            country=r.country,
            region=r.region,
            districtId=r.district_id,
            districtName=r.district_name,
            frameworkCode=r.framework_code,
            frameworkName=r.framework_name,
            gradeBandScheme=r.grade_band_scheme,
        )


def resolve_jurisdiction_or_http(
    country: str | None,
    region: str | None,
    postal_code: str | None,
    district_id: str | None,
) -> ResolvedJurisdiction:
    """Resolve a jurisdiction, translating domain errors into HTTP errors.

    Shared with the lookup route so both surface identical semantics: 400
    for malformed input, 404 for unknown or unseeded jurisdictions.
    """
    try:
        return get_catalogue().resolve_jurisdiction(
            country=country or "",
            region=region,
            district_id=district_id,
            postal_code=postal_code,
        )
    except MalformedJurisdictionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (UnknownJurisdictionError, JurisdictionNotSeededError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/jurisdictions/resolve", response_model=ResolvedJurisdictionOut)
def resolve_jurisdiction(
    country: str = Query(..., min_length=2, max_length=8),
    region: str | None = Query(default=None, max_length=64),
    postalCode: str | None = Query(default=None, max_length=12),
    districtId: str | None = Query(default=None, max_length=128),
    _auth: Principal = Depends(require_service_or_user),
) -> ResolvedJurisdictionOut:
    """Resolve a learner's jurisdiction to its district scope + framework.

    US resolves by ``postalCode`` (ZIP) or ``districtId``; other countries
    resolve by ``country`` (+ optional ``region``).
    """
    resolved = resolve_jurisdiction_or_http(country, region, postalCode, districtId)
    return ResolvedJurisdictionOut.from_resolved(resolved)

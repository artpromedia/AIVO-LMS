"""
Authoring / CMS write path for the curriculum catalogue (Sprint 4).

Lets ADMIN-role callers create/update/delete districts, skills, and content
packs against the mutable store (``store.py``) instead of hand-editing the
JSON snapshot. Writes are validated, RBAC-gated via the Sprint 1 principal,
and audit-logged; an explicit ``/admin/reload`` rebuilds the read model.

Authoring requires a mutable persistence mode (``CURRICULUM_PERSISTENCE=
memory`` or ``postgres``); in the default ``snapshot`` mode the catalogue is
read-only and these routes return 503.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from curriculum_svc.auth import Principal, require_service_or_user
from curriculum_svc.store import get_store, store_enabled

logger = logging.getLogger("curriculum-svc.authoring")

router = APIRouter()

# Roles permitted to mutate the catalogue. Internal service-token callers
# (mode == "service") are trusted platform components and also allowed.
ADMIN_ROLES = {"admin", "district_admin", "school_admin", "superadmin", "engineering"}


def require_admin(principal: Principal = Depends(require_service_or_user)) -> Principal:
    """Authorize a catalogue-mutating caller: an internal service, or a user
    JWT carrying an admin role. Everyone else gets 403."""
    if principal.mode == "service" or principal.role in ADMIN_ROLES:
        return principal
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="admin role required to modify the curriculum catalogue",
    )


def _require_store():
    if not store_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "catalogue authoring is disabled in snapshot mode; "
                "set CURRICULUM_PERSISTENCE=memory or postgres"
            ),
        )
    return get_store()


def _audit(principal: Principal, action: str, kind: str, record_id: str) -> None:
    # Structured audit event for every mutation of catalogue state.
    logger.info(
        "audit curriculum.authoring action=%s kind=%s id=%s actor=%s role=%s tenant=%s",
        action,
        kind,
        record_id,
        principal.sub,
        principal.role,
        principal.tenant_id,
    )


# ── Input models (Pydantic enforces required fields → 422) ─────────────


class DistrictIn(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=256)
    state: str = ""
    country: str = "US"
    region: str | None = None
    zipCodes: list[str] = Field(default_factory=list)


class SkillIn(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    subject: str = Field(min_length=1, max_length=64)
    gradeBand: str = Field(min_length=1, max_length=32)
    label: str = ""
    summary: str = ""
    source: str = ""
    prerequisites: list[str] = Field(default_factory=list)


class PackIn(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=256)
    subject: str = Field(min_length=1, max_length=64)
    gradeBand: str = Field(min_length=1, max_length=32)
    frameworkCode: str = ""
    districtIds: list[str] = Field(default_factory=list)
    skillIds: list[str] = Field(default_factory=list)


class WriteResult(BaseModel):
    status: str
    kind: str
    id: str


def _validate_pack_references(store, pack: PackIn) -> None:
    """Reject a pack that references unknown districts or skills (422)."""
    cat = store.to_catalogue()
    known_skills = {s.id for s in cat.list_skills()}
    known_districts = {d.id for d in cat.list_districts()}
    errors: list[dict] = []
    for sid in pack.skillIds:
        if sid not in known_skills:
            errors.append({"field": "skillIds", "value": sid, "error": "unknown skill id"})
    for did in pack.districtIds:
        if did not in known_districts:
            errors.append({"field": "districtIds", "value": did, "error": "unknown district id"})
    if errors:
        raise HTTPException(status_code=422, detail=errors)


# ── Districts ─────────────────────────────────────────────────────────


@router.put("/admin/districts/{district_id}", response_model=WriteResult)
@router.post("/admin/districts", response_model=WriteResult, status_code=201)
def upsert_district(
    body: DistrictIn,
    district_id: str | None = None,
    principal: Principal = Depends(require_admin),
) -> WriteResult:
    store = _require_store()
    if district_id is not None and district_id != body.id:
        raise HTTPException(status_code=422, detail="path id and body id must match")
    store.upsert("districts", body.model_dump())
    _audit(principal, "upsert", "district", body.id)
    return WriteResult(status="ok", kind="district", id=body.id)


@router.delete("/admin/districts/{district_id}", response_model=WriteResult)
def delete_district(
    district_id: str, principal: Principal = Depends(require_admin)
) -> WriteResult:
    store = _require_store()
    if not store.delete("districts", district_id):
        raise HTTPException(status_code=404, detail=f"district {district_id} not found")
    _audit(principal, "delete", "district", district_id)
    return WriteResult(status="deleted", kind="district", id=district_id)


# ── Skills ────────────────────────────────────────────────────────────


@router.put("/admin/skills/{skill_id}", response_model=WriteResult)
@router.post("/admin/skills", response_model=WriteResult, status_code=201)
def upsert_skill(
    body: SkillIn,
    skill_id: str | None = None,
    principal: Principal = Depends(require_admin),
) -> WriteResult:
    store = _require_store()
    if skill_id is not None and skill_id != body.id:
        raise HTTPException(status_code=422, detail="path id and body id must match")
    store.upsert("skills", body.model_dump())
    _audit(principal, "upsert", "skill", body.id)
    return WriteResult(status="ok", kind="skill", id=body.id)


@router.delete("/admin/skills/{skill_id}", response_model=WriteResult)
def delete_skill(skill_id: str, principal: Principal = Depends(require_admin)) -> WriteResult:
    store = _require_store()
    if not store.delete("skills", skill_id):
        raise HTTPException(status_code=404, detail=f"skill {skill_id} not found")
    _audit(principal, "delete", "skill", skill_id)
    return WriteResult(status="deleted", kind="skill", id=skill_id)


# ── Content packs ─────────────────────────────────────────────────────


@router.put("/admin/packs/{pack_id}", response_model=WriteResult)
@router.post("/admin/packs", response_model=WriteResult, status_code=201)
def upsert_pack(
    body: PackIn,
    pack_id: str | None = None,
    principal: Principal = Depends(require_admin),
) -> WriteResult:
    store = _require_store()
    if pack_id is not None and pack_id != body.id:
        raise HTTPException(status_code=422, detail="path id and body id must match")
    _validate_pack_references(store, body)
    store.upsert("contentPacks", body.model_dump())
    _audit(principal, "upsert", "pack", body.id)
    return WriteResult(status="ok", kind="pack", id=body.id)


@router.delete("/admin/packs/{pack_id}", response_model=WriteResult)
def delete_pack(pack_id: str, principal: Principal = Depends(require_admin)) -> WriteResult:
    store = _require_store()
    if not store.delete("contentPacks", pack_id):
        raise HTTPException(status_code=404, detail=f"pack {pack_id} not found")
    _audit(principal, "delete", "pack", pack_id)
    return WriteResult(status="deleted", kind="pack", id=pack_id)


# ── Reload ────────────────────────────────────────────────────────────


class ReloadResult(BaseModel):
    status: str
    districts: int
    skills: int
    contentPacks: int


@router.post("/admin/reload", response_model=ReloadResult)
def reload_catalogue(principal: Principal = Depends(require_admin)) -> ReloadResult:
    """Rebuild the read model from the backing store (or bundled snapshot)."""
    store = _require_store()
    store.reload()
    cat = store.to_catalogue()
    _audit(principal, "reload", "catalogue", "*")
    return ReloadResult(
        status="reloaded",
        districts=len(cat.list_districts()),
        skills=len(cat.list_skills()),
        contentPacks=len(cat.list_packs()),
    )

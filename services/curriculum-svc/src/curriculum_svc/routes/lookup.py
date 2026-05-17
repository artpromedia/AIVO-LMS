"""
Curriculum lookup endpoints.

These are deliberately read-only and side-effect-free — the service is
the canonical replacement for ad-hoc LLM-synthesized curriculum, and any
caller (brain-svc, tutor-svc, admin UI) should be able to memoize the
responses indefinitely.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from curriculum_svc.catalogue import Skill, get_catalogue


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


class ContentPackOut(BaseModel):
    id: str
    title: str
    subject: str
    gradeBand: str
    skillIds: list[str]


class LookupResponse(BaseModel):
    skills: list[SkillOut]
    contentPacks: list[ContentPackOut]


@router.get("/lookup", response_model=LookupResponse)
def lookup(
    subject: str | None = Query(default=None, max_length=64),
    gradeBand: str | None = Query(default=None, max_length=8),
    skillId: str | None = Query(default=None, max_length=128),
) -> LookupResponse:
    """Lookup over the catalogue.

    At least one filter must be supplied. Filters compose: e.g.
    `subject=math&gradeBand=K` returns every K-math skill.

    `skillId` returns one specific skill node plus its immediate
    prerequisites — useful for the admin UI's skill-detail panel.
    """
    if not subject and not gradeBand and not skillId:
        raise HTTPException(
            status_code=400,
            detail="At least one of `subject`, `gradeBand`, or `skillId` must be provided.",
        )

    cat = get_catalogue()

    if skillId:
        target = cat.get_skill(skillId)
        if not target:
            raise HTTPException(status_code=404, detail=f"Unknown skillId: {skillId}")
        skills = [SkillOut.from_skill(target)]
        for pre_id in target.prerequisites:
            pre = cat.get_skill(pre_id)
            if pre:
                skills.append(SkillOut.from_skill(pre))
        return LookupResponse(skills=skills, contentPacks=[])

    skills = [SkillOut.from_skill(s) for s in cat.list_skills(subject=subject, grade_band=gradeBand)]
    packs = [
        ContentPackOut(
            id=p.id,
            title=p.title,
            subject=p.subject,
            gradeBand=p.grade_band,
            skillIds=list(p.skill_ids),
        )
        for p in cat.list_packs(subject=subject, grade_band=gradeBand)
    ]
    return LookupResponse(skills=skills, contentPacks=packs)


class PrereqPathResponse(BaseModel):
    skillId: str
    path: list[SkillOut]


@router.get("/skills/{skill_id}/path", response_model=PrereqPathResponse)
def prereq_path(skill_id: str) -> PrereqPathResponse:
    """Return the prerequisite chain leading up to a skill, prerequisites
    first. Returns an empty list when the skill has no prerequisites."""
    cat = get_catalogue()
    target = cat.get_skill(skill_id)
    if not target:
        raise HTTPException(status_code=404, detail=f"Unknown skill_id: {skill_id}")
    path = [SkillOut.from_skill(s) for s in cat.prerequisite_path(skill_id)]
    return PrereqPathResponse(skillId=skill_id, path=path)

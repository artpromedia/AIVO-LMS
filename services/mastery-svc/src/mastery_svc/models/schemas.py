"""Request/response contracts for mastery-svc. Stable across BKT → DKT."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ObserveRequest(BaseModel):
    learner_id: str
    tenant_id: str | None = None
    skill_id: str
    subject: str | None = None
    correct: bool
    difficulty: str | None = None
    latency_ms: int | None = None
    source: str | None = None
    # Idempotency key: replaying the same event id is a no-op (the model never
    # double-counts a graded answer that was retried by an at-least-once sender).
    event_id: str | None = None


class SkillMastery(BaseModel):
    skill_id: str
    subject: str | None = None
    p: float = Field(description="P(skill mastered), 0..1")
    theta: float = Field(description="logit(p) — feeds deliveryLevelFromTheta")
    trend: str = Field(description="rising | stable | declining")
    n_obs: int
    model_version: str


class ObserveResponse(BaseModel):
    applied: bool
    duplicate: bool = False
    mastery: SkillMastery | None = None


class NextSkill(BaseModel):
    skill_id: str
    rationale: str


class DifficultyTarget(BaseModel):
    skill_id: str
    delivery_level: str
    theta: float
    target_difficulty: str

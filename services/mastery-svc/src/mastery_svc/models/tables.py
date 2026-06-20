"""
SQLAlchemy models for mastery-svc's own tables.

Portable column types (String/Float/Integer/Boolean/JSON/DateTime) so the same
models run on Postgres in production and on in-memory SQLite in unit tests. In the
platform DB the tables are created by the Drizzle migration
``packages/db/drizzle/0123_learner_skill_mastery.sql`` (the monorepo's source of
truth); ``Base.metadata.create_all(checkfirst=True)`` is therefore a no-op there and
only does real work for standalone/test runs.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, Integer, String, UniqueConstraint

from mastery_svc.models.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class LearnerSkillMastery(Base):
    """Current per-(learner, skill) mastery state — the model's system of record."""

    __tablename__ = "learner_skill_mastery"

    id = Column(String, primary_key=True, default=_uuid)
    learner_id = Column(String, nullable=False, index=True)
    # Nullable uuid in Postgres — callers pass the real tenant; never coerce "" into a uuid column.
    tenant_id = Column(String, nullable=True)
    skill_id = Column(String, nullable=False)
    subject = Column(String, nullable=False, default="DEFAULT")
    p_mastery = Column(Float, nullable=False, default=0.0)
    theta = Column(Float, nullable=False, default=0.0)
    p_init = Column(Float, nullable=False, default=0.0)
    n_obs = Column(Integer, nullable=False, default=0)
    last_trend = Column(String, nullable=False, default="stable")
    recent_p = Column(JSON, nullable=False, default=list)
    model_version = Column(String, nullable=False, default="bkt-v1")
    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (UniqueConstraint("learner_id", "skill_id", name="uq_learner_skill_mastery"),)


class MasteryObservation(Base):
    """Append-only graded-answer log — idempotency key + future DKT training data."""

    __tablename__ = "mastery_observations"

    id = Column(String, primary_key=True, default=_uuid)
    learner_id = Column(String, nullable=False, index=True)
    tenant_id = Column(String, nullable=True)
    skill_id = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    correct = Column(Boolean, nullable=False)
    difficulty = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    source = Column(String, nullable=True)
    event_id = Column(String, nullable=True, unique=True)
    model_version = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)

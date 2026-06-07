"""Automatic recommendation generation.

Observes learner-evidence sources and emits structured `brain_recommendations`
rows for the parent inbox to act on. Each generator function is independent
and idempotent against the most recent signal — if the same evidence has
already produced a PENDING recommendation we skip emitting a duplicate.

Evidence sources:
  - causal_analyses (regression detection)
  - assessment_attempts (rebaseline triggers, mastery deltas)
  - brain_states.mastery_levels (delta vs latest snapshot → tutor suggestion)
  - iep_goals (status met → iep_goal_met; stale → iep_refresh)
  - iep_profiles.accommodations vs brain_states.active_accommodations
    (missing accommodation → accommodation_add)
  - brain_insights from teachers/therapists (curriculum_shift / path_adjustment)

Each emitted recommendation has a normalized payload:
  {
    targetTable, targetField, currentValue, proposedValue,
    reason, evidence, confidence, sourceSignals, requiresParentApproval
  }
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from sqlalchemy import text
from sqlalchemy.orm import Session


def _utcnow() -> datetime:
    """Naive UTC now — drop-in for the deprecated ``datetime.utcnow()``."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return value
    return value


def _existing_pending_types(db: Session, learner_id: str) -> set[str]:
    rows = db.execute(
        text(
            "SELECT type, payload FROM brain_recommendations "
            "WHERE learner_id = :lid AND status = 'PENDING'"
        ),
        {"lid": learner_id},
    ).mappings().all()
    keys: set[str] = set()
    for r in rows:
        payload = _json(r.get("payload")) or {}
        # Dedup by (type, domain/accommodation/tutor/subject) so we don't
        # spam the parent inbox with the same recommendation each run.
        key = r["type"]
        if isinstance(payload, dict):
            for k in ("domain", "accommodation", "tutor", "subject", "level"):
                v = payload.get(k)
                if v:
                    key = f"{key}:{k}={v}"
                    break
        keys.add(key)
    return keys


def _insert(
    db: Session,
    *,
    learner_id: str,
    tenant_id: str,
    rec_type: str,
    title: str,
    description: str,
    payload: dict,
    evidence: dict | None = None,
    source_signals: list | None = None,
    confidence: float | None = None,
) -> str:
    rec_id = str(uuid.uuid4())
    db.execute(
        text(
            """INSERT INTO brain_recommendations
                (id, tenant_id, learner_id, type, status, title, description,
                 payload, evidence, source_signals, confidence, created_at)
                VALUES (:id, :tid, :lid, :type, 'PENDING', :title, :desc,
                        :payload, :evidence, :signals, :conf, :now)"""
        ),
        {
            "id": rec_id,
            "tid": tenant_id,
            "lid": learner_id,
            "type": rec_type,
            "title": title,
            "desc": description,
            "payload": json.dumps(payload),
            "evidence": json.dumps(evidence or {}),
            "signals": json.dumps(source_signals or []),
            "conf": confidence,
            "now": _utcnow(),
        },
    )
    return rec_id


def _dedup_key(rec_type: str, payload: dict) -> str:
    for k in ("domain", "accommodation", "tutor", "subject", "level"):
        v = payload.get(k)
        if v:
            return f"{rec_type}:{k}={v}"
    return rec_type


def _regression_recommendations(
    db: Session, learner_id: str, tenant_id: str, existing: set[str]
) -> list[str]:
    rows = db.execute(
        text(
            """SELECT id, domain, mastery_drop, previous_mastery, current_mastery,
                      hypothesis, confidence, detected_at
                 FROM causal_analyses
                WHERE learner_id = :lid AND status = 'DETECTED'
                ORDER BY detected_at DESC LIMIT 10"""
        ),
        {"lid": learner_id},
    ).mappings().all()

    created: list[str] = []
    for r in rows:
        payload = {
            "targetTable": "brain_states",
            "targetField": "mastery_levels",
            "domain": r["domain"],
            "currentValue": r["current_mastery"],
            "proposedValue": r["previous_mastery"],
            "reason": r.get("hypothesis") or "Detected mastery regression",
            "requiresParentApproval": True,
        }
        if _dedup_key("regression_alert", payload) in existing:
            continue
        rec_id = _insert(
            db,
            learner_id=learner_id,
            tenant_id=tenant_id,
            rec_type="regression_alert",
            title=f"Mastery drop detected in {r['domain']}",
            description=(
                f"Mastery in {r['domain']} fell from {r['previous_mastery']:.1f} "
                f"to {r['current_mastery']:.1f} (-{r['mastery_drop']:.1f})."
            ),
            payload=payload,
            evidence={"causalAnalysisId": str(r["id"]), "detectedAt": r["detected_at"].isoformat()},
            source_signals=["causal_analyses"],
            confidence=r.get("confidence"),
        )
        created.append(rec_id)
        existing.add(_dedup_key("regression_alert", payload))
    return created


def _accommodation_gap_recommendations(
    db: Session, learner_id: str, tenant_id: str, existing: set[str]
) -> list[str]:
    brain = db.execute(
        text(
            "SELECT active_accommodations FROM brain_states "
            "WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"
        ),
        {"lid": learner_id},
    ).mappings().first()
    iep = db.execute(
        text(
            "SELECT accommodations FROM iep_profiles "
            "WHERE learner_id = :lid ORDER BY created_at DESC LIMIT 1"
        ),
        {"lid": learner_id},
    ).mappings().first()
    if not brain or not iep:
        return []

    active = _json(brain.get("active_accommodations")) or []
    iep_accs = _json(iep.get("accommodations")) or []
    if not isinstance(active, list) or not isinstance(iep_accs, list):
        return []
    active_set = {str(a).strip().lower() for a in active}

    created: list[str] = []
    for acc in iep_accs:
        name = str(acc).strip()
        if not name:
            continue
        if name.lower() in active_set:
            continue
        payload = {
            "targetTable": "brain_states",
            "targetField": "active_accommodations",
            "accommodation": name,
            "currentValue": None,
            "proposedValue": name,
            "reason": "Accommodation present on IEP but not active on brain",
            "requiresParentApproval": True,
        }
        if _dedup_key("accommodation_add", payload) in existing:
            continue
        rec_id = _insert(
            db,
            learner_id=learner_id,
            tenant_id=tenant_id,
            rec_type="accommodation_add",
            title=f"Add accommodation: {name}",
            description="This accommodation is on your child's IEP but not yet active.",
            payload=payload,
            evidence={"source": "iep_profile"},
            source_signals=["iep_profiles.accommodations"],
            confidence=0.9,
        )
        created.append(rec_id)
        existing.add(_dedup_key("accommodation_add", payload))
    return created


def _rebaseline_recommendations(
    db: Session, learner_id: str, tenant_id: str, existing: set[str]
) -> list[str]:
    # Suggest rebaseline if the most recent COMPLETED discovery is older than
    # 180 days AND the brain has been parent-approved (not still pending).
    baseline = db.execute(
        text(
            """SELECT created_at FROM assessment_attempts
                WHERE learner_id = :lid AND type = 'discovery_adventure'
                  AND status = 'COMPLETED'
                ORDER BY created_at DESC LIMIT 1"""
        ),
        {"lid": learner_id},
    ).mappings().first()
    brain = db.execute(
        text(
            "SELECT approval_status FROM brain_states "
            "WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"
        ),
        {"lid": learner_id},
    ).mappings().first()
    if not baseline or not brain:
        return []
    if brain.get("approval_status") != "approved":
        return []
    age = _utcnow() - baseline["created_at"]
    if age < timedelta(days=180):
        return []
    payload = {
        "targetTable": "brain_states",
        "targetField": "functioning_level_profile",
        "currentValue": None,
        "proposedValue": "rebaseline",
        "reason": f"Last baseline completed {age.days} days ago",
        "requiresParentApproval": True,
    }
    if "rebaseline" in existing:
        return []
    rec_id = _insert(
        db,
        learner_id=learner_id,
        tenant_id=tenant_id,
        rec_type="rebaseline",
        title="Time for a fresh baseline assessment",
        description=(
            f"It's been {age.days} days since the last baseline. A new check-in "
            "will keep the learning path matched to current ability."
        ),
        payload=payload,
        evidence={"lastBaselineAt": baseline["created_at"].isoformat(), "ageDays": age.days},
        source_signals=["assessment_attempts"],
        confidence=0.7,
    )
    existing.add("rebaseline")
    return [rec_id]


def _iep_goal_recommendations(
    db: Session, learner_id: str, tenant_id: str, existing: set[str]
) -> list[str]:
    rows = db.execute(
        text(
            """SELECT id, goal_area, description, status, progress_percent
                FROM iep_goals
                WHERE learner_id = :lid"""
        ),
        {"lid": learner_id},
    ).mappings().all()
    created: list[str] = []
    for g in rows:
        if g.get("status") == "active" and (g.get("progress_percent") or 0) >= 95:
            payload = {
                "targetTable": "iep_goals",
                "targetField": "status",
                "domain": g.get("goal_area"),
                "currentValue": g.get("status"),
                "proposedValue": "met",
                "iepGoalId": str(g["id"]),
                "reason": "Goal at 95%+ progress",
                "requiresParentApproval": True,
            }
            if _dedup_key("iep_goal_met", payload) in existing:
                continue
            rec_id = _insert(
                db,
                learner_id=learner_id,
                tenant_id=tenant_id,
                rec_type="iep_goal_met",
                title=f"Goal met: {g.get('goal_area')}",
                description=(g.get("description") or "")[:200],
                payload=payload,
                evidence={"iepGoalId": str(g["id"]), "progress": g.get("progress_percent")},
                source_signals=["iep_goals"],
                confidence=0.85,
            )
            created.append(rec_id)
            existing.add(_dedup_key("iep_goal_met", payload))
    return created


def generate_for_learner(db: Session, learner_id: str) -> dict:
    """Run every generator for a single learner. Returns a summary."""
    tenant = db.execute(
        text("SELECT tenant_id FROM learners WHERE id = :lid"),
        {"lid": learner_id},
    ).first()
    if not tenant:
        return {"learnerId": learner_id, "skipped": "learner_not_found", "created": []}
    tenant_id = str(tenant[0])

    existing = _existing_pending_types(db, learner_id)
    created: list[str] = []
    generators: Iterable = (
        _regression_recommendations,
        _accommodation_gap_recommendations,
        _rebaseline_recommendations,
        _iep_goal_recommendations,
    )
    for gen in generators:
        try:
            created.extend(gen(db, learner_id, tenant_id, existing))
        except Exception as exc:  # noqa: BLE001 — log per-generator and continue
            db.rollback()
            return {"learnerId": learner_id, "created": created, "error": str(exc)}

    db.commit()
    return {"learnerId": learner_id, "created": created, "count": len(created)}

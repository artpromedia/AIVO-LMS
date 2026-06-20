"""
Per-subject aggregate of the per-skill model (P2).

`learner_skill_mastery` is the canonical store; `brain_states.mastery_levels` stays a
DERIVED per-subject aggregate (mean p of the subject's skills) so every existing reader keeps
working — but now it is refreshed EVERY session instead of only at clone/recommendation time,
which is what fixes the audit's "brain snapshot lags" gap. When the aggregate crosses a mastery
band a `mastery_threshold` snapshot is written for the brain's version history.

The pure helpers (`mean_p_by_subject`, `mastery_band`) are unit-tested; the brain-state write is
best-effort (a missing brain_states row or table is a no-op, never an error on the hot path).
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from mastery_svc.models.tables import LearnerSkillMastery

# Canonical bands — identical thresholds to @aivo/scoring masteryLevelFromScore.
_BANDS = [(0.15, "not_started"), (0.40, "emerging"), (0.65, "approaching"), (0.90, "on_grade_level")]


def mastery_band(score: float) -> str:
    for threshold, name in _BANDS:
        if score < threshold:
            return name
    return "stretching"


def mean_p_by_subject(rows: list[tuple[str, float]]) -> dict[str, float]:
    """rows = [(subject, p_mastery), …] → {subject: mean p rounded to 4dp}."""
    sums: dict[str, float] = {}
    counts: dict[str, int] = {}
    for subject, p in rows:
        sums[subject] = sums.get(subject, 0.0) + float(p)
        counts[subject] = counts.get(subject, 0) + 1
    return {s: round(sums[s] / counts[s], 4) for s in sums}


def subject_mean(db: Session, learner_id: str, subject: str) -> float | None:
    rows = (
        db.query(LearnerSkillMastery.p_mastery)
        .filter(LearnerSkillMastery.learner_id == learner_id, LearnerSkillMastery.subject == subject)
        .all()
    )
    if not rows:
        return None
    return round(sum(float(r[0]) for r in rows) / len(rows), 4)


def sync_brain_state_aggregate(db: Session, learner_id: str, subject: str) -> dict | None:
    """Write the subject's mean-p aggregate back into the latest brain_states row, and snapshot it
    when the band changed. Best-effort and self-contained: rolls back and returns None if brain_states
    is absent (e.g. unit-test SQLite) so the caller's already-committed skill update is unaffected."""
    try:
        mean = subject_mean(db, learner_id, subject)
        if mean is None:
            return None
        brain = db.execute(
            text(
                "SELECT id, version, mastery_levels FROM brain_states "
                "WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"
            ),
            {"lid": learner_id},
        ).mappings().first()
        if not brain:
            return None

        levels = brain["mastery_levels"]
        if isinstance(levels, str):
            levels = json.loads(levels)
        levels = dict(levels or {})
        old = levels.get(subject)
        old_val = float(old) if isinstance(old, (int, float)) else None
        levels[subject] = mean

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        db.execute(
            text("UPDATE brain_states SET mastery_levels = :ml, updated_at = :now WHERE id = :id"),
            {"ml": json.dumps(levels), "now": now, "id": brain["id"]},
        )

        crossed = old_val is None or mastery_band(old_val) != mastery_band(mean)
        if crossed:
            db.execute(
                text(
                    "INSERT INTO brain_state_snapshots (id, brain_state_id, learner_id, version, trigger, snapshot, created_at) "
                    "VALUES (:id, :bsid, :lid, :ver, 'mastery_threshold', :snap, :now)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "bsid": brain["id"],
                    "lid": learner_id,
                    "ver": int(brain["version"] or 1),
                    "snap": json.dumps({"mastery_levels": levels, "subject": subject, "mean": mean, "band": mastery_band(mean)}),
                    "now": now,
                },
            )
        db.commit()
        return {"subject": subject, "mean": mean, "band_crossed": crossed}
    except Exception:
        db.rollback()
        return None

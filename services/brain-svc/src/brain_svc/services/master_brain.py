"""
Central "master brain" + clone lineage + main_brain_upgrade propagation (P3).

The original vision: there is ONE learner-independent master brain (shared skill-graph + KT priors +
policy/accommodation templates), each learner brain DERIVES from a specific version of it, and when the
master brain is upgraded the improvement is PROPOSED to each affected learner's parent — never silently
applied to an approved brain.

This module backs that on the (previously dead) `brain_seed_templates` table, now versioned and keyed
by functioning level. The decision logic (diff, additive apply, classify-by-approval) is pure and unit
-tested; the DB operations (seed, load, propagate, apply) are thin wrappers verified against Postgres.

Guardrail enforced here: a master-brain change is APPLIED directly only to learners still in
`pending_parent_review`; for APPROVED learners it becomes a pending `brain_upgrade` recommendation.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from brain_svc.services.clone_pipeline import SEED_TEMPLATES


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Master-brain seed content (templates + KT priors), versioned in the store ────────────────────
# Default KT priors per functioning level — the BKT params mastery-svc cold-starts from. Lower p_init
# / higher slip for more-supported levels. Stored in the master brain so they are versioned and
# upgradeable rather than hard-coded in one service.
_KT_PRIORS = {
    "STANDARD": {"p_init": 0.20, "p_transit": 0.12, "p_slip": 0.10, "p_guess": 0.20},
    "SUPPORTED": {"p_init": 0.16, "p_transit": 0.11, "p_slip": 0.12, "p_guess": 0.22},
    "LOW_VERBAL": {"p_init": 0.12, "p_transit": 0.10, "p_slip": 0.14, "p_guess": 0.20},
    "NON_VERBAL": {"p_init": 0.10, "p_transit": 0.09, "p_slip": 0.16, "p_guess": 0.20},
    "PRE_SYMBOLIC": {"p_init": 0.08, "p_transit": 0.08, "p_slip": 0.18, "p_guess": 0.20},
}


def default_master_templates() -> dict[str, dict]:
    """The seed master brain: the existing functioning-level templates + their KT priors."""
    out: dict[str, dict] = {}
    for level, template in SEED_TEMPLATES.items():
        out[level] = {"template": dict(template), "kt_priors": _KT_PRIORS.get(level, _KT_PRIORS["STANDARD"])}
    return out


# ── Pure decision logic (unit-tested, no DB) ─────────────────────────────────────────────────────
def diff_template(old: dict, new: dict) -> dict:
    """Additive delta from old → new master template: skills/accommodations/tutors/curriculum that the
    upgrade ADDS. We never propose removals (that would regress a learner); the master brain only ever
    grows capability."""
    old = old or {}
    new = new or {}
    old_mastery = (old.get("mastery_levels") or {})
    new_mastery = (new.get("mastery_levels") or {})
    added_skills = [k for k in new_mastery if k not in old_mastery]
    old_acc = set(old.get("active_accommodations") or [])
    new_acc = list(new.get("active_accommodations") or [])
    old_tut = set(old.get("active_tutors") or [])
    new_tut = list(new.get("active_tutors") or [])
    old_curr = old.get("functional_curriculum") or {}
    new_curr = new.get("functional_curriculum") or {}
    return {
        "added_skills": added_skills,
        "added_accommodations": [a for a in new_acc if a not in old_acc],
        "added_tutors": [t for t in new_tut if t not in old_tut],
        "curriculum_changes": {k: v for k, v in new_curr.items() if old_curr.get(k) != v},
    }


def delta_is_empty(delta: dict) -> bool:
    return not (
        delta.get("added_skills")
        or delta.get("added_accommodations")
        or delta.get("added_tutors")
        or delta.get("curriculum_changes")
    )


def apply_delta_to_brain(brain: dict, delta: dict) -> dict:
    """Apply an upgrade delta to a learner brain's content ADDITIVELY: union accommodations + tutors,
    add new skills at mastery 0 (never touch demonstrated mastery), merge curriculum. Returns a NEW
    dict; the learner's earned progress is preserved."""
    brain = dict(brain or {})
    mastery = dict(brain.get("mastery_levels") or {})
    for skill in delta.get("added_skills") or []:
        mastery.setdefault(skill, 0.0)  # new capability starts un-mastered; never overwrite earned p
    brain["mastery_levels"] = mastery

    acc = list(brain.get("active_accommodations") or [])
    for a in delta.get("added_accommodations") or []:
        if a not in acc:
            acc.append(a)
    brain["active_accommodations"] = acc

    tut = list(brain.get("active_tutors") or [])
    for t in delta.get("added_tutors") or []:
        if t not in tut:
            tut.append(t)
    brain["active_tutors"] = tut

    curr = dict(brain.get("functional_curriculum") or {})
    curr.update(delta.get("curriculum_changes") or {})
    brain["functional_curriculum"] = curr
    return brain


def classify_learners_for_upgrade(rows: list[dict]) -> dict[str, list[str]]:
    """Split affected learners by approval status. APPROVED brains must be proposed-to (recommend);
    PENDING brains (not yet parent-approved) may take the new defaults directly."""
    to_recommend: list[str] = []
    to_apply_direct: list[str] = []
    for r in rows:
        status = (r.get("approval_status") or "").lower()
        (to_apply_direct if status == "pending_parent_review" else to_recommend).append(r["learner_id"])
    return {"recommend": to_recommend, "apply_direct": to_apply_direct}


# ── DB operations (integration-verified) ─────────────────────────────────────────────────────────
def load_master_template(db: Session, functioning_level: str):
    """Latest master template + version for a functioning level, or (None, None). Returns None when no
    real row is found (and is robust to a mocked db whose .template isn't a real dict) so the clone
    pipeline falls back to the in-code seed."""
    try:
        row = db.execute(
            text(
                "SELECT template, version, kt_priors FROM brain_seed_templates "
                "WHERE functioning_level = :fl ORDER BY version DESC LIMIT 1"
            ),
            {"fl": functioning_level},
        ).mappings().first()
    except Exception:
        return None, None
    if not row:
        return None, None
    template = row.get("template")
    if isinstance(template, str):
        try:
            template = json.loads(template)
        except Exception:
            return None, None
    if not isinstance(template, dict):
        return None, None
    return template, row.get("version")


def seed_master_brain(db: Session) -> int:
    """Idempotently seed the master brain at version 1 from the default templates. Returns the number
    of functioning levels written (0 if already seeded)."""
    written = 0
    for level, content in default_master_templates().items():
        existing = db.execute(
            text("SELECT 1 FROM brain_seed_templates WHERE functioning_level = :fl LIMIT 1"),
            {"fl": level},
        ).first()
        if existing:
            continue
        db.execute(
            text(
                "INSERT INTO brain_seed_templates (id, name, grade_band, functioning_level, template, version, kt_priors, created_at) "
                "VALUES (:id, :name, :gb, :fl, :tpl, 1, :kt, :now)"
            ),
            {
                "id": str(uuid.uuid4()),
                "name": f"Master brain — {level}",
                "gb": "ALL",
                "fl": level,
                "tpl": json.dumps(content["template"]),
                "kt": json.dumps(content["kt_priors"]),
                "now": _utcnow(),
            },
        )
        written += 1
    db.commit()
    return written


def propagate_upgrade(
    db: Session,
    functioning_level: str,
    new_template: dict,
    *,
    kt_priors: dict | None = None,
    actor: str = "system",
) -> dict:
    """Upgrade the master brain for a functioning level and propagate:
      - store a new versioned brain_seed_templates row;
      - APPROVED affected learners get one PENDING `brain_upgrade` recommendation each (no brain change);
      - PENDING learners take the new defaults directly (+ a main_brain_upgrade snapshot).
    Returns a summary.
    """
    old_template, old_version = load_master_template(db, functioning_level)
    new_version = int(old_version or 0) + 1
    delta = diff_template(old_template or SEED_TEMPLATES.get(functioning_level, {}), new_template)

    db.execute(
        text(
            "INSERT INTO brain_seed_templates (id, name, grade_band, functioning_level, template, version, kt_priors, created_at) "
            "VALUES (:id, :name, 'ALL', :fl, :tpl, :ver, :kt, :now)"
        ),
        {
            "id": str(uuid.uuid4()),
            "name": f"Master brain — {functioning_level} v{new_version}",
            "fl": functioning_level,
            "tpl": json.dumps(new_template),
            "ver": new_version,
            "kt": json.dumps(kt_priors or _KT_PRIORS.get(functioning_level, {})),
            "now": _utcnow(),
        },
    )

    affected = db.execute(
        text(
            "SELECT learner_id, tenant_id, approval_status FROM brain_states "
            "WHERE functioning_level_profile->>'level' = :fl"
        ),
        {"fl": functioning_level},
    ).mappings().all()
    plan = classify_learners_for_upgrade([dict(r) for r in affected])
    tenant_by_learner = {str(r["learner_id"]): r["tenant_id"] for r in affected}

    recommended = 0
    if not delta_is_empty(delta):
        for learner_id in plan["recommend"]:
            db.execute(
                text(
                    """INSERT INTO brain_recommendations
                        (id, tenant_id, learner_id, type, status, title, description, payload, evidence,
                         source_signals, confidence, created_at)
                        VALUES (:id, :tid, :lid, 'brain_upgrade', 'PENDING', :title, :desc, :payload,
                                :evidence, :signals, :conf, :now)"""
                ),
                {
                    "id": str(uuid.uuid4()),
                    "tid": tenant_by_learner.get(learner_id),
                    "lid": learner_id,
                    "title": "Aivo Brain upgrade available",
                    "desc": "The master brain added new capabilities for this learner's profile. Review to apply.",
                    "payload": json.dumps({"delta": delta, "master_version": new_version, "functioning_level": functioning_level}),
                    "evidence": json.dumps({"source": "main_brain_upgrade", "actor": actor}),
                    "signals": json.dumps([]),
                    "conf": 0.9,
                    "now": _utcnow(),
                },
            )
            recommended += 1

    applied_direct = 0
    if not delta_is_empty(delta):
        for learner_id in plan["apply_direct"]:
            if _apply_delta_to_learner(db, learner_id, delta, new_version, basis="pending_default"):
                applied_direct += 1

    db.commit()
    return {
        "functioning_level": functioning_level,
        "master_version": new_version,
        "delta": delta,
        "recommended": recommended,
        "applied_direct": applied_direct,
    }


def _apply_delta_to_learner(db: Session, learner_id: str, delta: dict, master_version: int, *, basis: str) -> bool:
    """Apply an upgrade delta to one learner's latest brain_states row + write a main_brain_upgrade
    snapshot carrying the master-version lineage. Returns True when applied."""
    brain = db.execute(
        text("SELECT * FROM brain_states WHERE learner_id = :lid ORDER BY version DESC LIMIT 1"),
        {"lid": learner_id},
    ).mappings().first()
    if not brain:
        return False

    def _as_dict(v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        return v or {}

    content = {
        "mastery_levels": _as_dict(brain.get("mastery_levels")),
        "active_accommodations": _as_dict(brain.get("active_accommodations")) or [],
        "active_tutors": _as_dict(brain.get("active_tutors")) or [],
        "functional_curriculum": _as_dict(brain.get("functional_curriculum")),
    }
    updated = apply_delta_to_brain(content, delta)

    flp = _as_dict(brain.get("functioning_level_profile"))
    flp["master_brain_version"] = master_version  # lineage
    new_version = int(brain.get("version") or 1) + 1
    now = _utcnow()

    db.execute(
        text(
            "UPDATE brain_states SET mastery_levels = :ml, active_accommodations = :aa, active_tutors = :at, "
            "functional_curriculum = :fc, functioning_level_profile = :flp, version = :ver, updated_at = :now "
            "WHERE id = :id"
        ),
        {
            "ml": json.dumps(updated["mastery_levels"]),
            "aa": json.dumps(updated["active_accommodations"]),
            "at": json.dumps(updated["active_tutors"]),
            "fc": json.dumps(updated["functional_curriculum"]),
            "flp": json.dumps(flp),
            "ver": new_version,
            "now": now,
            "id": brain["id"],
        },
    )
    db.execute(
        text(
            "INSERT INTO brain_state_snapshots (id, brain_state_id, learner_id, version, trigger, snapshot, created_at) "
            "VALUES (:id, :bsid, :lid, :ver, 'main_brain_upgrade', :snap, :now)"
        ),
        {
            "id": str(uuid.uuid4()),
            "bsid": brain["id"],
            "lid": learner_id,
            "ver": new_version,
            "snap": json.dumps({**updated, "master_brain_version": master_version, "basis": basis}),
            "now": now,
        },
    )
    return True


def apply_master_upgrade(db: Session, recommendation_id: str) -> dict:
    """Apply an APPROVED brain_upgrade recommendation: apply its delta to the learner + a
    main_brain_upgrade snapshot, and mark the recommendation APPLIED. This is the parent-approval path
    (never auto-applied)."""
    rec = db.execute(
        text("SELECT id, learner_id, payload, status FROM brain_recommendations WHERE id = :id"),
        {"id": recommendation_id},
    ).mappings().first()
    if not rec:
        return {"applied": False, "reason": "not_found"}
    payload = rec.get("payload")
    if isinstance(payload, str):
        payload = json.loads(payload)
    payload = payload or {}
    delta = payload.get("delta") or {}
    master_version = int(payload.get("master_version") or 1)

    applied = _apply_delta_to_learner(db, str(rec["learner_id"]), delta, master_version, basis="parent_approved")
    db.execute(
        text("UPDATE brain_recommendations SET status = 'APPLIED', applied_at = :now WHERE id = :id"),
        {"now": _utcnow(), "id": recommendation_id},
    )
    db.commit()
    return {"applied": applied, "master_version": master_version}

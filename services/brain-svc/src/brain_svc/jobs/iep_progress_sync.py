"""IEP progress sync worker.

Maps a learner's most recent mastery signal onto their active IEP goals and
writes ``iep_goals.current_progress`` (0..100). On a material change it also
appends a parent-visible row to ``iep_progress_notes`` so the family timeline
reflects measured progress, not just teacher narrative.

Runs as a CronJob entrypoint on the brain-svc image. Pure SQL via SQLAlchemy
core — no ORM models needed, so it stays decoupled from brain-svc internals.

Idempotent: re-running without new mastery data is a no-op (delta gate).

Schema notes (verified against packages/db/src/schema/learners.ts):
  * ``iep_goals``        — domain, goal_text, current_progress (int 0..100),
                           status, iep_profile_id (nullable).
  * ``iep_progress_notes`` — iep_profile_id NOT NULL, learner_id NOT NULL,
                           goal_id, author_id NOT NULL → users(id), body,
                           visibility.
  * ``brain_states``     — mastery_levels jsonb (0..1 per domain), version.

Because ``iep_progress_notes.author_id`` is NOT NULL with an FK to ``users``,
the worker cannot insert a NULL system author. The progress write is therefore
the primary, always-committed action; the parent-visible note is best-effort
and only written when a valid author is resolvable
(``IEP_PROGRESS_SYNC_AUTHOR_ID``). A note failure never rolls back the progress
write — "fail open on audit".
"""
from __future__ import annotations

import logging
import os
import time

from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("brain-svc.iep-progress-sync")

MIN_DELTA = float(os.environ.get("IEP_PROGRESS_SYNC_MIN_DELTA", "0.05"))
# Optional service/case-manager user id used as the author of the
# parent-visible progress note. When unset (or invalid), the worker still
# writes current_progress and simply skips the note — the schema requires a
# real users(id) FK, so there is no NULL system author to fall back on.
NOTE_AUTHOR_ID = os.environ.get("IEP_PROGRESS_SYNC_AUTHOR_ID") or None


def _engine():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is required")
    # psycopg2 driver normalisation, matching brain-svc convention.
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return create_engine(url, pool_pre_ping=True, future=True)


# Mastery is stored 0..1 in brain_states.mastery_levels (jsonb keyed by domain).
# IEP goal progress is an integer 0..100. We convert and clamp.
_SELECT_GOALS = text(
    """
    SELECT g.id,
           g.learner_id,
           g.iep_profile_id,
           lower(coalesce(g.domain, '')) AS domain,
           coalesce(g.current_progress, 0) AS current_progress
    FROM iep_goals g
    WHERE g.status = 'active'
    """
)

_SELECT_MASTERY = text(
    """
    SELECT mastery_levels
    FROM brain_states
    WHERE learner_id = :lid
    ORDER BY version DESC
    LIMIT 1
    """
)

_UPDATE_PROGRESS = text(
    """
    UPDATE iep_goals
    SET current_progress = :pct, updated_at = now()
    WHERE id = :gid
    """
)

# author_id is NOT NULL with an FK to users(id); the SELECT only yields a row
# (and the INSERT only fires) when the goal has an iep_profile_id and a valid
# author was supplied. Otherwise the note is silently skipped.
_INSERT_NOTE = text(
    """
    INSERT INTO iep_progress_notes
        (iep_profile_id, learner_id, goal_id, author_id, body, visibility, created_at)
    SELECT g.iep_profile_id, g.learner_id, g.id, :author_id,
           :body, 'parent', now()
    FROM iep_goals g
    WHERE g.id = :gid AND g.iep_profile_id IS NOT NULL
    """
)


def _domain_mastery(mastery_levels, domain: str) -> float | None:
    if not isinstance(mastery_levels, dict) or not domain:
        return None
    val = mastery_levels.get(domain)
    if isinstance(val, dict):  # {score: x} shape tolerance
        val = val.get("score")
    try:
        return max(0.0, min(1.0, float(val)))
    except (TypeError, ValueError):
        return None


def run_once() -> int:
    eng = _engine()
    written = 0
    # Single outer transaction for the run; the best-effort progress note is
    # isolated in a SAVEPOINT (begin_nested) so a note failure rolls back only
    # the note, never the progress writes — "fail open on audit".
    with eng.begin() as cx:
        goals = cx.execute(_SELECT_GOALS).mappings().all()
        # Cache mastery per learner to avoid N queries for multi-goal learners.
        cache: dict[str, dict] = {}
        for g in goals:
            lid = g["learner_id"]
            if lid not in cache:
                row = cx.execute(_SELECT_MASTERY, {"lid": lid}).mappings().first()
                cache[lid] = (row or {}).get("mastery_levels") or {}
            mastery = _domain_mastery(cache[lid], g["domain"])
            if mastery is None:
                continue
            new_pct = int(round(mastery * 100))
            old_pct = int(g["current_progress"])
            if abs(new_pct - old_pct) < MIN_DELTA * 100:
                continue

            # Primary write: progress.
            cx.execute(_UPDATE_PROGRESS, {"pct": new_pct, "gid": g["id"]})
            written += 1

            # Best-effort, parent-visible note. Only attempted when we have a
            # valid author for the NOT NULL author_id FK; the SAVEPOINT keeps a
            # failure (e.g. bad author FK) from poisoning the outer transaction.
            if NOTE_AUTHOR_ID and g["iep_profile_id"] is not None:
                try:
                    with cx.begin_nested():
                        cx.execute(
                            _INSERT_NOTE,
                            {
                                "gid": g["id"],
                                "author_id": NOTE_AUTHOR_ID,
                                "body": (
                                    f"Measured progress updated to {new_pct}% "
                                    f"(was {old_pct}%) from latest mastery signal."
                                ),
                            },
                        )
                except Exception:  # noqa: BLE001 — note is non-critical
                    log.warning(
                        "iep-progress-sync: progress note skipped for goal %s",
                        g["id"],
                        exc_info=True,
                    )
    log.info("iep-progress-sync: %d goal(s) updated", written)
    return written


def main() -> None:
    once = os.environ.get("IEP_PROGRESS_SYNC_ONCE") == "1"
    if once:
        run_once()
        return
    # Long-running mode is driven by the platform scheduler (CronJob / systemd
    # timer) which invokes this entrypoint per tick; we still loop-guard so a
    # mis-set scheduler degrades to a safe 60s poll rather than a busy spin.
    interval = int(os.environ.get("IEP_PROGRESS_SYNC_INTERVAL_SECONDS", "900"))
    while True:
        try:
            run_once()
        except Exception:  # noqa: BLE001 — worker must survive a bad tick
            log.exception("iep-progress-sync tick failed")
        time.sleep(max(60, interval))


if __name__ == "__main__":
    main()

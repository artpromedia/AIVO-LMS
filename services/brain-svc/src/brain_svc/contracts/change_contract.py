"""Sprint C-13 (ADR 0042-aligned) — the shared brain-profile CHANGE contract,
Python side.

The Python mirror of ``packages/db/src/schema/change-contract.ts``. One
definition of "what changed in this child's profile, was it structural, and does
the parent need to re-acknowledge the delta?", honoured wherever a brain profile
mutates. There is no shared TS<->Python codegen in this repo, so these constants
restate the TypeScript ones verbatim and a parity test on each side fails CI on
drift:

  - TS parity:  apps/web-v2/lib/db/__tests__/change-contract.parity.test.ts
  - PY parity:  services/brain-svc/tests/test_change_contract_parity.py

ADR 0042 (change addendum) is the human-readable parity record. Keep the literal
sets below identical to the TypeScript module.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, field_validator

# ── Change classification (mirror of change-contract.ts) ───────────────────

#: mastery changes flow freely; structural changes require acknowledgement.
BRAIN_CHANGE_KINDS: tuple[str, ...] = ("mastery", "structural")

#: Where a change originated. Parent-authored corrections (C-05) are NOT a
#: source. ``amendment`` is the brain-svc parent-amend path: recorded, never
#: requiresAck.
BRAIN_CHANGE_SOURCES: tuple[str, ...] = (
    "baseline_reclone",
    "regenerate",
    "iep_update",
    "engagement_sync",
    "regression_detected",
    "amendment",
    "rollback",
)

#: The default acknowledgement window for a structural change, in days. Chosen
#: at 14 (two weeks). Non-blocking: teaching never stops when it lapses.
BRAIN_CHANGE_ACK_WINDOW_DAYS: int = 14

#: After this many days an un-acked structural change earns ONE digest reminder.
BRAIN_CHANGE_REMINDER_AFTER_DAYS: int = 7

#: The canonical field list of a shared change record (camelCase — the wire
#: shape). Both stacks construct a record with exactly these fields.
BRAIN_CHANGE_RECORD_FIELDS: tuple[str, ...] = (
    "id",
    "tenantId",
    "learnerId",
    "brainProfileId",
    "revision",
    "kind",
    "fields",
    "summary",
    "source",
    "requiresAck",
    "ackedAt",
    "reminderSentAt",
    "createdAt",
)


def is_brain_change_kind(kind: str | None) -> bool:
    """True iff ``kind`` is a recognised change kind."""
    return kind in BRAIN_CHANGE_KINDS


def is_brain_change_source(source: str | None) -> bool:
    """True iff ``source`` is a recognised change source."""
    return source in BRAIN_CHANGE_SOURCES


def change_requires_ack(kind: str | None) -> bool:
    """A structural change is the ONLY kind that requires acknowledgement. The
    single predicate both stacks use so the rule cannot drift."""
    return kind == "structural"


class BrainProfileChangeRecord(BaseModel):
    """The shared change record contract (the ``brain_profile_changes`` shape).
    Mirrors web-v2's ``LearnerBrainProfileChange``. Field names are camelCase to
    match the record/wire shape exactly across both stacks.
    """

    id: str
    tenantId: str
    learnerId: str
    brainProfileId: str
    #: The LearnerBrainProfile.revision / brain_state version this change produced.
    revision: int
    kind: str
    #: Changed field paths (e.g. ["accommodation.read_aloud", "functioningLevel"]).
    fields: list[str] = []
    #: Plain-language, strengths-first summary of what changed and why.
    summary: str
    source: str
    #: True only for structural changes — the parent must acknowledge the delta.
    requiresAck: bool
    #: ISO timestamp when the parent acknowledged the delta; None while pending.
    ackedAt: str | None = None
    #: ISO timestamp when the 7-day digest reminder was sent; None until latched.
    reminderSentAt: str | None = None
    createdAt: str

    @field_validator("kind")
    @classmethod
    def _kind_in_enum(cls, v: str) -> str:
        if not is_brain_change_kind(v):
            raise ValueError(f"kind must be one of {', '.join(BRAIN_CHANGE_KINDS)}")
        return v

    @field_validator("source")
    @classmethod
    def _source_in_enum(cls, v: str) -> str:
        if not is_brain_change_source(v):
            raise ValueError(
                f"source must be one of {', '.join(BRAIN_CHANGE_SOURCES)}"
            )
        return v

    @field_validator("requiresAck")
    @classmethod
    def _requires_ack_matches_kind(cls, v: bool, info: Any) -> bool:
        kind = info.data.get("kind")
        # Enforce the cross-stack invariant: requiresAck iff structural. ``kind``
        # is validated first (declared earlier), so it is present here.
        if kind is not None and v != change_requires_ack(kind):
            raise ValueError("requiresAck must equal (kind == 'structural')")
        return v

"""Sprint C-12 (ADR 0042) — the shared approval/consent contract, Python side.

The Python mirror of ``packages/db/src/schema/approval-contract.ts``. One
definition of "is this child's profile approved, by whom, under which consent?",
honoured by BOTH lesson pipelines. There is no shared TS<->Python codegen in this
repo, so these constants restate the TypeScript ones verbatim and a parity test
on each side fails CI on drift:

  - TS parity:  apps/web-v2/lib/db/__tests__/approval-contract.parity.test.ts
  - PY parity:  services/brain-svc/tests/test_approval_contract_parity.py

ADR 0042 is the human-readable parity record. Keep the literal sets below
identical to the TypeScript module.
"""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel, field_validator

# ── Status enums (mirror of approval-contract.ts) ──────────────────────────

#: The full approval lifecycle of a learner's brain profile. Mirrors
#: ``brainApprovalStatusEnum`` and ``brain_states.approval_status``.
BRAIN_APPROVAL_STATUSES: tuple[str, ...] = (
    "pending_parent_review",
    "approved",
    "amended",
    "declined",
)

#: The sub-set of statuses from which a lesson pipeline MAY teach. An amendment
#: is an accepted profile carrying parent overrides — it teaches. This is THE
#: teach gate's decision set, asserted server-side against every lesson pipeline.
TEACHING_APPROVAL_STATUSES: tuple[str, ...] = ("approved", "amended")

#: The action a single approval *record* captures. A decline is recorded too
#: (it archives), but it is never a teaching status.
APPROVAL_RECORD_ACTIONS: tuple[str, ...] = ("approved", "amended", "declined")

#: The canonical field list of a shared approval record. Both stacks construct a
#: record with exactly these fields (camelCase — the wire/record shape).
APPROVAL_RECORD_FIELDS: tuple[str, ...] = (
    "id",
    "tenantId",
    "learnerId",
    "brainProfileId",
    "profileRevision",
    "actorUserId",
    "action",
    "consentVersion",
    "raiVersion",
    "modifications",
    "ipHash",
    "createdAt",
)


def can_teach(status: str | None) -> bool:
    """True iff a profile in ``status`` is allowed to teach. THE teach-gate predicate."""
    return status in TEACHING_APPROVAL_STATUSES


def is_approval_status(status: str | None) -> bool:
    """True iff ``status`` is a recognised lifecycle status."""
    return status in BRAIN_APPROVAL_STATUSES


def is_approval_record_action(action: str | None) -> bool:
    """True iff ``action`` is a recognised approval-record action."""
    return action in APPROVAL_RECORD_ACTIONS


def assert_can_teach(status: str | None) -> None:
    """Raise HTTP 403 unless ``status`` may teach.

    The explicit, reusable services-side gate (ADR 0042 §3). Any path into
    lesson/path init — internal-token callers included — runs this so the Python
    gate stops being sequencing-only. Detail string carries a stable
    ``brain_not_approved`` code, in parity with web-v2's typed
    ``createLessonRun`` result.
    """
    if not can_teach(status):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "brain_not_approved",
                "message": (
                    "Brain profile awaiting parent approval before lesson "
                    "generation"
                ),
                "approvalStatus": status,
            },
        )


class BrainProfileApprovalRecord(BaseModel):
    """The shared approval record contract (the C-06 ``brain_profile_approvals``
    shape). Mirrors web-v2's ``BrainProfileApproval``. Field names are camelCase
    to match the record/wire shape exactly across both stacks.
    """

    id: str
    tenantId: str
    learnerId: str
    brainProfileId: str
    #: The ``LearnerBrainProfile.revision`` / brain_state version reviewed.
    profileRevision: int
    actorUserId: str
    action: str
    #: Version string of the COPPA consent copy the parent agreed to.
    consentVersion: str
    #: Version of the Responsible-AI disclosures acknowledged.
    raiVersion: str
    #: Field-level corrections folded at approval; [] for a plain approve / decline.
    modifications: list[Any] = []
    #: SHA-256 of the request IP — raw IP is never stored. May be None.
    ipHash: str | None = None
    createdAt: str

    @field_validator("action")
    @classmethod
    def _action_in_enum(cls, v: str) -> str:
        if not is_approval_record_action(v):
            raise ValueError(
                f"action must be one of {', '.join(APPROVAL_RECORD_ACTIONS)}"
            )
        return v

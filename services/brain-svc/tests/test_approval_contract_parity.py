"""Sprint C-12 (ADR 0042) — the shared approval/consent contract, Python side parity.

The Python mirror of apps/web-v2/lib/db/__tests__/approval-contract.parity.test.ts.
There is no shared TS<->Python codegen, so this test pins the exact same literal
sets the TS parity test pins. If either side drifts, its parity test fails CI.
ADR 0042 is the human-readable parity record — keep these in lockstep with the
TypeScript module (packages/db/src/schema/approval-contract.ts).

Run with: pytest services/brain-svc/tests/test_approval_contract_parity.py -v
"""
import pytest
from fastapi import HTTPException

from brain_svc.contracts.approval_contract import (
    BRAIN_APPROVAL_STATUSES,
    TEACHING_APPROVAL_STATUSES,
    APPROVAL_RECORD_ACTIONS,
    APPROVAL_RECORD_FIELDS,
    BrainProfileApprovalRecord,
    assert_can_teach,
    can_teach,
    is_approval_status,
    is_approval_record_action,
)


class TestApprovalContractParity:
    def test_status_enum_matches_cross_stack_literal_set(self):
        assert list(BRAIN_APPROVAL_STATUSES) == [
            "pending_parent_review",
            "approved",
            "amended",
            "declined",
        ]

    def test_teaching_set_is_exactly_approved_amended(self):
        assert list(TEACHING_APPROVAL_STATUSES) == ["approved", "amended"]

    def test_record_actions_match_cross_stack_literal_set(self):
        assert list(APPROVAL_RECORD_ACTIONS) == ["approved", "amended", "declined"]

    def test_record_field_list_matches_canonical_shape(self):
        assert list(APPROVAL_RECORD_FIELDS) == [
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
        ]

    def test_record_model_has_every_contract_field(self):
        rec = BrainProfileApprovalRecord(
            id="bpa_1",
            tenantId="t_1",
            learnerId="lr_1",
            brainProfileId="brp_1",
            profileRevision=1,
            actorUserId="u_1",
            action="approved",
            consentVersion="1.0",
            raiVersion="1",
            modifications=[],
            ipHash=None,
            createdAt="2026-06-13T12:00:00.000Z",
        )
        dumped = rec.model_dump()
        for field in APPROVAL_RECORD_FIELDS:
            assert field in dumped


class TestTeachPredicates:
    def test_can_teach_only_approved_amended(self):
        assert can_teach("approved") is True
        assert can_teach("amended") is True
        assert can_teach("pending_parent_review") is False
        assert can_teach("declined") is False
        assert can_teach(None) is False
        assert can_teach("APPROVED") is False  # case-sensitive

    def test_status_and_action_recognisers(self):
        assert is_approval_status("declined") is True
        assert is_approval_status("nope") is False
        assert is_approval_record_action("amended") is True
        # 'pending_parent_review' is a lifecycle status, never a record action.
        assert is_approval_record_action("pending_parent_review") is False

    def test_assert_can_teach_raises_403_for_unapproved(self):
        for bad in ("pending_parent_review", "declined", None):
            with pytest.raises(HTTPException) as exc:
                assert_can_teach(bad)
            assert exc.value.status_code == 403
            assert exc.value.detail["code"] == "brain_not_approved"

    def test_assert_can_teach_passes_for_teaching_statuses(self):
        # Must not raise.
        assert_can_teach("approved")
        assert_can_teach("amended")


class TestRecordValidation:
    def test_rejects_bad_action(self):
        with pytest.raises(Exception):
            BrainProfileApprovalRecord(
                id="bpa_1",
                tenantId="t_1",
                learnerId="lr_1",
                brainProfileId="brp_1",
                profileRevision=1,
                actorUserId="u_1",
                action="pending_parent_review",  # not a record action
                consentVersion="1.0",
                raiVersion="1",
                createdAt="2026-06-13T12:00:00.000Z",
            )

"""Sprint C-13 (ADR 0042-aligned) — the shared change contract, Python side parity.

The Python mirror of apps/web-v2/lib/db/__tests__/change-contract.parity.test.ts.
There is no shared TS<->Python codegen, so this test pins the exact same literal
sets the TS parity test pins. If either side drifts, its parity test fails CI.
Keep these in lockstep with the TypeScript module
(packages/db/src/schema/change-contract.ts).

Run with: pytest services/brain-svc/tests/test_change_contract_parity.py -v
"""
import pytest

from brain_svc.contracts.change_contract import (
    BRAIN_CHANGE_KINDS,
    BRAIN_CHANGE_SOURCES,
    BRAIN_CHANGE_ACK_WINDOW_DAYS,
    BRAIN_CHANGE_REMINDER_AFTER_DAYS,
    BRAIN_CHANGE_RECORD_FIELDS,
    BrainProfileChangeRecord,
    change_requires_ack,
    is_brain_change_kind,
    is_brain_change_source,
)


class TestChangeContractParity:
    def test_kinds_match_cross_stack_literal_set(self):
        assert list(BRAIN_CHANGE_KINDS) == ["mastery", "structural"]

    def test_sources_match_cross_stack_literal_set(self):
        assert list(BRAIN_CHANGE_SOURCES) == [
            "baseline_reclone",
            "regenerate",
            "iep_update",
            "engagement_sync",
            "regression_detected",
            "amendment",
            "rollback",
        ]

    def test_window_constants_match(self):
        assert BRAIN_CHANGE_ACK_WINDOW_DAYS == 14
        assert BRAIN_CHANGE_REMINDER_AFTER_DAYS == 7
        # The reminder must fire while the ack window is still open.
        assert BRAIN_CHANGE_REMINDER_AFTER_DAYS < BRAIN_CHANGE_ACK_WINDOW_DAYS

    def test_record_field_list_matches_canonical_shape(self):
        assert list(BRAIN_CHANGE_RECORD_FIELDS) == [
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
        ]

    def test_record_model_has_every_contract_field(self):
        rec = BrainProfileChangeRecord(
            id="bpc_1",
            tenantId="t_1",
            learnerId="lr_1",
            brainProfileId="brp_1",
            revision=2,
            kind="structural",
            fields=["accommodation.read_aloud"],
            summary="Read-aloud turned on.",
            source="baseline_reclone",
            requiresAck=True,
            ackedAt=None,
            reminderSentAt=None,
            createdAt="2026-06-13T12:00:00.000Z",
        )
        dumped = rec.model_dump()
        for field in BRAIN_CHANGE_RECORD_FIELDS:
            assert field in dumped


class TestChangePredicates:
    def test_requires_ack_only_for_structural(self):
        assert change_requires_ack("structural") is True
        assert change_requires_ack("mastery") is False
        assert change_requires_ack(None) is False
        assert change_requires_ack("STRUCTURAL") is False  # case-sensitive

    def test_kind_and_source_recognisers(self):
        assert is_brain_change_kind("mastery") is True
        assert is_brain_change_kind("nope") is False
        assert is_brain_change_source("engagement_sync") is True
        assert is_brain_change_source("approved") is False


class TestRecordValidation:
    def test_rejects_bad_kind(self):
        with pytest.raises(Exception):
            BrainProfileChangeRecord(
                id="bpc_1",
                tenantId="t_1",
                learnerId="lr_1",
                brainProfileId="brp_1",
                revision=2,
                kind="not_a_kind",
                fields=[],
                summary="x",
                source="engagement_sync",
                requiresAck=False,
                createdAt="2026-06-13T12:00:00.000Z",
            )

    def test_rejects_mastery_with_requires_ack(self):
        # A mastery change can never require acknowledgement.
        with pytest.raises(Exception):
            BrainProfileChangeRecord(
                id="bpc_1",
                tenantId="t_1",
                learnerId="lr_1",
                brainProfileId="brp_1",
                revision=2,
                kind="mastery",
                fields=["masteryLevels.math"],
                summary="Math moved.",
                source="engagement_sync",
                requiresAck=True,  # invalid for mastery
                createdAt="2026-06-13T12:00:00.000Z",
            )

    def test_rejects_structural_without_requires_ack(self):
        with pytest.raises(Exception):
            BrainProfileChangeRecord(
                id="bpc_1",
                tenantId="t_1",
                learnerId="lr_1",
                brainProfileId="brp_1",
                revision=2,
                kind="structural",
                fields=["functioningLevel"],
                summary="Level shifted.",
                source="baseline_reclone",
                requiresAck=False,  # invalid for structural
                createdAt="2026-06-13T12:00:00.000Z",
            )

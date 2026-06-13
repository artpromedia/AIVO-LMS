/**
 * Sprint C-12 (ADR 0042) — the shared approval/consent contract, TS side parity.
 *
 * One definition of "is this child's profile approved?" must hold across BOTH
 * stacks. There is no shared TS<->Python codegen, so this test pins the exact
 * literal sets; the Python mirror
 * (services/brain-svc/tests/test_approval_contract_parity.py) pins the same
 * ones. If either side drifts, its parity test fails. ADR 0042 is the
 * human-readable parity record.
 *
 * It also proves the contract's predicates + validator behave, and that the
 * web-v2 `BrainProfileApproval` record type is constructible against the
 * shared contract shape.
 */
import { describe, it, expect } from "vitest";
import {
  BRAIN_APPROVAL_STATUSES,
  TEACHING_APPROVAL_STATUSES,
  APPROVAL_RECORD_ACTIONS,
  APPROVAL_RECORD_FIELDS,
  canTeach,
  isApprovalStatus,
  isApprovalRecordAction,
  parseApprovalRecord,
} from "@aivo/db";
import type { BrainProfileApproval } from "@/lib/db/types";

describe("approval contract — shared enum/field parity (ADR 0042)", () => {
  it("status enum matches the cross-stack literal set", () => {
    expect([...BRAIN_APPROVAL_STATUSES]).toEqual([
      "pending_parent_review",
      "approved",
      "amended",
      "declined",
    ]);
  });

  it("teaching set is exactly {approved, amended}", () => {
    expect([...TEACHING_APPROVAL_STATUSES]).toEqual(["approved", "amended"]);
  });

  it("record actions match the cross-stack literal set", () => {
    expect([...APPROVAL_RECORD_ACTIONS]).toEqual(["approved", "amended", "declined"]);
  });

  it("record field list matches the canonical shape", () => {
    expect([...APPROVAL_RECORD_FIELDS]).toEqual([
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
    ]);
  });

  it("the web BrainProfileApproval type has every contract field", () => {
    const record: BrainProfileApproval = {
      id: "bpa_1",
      tenantId: "t_1",
      learnerId: "lr_1",
      brainProfileId: "brp_1",
      profileRevision: 1,
      actorUserId: "u_1",
      action: "approved",
      consentVersion: "1.0",
      raiVersion: "1",
      modifications: [],
      ipHash: null,
      createdAt: "2026-06-13T12:00:00.000Z",
    };
    for (const field of APPROVAL_RECORD_FIELDS) {
      expect(record).toHaveProperty(field);
    }
  });
});

describe("approval contract — predicates (ADR 0042)", () => {
  it("canTeach is true only for approved/amended", () => {
    expect(canTeach("approved")).toBe(true);
    expect(canTeach("amended")).toBe(true);
    expect(canTeach("pending_parent_review")).toBe(false);
    expect(canTeach("declined")).toBe(false);
    expect(canTeach(null)).toBe(false);
    expect(canTeach(undefined)).toBe(false);
    expect(canTeach("APPROVED")).toBe(false); // case-sensitive
  });

  it("isApprovalStatus / isApprovalRecordAction recognise the enums", () => {
    expect(isApprovalStatus("declined")).toBe(true);
    expect(isApprovalStatus("nope")).toBe(false);
    expect(isApprovalRecordAction("amended")).toBe(true);
    // 'pending_parent_review' is a lifecycle status, never a record action.
    expect(isApprovalRecordAction("pending_parent_review")).toBe(false);
  });
});

describe("approval contract — parseApprovalRecord (ADR 0042)", () => {
  const valid = {
    id: "bpa_1",
    tenantId: "t_1",
    learnerId: "lr_1",
    brainProfileId: "brp_1",
    profileRevision: 2,
    actorUserId: "u_1",
    action: "amended",
    consentVersion: "1.0",
    raiVersion: "2",
    modifications: [],
    ipHash: null,
    createdAt: "2026-06-13T12:00:00.000Z",
  };

  it("accepts a well-formed record", () => {
    const res = parseApprovalRecord(valid);
    expect(res.ok).toBe(true);
  });

  it("rejects a bad action and reports the field", () => {
    const res = parseApprovalRecord({ ...valid, action: "pending_parent_review" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.includes("action"))).toBe(true);
  });

  it("rejects a non-numeric revision and a non-array modifications", () => {
    const res = parseApprovalRecord({ ...valid, profileRevision: "1", modifications: {} });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.includes("profileRevision"))).toBe(true);
      expect(res.errors.some((e) => e.includes("modifications"))).toBe(true);
    }
  });

  it("rejects a non-object", () => {
    expect(parseApprovalRecord(null).ok).toBe(false);
    expect(parseApprovalRecord("x").ok).toBe(false);
  });
});

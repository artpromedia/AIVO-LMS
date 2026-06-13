/**
 * Sprint C-13 (ADR 0042-aligned) — the shared change contract, TS side parity.
 *
 * One definition of "what changed, was it structural, does the parent need to
 * re-acknowledge?" must hold across BOTH stacks. There is no shared TS<->Python
 * codegen, so this test pins the exact literal sets; the Python mirror
 * (services/brain-svc/tests/test_change_contract_parity.py) pins the same ones.
 * If either side drifts, its parity test fails.
 *
 * It also proves the contract's predicates + validator behave, and that the
 * web-v2 `LearnerBrainProfileChange` record type is constructible against the
 * shared contract shape.
 */
import { describe, it, expect } from "vitest";
import {
  BRAIN_CHANGE_KINDS,
  BRAIN_CHANGE_SOURCES,
  BRAIN_CHANGE_ACK_WINDOW_DAYS,
  BRAIN_CHANGE_REMINDER_AFTER_DAYS,
  BRAIN_CHANGE_RECORD_FIELDS,
  isBrainChangeKind,
  isBrainChangeSource,
  changeRequiresAck,
  parseBrainChangeRecord,
} from "@aivo/db";
import type { LearnerBrainProfileChange } from "@/lib/db/types";

describe("change contract — shared enum/field parity (ADR 0042)", () => {
  it("kinds match the cross-stack literal set", () => {
    expect([...BRAIN_CHANGE_KINDS]).toEqual(["mastery", "structural"]);
  });

  it("sources match the cross-stack literal set", () => {
    expect([...BRAIN_CHANGE_SOURCES]).toEqual([
      "baseline_reclone",
      "regenerate",
      "iep_update",
      "engagement_sync",
      "regression_detected",
      "amendment",
      "rollback",
    ]);
  });

  it("window constants match and the reminder fires inside the ack window", () => {
    expect(BRAIN_CHANGE_ACK_WINDOW_DAYS).toBe(14);
    expect(BRAIN_CHANGE_REMINDER_AFTER_DAYS).toBe(7);
    expect(BRAIN_CHANGE_REMINDER_AFTER_DAYS).toBeLessThan(BRAIN_CHANGE_ACK_WINDOW_DAYS);
  });

  it("record field list matches the canonical shape", () => {
    expect([...BRAIN_CHANGE_RECORD_FIELDS]).toEqual([
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
    ]);
  });

  it("the web LearnerBrainProfileChange type has every contract field", () => {
    const record: LearnerBrainProfileChange = {
      id: "bpc_1",
      tenantId: "t_1",
      learnerId: "lr_1",
      brainProfileId: "brp_1",
      revision: 2,
      kind: "structural",
      fields: ["accommodation.read_aloud"],
      summary: "Read-aloud turned on.",
      source: "baseline_reclone",
      requiresAck: true,
      ackedAt: null,
      reminderSentAt: null,
      createdAt: "2026-06-13T12:00:00.000Z",
    };
    for (const field of BRAIN_CHANGE_RECORD_FIELDS) {
      expect(record).toHaveProperty(field);
    }
  });
});

describe("change contract — predicates (ADR 0042)", () => {
  it("changeRequiresAck is true only for structural", () => {
    expect(changeRequiresAck("structural")).toBe(true);
    expect(changeRequiresAck("mastery")).toBe(false);
    expect(changeRequiresAck(null)).toBe(false);
    expect(changeRequiresAck("STRUCTURAL")).toBe(false); // case-sensitive
  });

  it("isBrainChangeKind / isBrainChangeSource recognise the enums", () => {
    expect(isBrainChangeKind("mastery")).toBe(true);
    expect(isBrainChangeKind("nope")).toBe(false);
    expect(isBrainChangeSource("engagement_sync")).toBe(true);
    expect(isBrainChangeSource("approved")).toBe(false);
  });
});

describe("change contract — parseBrainChangeRecord (ADR 0042)", () => {
  const valid = {
    id: "bpc_1",
    tenantId: "t_1",
    learnerId: "lr_1",
    brainProfileId: "brp_1",
    revision: 2,
    kind: "structural",
    fields: ["functioningLevel"],
    summary: "Level shifted.",
    source: "baseline_reclone",
    requiresAck: true,
    ackedAt: null,
    reminderSentAt: null,
    createdAt: "2026-06-13T12:00:00.000Z",
  };

  it("accepts a well-formed record", () => {
    expect(parseBrainChangeRecord(valid).ok).toBe(true);
  });

  it("rejects a bad kind and reports the field", () => {
    const res = parseBrainChangeRecord({ ...valid, kind: "nope" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.includes("kind"))).toBe(true);
  });

  it("rejects a mastery row that claims requiresAck", () => {
    const res = parseBrainChangeRecord({
      ...valid,
      kind: "mastery",
      requiresAck: true,
      fields: ["masteryLevels.math"],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.some((e) => e.includes("requiresAck"))).toBe(true);
  });

  it("rejects a non-numeric revision and a non-array fields", () => {
    const res = parseBrainChangeRecord({ ...valid, revision: "1", fields: {} });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.includes("revision"))).toBe(true);
      expect(res.errors.some((e) => e.includes("fields"))).toBe(true);
    }
  });

  it("rejects a non-object", () => {
    expect(parseBrainChangeRecord(null).ok).toBe(false);
    expect(parseBrainChangeRecord("x").ok).toBe(false);
  });
});

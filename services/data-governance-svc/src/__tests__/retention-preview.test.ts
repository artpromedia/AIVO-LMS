import { describe, it, expect } from "vitest";
import {
  previewRetention,
  retentionCutoff,
  isEligible,
  totalEligible,
  type RetentionPolicy,
  type RetentionRecord,
} from "../domain/retention-preview.js";

const NOW = new Date("2026-06-01T00:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

describe("retentionCutoff", () => {
  it("is null for indefinite retention or legal hold", () => {
    expect(retentionCutoff({ retentionDays: null, legalHold: false }, NOW)).toBeNull();
    expect(retentionCutoff({ retentionDays: 30, legalHold: true }, NOW)).toBeNull();
  });
  it("is now minus the window otherwise", () => {
    expect(retentionCutoff({ retentionDays: 30, legalHold: false }, NOW)?.toISOString()).toBe(
      "2026-05-02T00:00:00.000Z",
    );
  });
});

describe("isEligible", () => {
  const policy: RetentionPolicy = {
    dataClass: "chat_logs",
    retentionDays: 90,
    disposition: "purge",
    legalHold: false,
  };
  it("is true only for records older than the window", () => {
    expect(
      isEligible({ dataClass: "chat_logs", recordId: "a", createdAt: daysAgo(100) }, policy, NOW),
    ).toBe(true);
    expect(
      isEligible({ dataClass: "chat_logs", recordId: "b", createdAt: daysAgo(80) }, policy, NOW),
    ).toBe(false);
  });
  it("never eligible under legal hold", () => {
    const held = { ...policy, legalHold: true };
    expect(
      isEligible({ dataClass: "chat_logs", recordId: "a", createdAt: daysAgo(999) }, held, NOW),
    ).toBe(false);
  });
});

describe("previewRetention", () => {
  const policies: RetentionPolicy[] = [
    { dataClass: "chat_logs", retentionDays: 90, disposition: "purge", legalHold: false },
    {
      dataClass: "assessment_scores",
      retentionDays: 365,
      disposition: "anonymize",
      legalHold: false,
    },
    { dataClass: "audit_events", retentionDays: 2555, disposition: "anonymize", legalHold: true },
  ];
  const records: RetentionRecord[] = [
    { dataClass: "chat_logs", recordId: "c1", createdAt: daysAgo(120) }, // eligible
    { dataClass: "chat_logs", recordId: "c2", createdAt: daysAgo(30) }, // keep
    { dataClass: "assessment_scores", recordId: "a1", createdAt: daysAgo(400) }, // eligible
    { dataClass: "audit_events", recordId: "x1", createdAt: daysAgo(5000) }, // legal hold → keep
    { dataClass: "unmapped_class", recordId: "u1", createdAt: daysAgo(9999) }, // no policy → keep
  ];

  it("computes per-class eligible counts and disposition", () => {
    const preview = previewRetention({ policies, records, now: NOW });
    const chat = preview.find((p) => p.dataClass === "chat_logs")!;
    expect(chat.eligibleCount).toBe(1);
    expect(chat.eligibleRecordIds).toEqual(["c1"]);
    expect(chat.disposition).toBe("purge");

    const scores = preview.find((p) => p.dataClass === "assessment_scores")!;
    expect(scores.eligibleCount).toBe(1);
    expect(scores.disposition).toBe("anonymize");

    const audit = preview.find((p) => p.dataClass === "audit_events")!;
    expect(audit.eligibleCount).toBe(0); // legal hold
    expect(audit.cutoff).toBeNull();
  });

  it("never deletes records for a class with no configured policy (fail safe)", () => {
    const preview = previewRetention({ policies, records, now: NOW });
    const unmapped = preview.find((p) => p.dataClass === "unmapped_class")!;
    expect(unmapped.totalCount).toBe(1);
    expect(unmapped.eligibleCount).toBe(0);
  });

  it("rolls up a total across classes", () => {
    expect(totalEligible(previewRetention({ policies, records, now: NOW }))).toBe(2);
  });
});

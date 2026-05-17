import { describe, expect, it } from "vitest";
import { redactSensitivePayload, safeSummary } from "../services/problem-session-redaction.js";

describe("redactSensitivePayload", () => {
  it("returns empty object for missing payload", () => {
    const { redactedPayload, redactedKeys } = redactSensitivePayload(undefined);
    expect(redactedPayload).toEqual({});
    expect(redactedKeys).toEqual([]);
  });

  it("redacts known sensitive top-level keys", () => {
    const { redactedPayload, redactedKeys } = redactSensitivePayload({
      iepText: "Full IEP text",
      parentPrivateNotes: "Confidential note",
      medicalNotes: "Diagnosis info",
      ocrText: "Raw OCR string",
      safe: "ok",
    });
    expect(redactedPayload.iepText).toBe("[redacted]");
    expect(redactedPayload.parentPrivateNotes).toBe("[redacted]");
    expect(redactedPayload.medicalNotes).toBe("[redacted]");
    expect(redactedPayload.ocrText).toBe("[redacted]");
    expect(redactedPayload.safe).toBe("ok");
    expect(redactedKeys.sort()).toEqual(
      ["iepText", "medicalNotes", "ocrText", "parentPrivateNotes"].sort(),
    );
  });

  it("redacts nested sensitive keys", () => {
    const { redactedPayload, redactedKeys } = redactSensitivePayload({
      details: {
        rawIepText: "leak",
        nested: { learnerChat: "free form chat" },
      },
    });
    const details = redactedPayload.details as Record<string, unknown>;
    expect(details.rawIepText).toBe("[redacted]");
    expect((details.nested as Record<string, unknown>).learnerChat).toBe("[redacted]");
    expect(redactedKeys).toContain("details.rawIepText");
    expect(redactedKeys).toContain("details.nested.learnerChat");
  });

  it("truncates long string values for analytics safety", () => {
    const longText = "a".repeat(500);
    const { redactedPayload } = redactSensitivePayload({ note: longText });
    expect((redactedPayload.note as string).length).toBeLessThanOrEqual(201);
    expect((redactedPayload.note as string).endsWith("…")).toBe(true);
  });
});

describe("safeSummary", () => {
  it("collapses whitespace and trims", () => {
    expect(safeSummary("  hello\n\nworld  ")).toBe("hello world");
  });

  it("returns undefined for empty input", () => {
    expect(safeSummary(undefined)).toBeUndefined();
    expect(safeSummary("")).toBeUndefined();
  });
});

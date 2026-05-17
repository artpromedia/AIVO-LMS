import { describe, expect, it } from "vitest";
import { looksLikePii, redactAuditMetadata } from "../services/audit-redaction.js";

describe("redactAuditMetadata", () => {
  it("redacts top-level sensitive keys", () => {
    const result = redactAuditMetadata({
      parentPrivateNotes: "private",
      iepText: "long IEP",
      learnerName: "Alex",
    });
    expect(result.parentPrivateNotes).toBe("[redacted]");
    expect(result.iepText).toBe("[redacted]");
    expect(result.learnerName).toBe("Alex");
  });

  it("redacts nested sensitive keys", () => {
    const result = redactAuditMetadata({
      details: { medicalNotes: "diagnosis", visible: true },
    });
    const details = result.details as Record<string, unknown>;
    expect(details.medicalNotes).toBe("[redacted]");
    expect(details.visible).toBe(true);
  });

  it("redacts secrets and tokens", () => {
    const result = redactAuditMetadata({
      apiKey: "sk-abc",
      token: "tok-xyz",
      password: "shh",
    });
    expect(result.apiKey).toBe("[redacted]");
    expect(result.token).toBe("[redacted]");
    expect(result.password).toBe("[redacted]");
  });

  it("truncates very long values", () => {
    const long = "x".repeat(500);
    const result = redactAuditMetadata({ note: long });
    expect((result.note as string).length).toBeLessThanOrEqual(241);
    expect((result.note as string).endsWith("…")).toBe(true);
  });

  it("redacts identity / contact keys", () => {
    const result = redactAuditMetadata({
      ssn: "any",
      dob: "any",
      homeAddress: "any",
      phoneNumber: "any",
      parentEmail: "any",
    });
    for (const key of ["ssn", "dob", "homeAddress", "phoneNumber", "parentEmail"]) {
      expect(result[key]).toBe("[redacted]");
    }
  });

  it("redacts values that look like emails", () => {
    const result = redactAuditMetadata({ note: "Reach me at parent@example.com please." });
    expect(result.note).toBe("[redacted]");
  });

  it("redacts values that look like US SSNs", () => {
    const result = redactAuditMetadata({ note: "SSN is 123-45-6789." });
    expect(result.note).toBe("[redacted]");
  });

  it("redacts values that look like phone numbers", () => {
    const result = redactAuditMetadata({ note: "Call 415-555-1234 anytime." });
    expect(result.note).toBe("[redacted]");
  });

  it("redacts values that look like JWTs", () => {
    const result = redactAuditMetadata({
      note: "Token: eyJabcdefghij.eyJklmnopqrst.uvwxyz123456",
    });
    expect(result.note).toBe("[redacted]");
  });

  it("redacts values that look like API keys", () => {
    const result = redactAuditMetadata({
      note: "key sk_live_AAAAAAAAAAAAAAAAAAAA in payload",
    });
    expect(result.note).toBe("[redacted]");
  });

  it("redacts keys matched by the sensitive pattern (e.g. user_secret)", () => {
    const result = redactAuditMetadata({
      user_secret: "x",
      session_id: "y",
      access_token: "z",
      benign_field: "ok",
    });
    expect(result.user_secret).toBe("[redacted]");
    expect(result.session_id).toBe("[redacted]");
    expect(result.access_token).toBe("[redacted]");
    expect(result.benign_field).toBe("ok");
  });

  it("redacts entries inside arrays", () => {
    const result = redactAuditMetadata({
      contacts: [{ phoneNumber: "x" }, { email: "ok" }],
    });
    const contacts = result.contacts as Array<Record<string, unknown>>;
    expect(contacts[0].phoneNumber).toBe("[redacted]");
  });
});

describe("looksLikePii", () => {
  it("detects emails, SSNs, phones, JWTs, API keys", () => {
    expect(looksLikePii("parent@example.com")).toBe(true);
    expect(looksLikePii("123-45-6789")).toBe(true);
    expect(looksLikePii("(415) 555-1234")).toBe(true);
    expect(looksLikePii("eyJaaaaaaaaa.eyJbbbbbbbbb.cccccccccc")).toBe(true);
    expect(looksLikePii("sk_live_AAAAAAAAAAAAAAAAAAAA")).toBe(true);
  });

  it("returns false for benign strings", () => {
    expect(looksLikePii("Hello, world.")).toBe(false);
    expect(looksLikePii("")).toBe(false);
  });
});

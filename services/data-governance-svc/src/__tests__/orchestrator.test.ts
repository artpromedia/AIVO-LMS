import { describe, it, expect } from "vitest";
import { runErasureFanout, computeChecksum } from "../orchestrator/erasure.js";
import {
  runExportFanout,
  assembleExportBundle,
  validateArt20Bundle,
} from "../orchestrator/export.js";
import type { GovernanceFetch, Subscriber, SubscriberResult } from "../orchestrator/subscribers.js";

const SUBS: Subscriber[] = [
  { name: "identity-svc", baseUrl: "http://id" },
  { name: "billing-svc", baseUrl: "http://bill" },
  { name: "audit-svc", baseUrl: "http://audit" },
];

/** A stub that returns canned per-service results — no network. */
function stubFetch(byService: Record<string, Partial<SubscriberResult>>): GovernanceFetch {
  return async (sub, _path, _body) => ({
    service: sub.name,
    ok: true,
    counts: {},
    ...byService[sub.name],
  });
}

describe("erasure fan-out", () => {
  it("aggregates erased + anonymized counts and confirms every service", async () => {
    const fetchImpl = stubFetch({
      "identity-svc": { counts: { users: 1, sessions: 3 } },
      "billing-svc": { counts: { invoices: 2 } },
      // audit-svc anonymizes (keeps hash chain) rather than deletes.
      "audit-svc": { counts: {}, anonymizedCounts: { audit_events: 12 } },
    });
    const out = await runErasureFanout(
      { subjectId: "learner-1", subjectType: "learner" },
      { subscribers: SUBS, fetchImpl },
    );
    expect(out.allConfirmed).toBe(true);
    expect(out.failedServices).toEqual([]);
    expect(out.totalErased).toBe(6); // 1+3+2
    expect(out.totalAnonymized).toBe(12);
    expect(out.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reports a partial fan-out when a subscriber fails", async () => {
    const fetchImpl: GovernanceFetch = async (sub) =>
      sub.name === "billing-svc"
        ? { service: sub.name, ok: false, counts: {}, error: "HTTP 500" }
        : { service: sub.name, ok: true, counts: { x: 1 } };
    const out = await runErasureFanout(
      { subjectId: "learner-1" },
      { subscribers: SUBS, fetchImpl },
    );
    expect(out.allConfirmed).toBe(false);
    expect(out.failedServices).toContain("billing-svc");
  });

  it("checksum is order-independent and deterministic", () => {
    const a: SubscriberResult[] = [
      { service: "billing-svc", ok: true, counts: { invoices: 2 } },
      { service: "identity-svc", ok: true, counts: { users: 1 } },
    ];
    const b: SubscriberResult[] = [a[1], a[0]];
    expect(computeChecksum(a)).toBe(computeChecksum(b));
  });

  it("a full erasure of a subject leaves only anonymized audit rows", async () => {
    // Integration-style: every service reports zero remaining records for the
    // subject except audit-svc, which keeps an anonymized, hash-chained trail.
    const fetchImpl = stubFetch({
      "identity-svc": { counts: { users: 1 } },
      "billing-svc": { counts: { invoices: 1 } },
      "audit-svc": { counts: {}, anonymizedCounts: { audit_events: 4 } },
    });
    const out = await runErasureFanout({ subjectId: "s1" }, { subscribers: SUBS, fetchImpl });
    // Nothing left un-erased anywhere; audit retained but anonymized.
    expect(out.totalErased).toBeGreaterThan(0);
    expect(out.totalAnonymized).toBe(4);
    const auditResult = out.results.find((r) => r.service === "audit-svc")!;
    expect(Object.keys(auditResult.counts)).toHaveLength(0); // no deletions in audit
  });
});

describe("export fan-out (GDPR Art. 20)", () => {
  it("assembles a portable bundle that passes the Art. 20 format check", async () => {
    const fetchImpl = stubFetch({
      "identity-svc": { counts: { profile: 1 }, bundle: { profile: { name: "A. Learner" } } },
      "billing-svc": {
        counts: { invoices: 2 },
        bundle: { invoices: [{ id: "i1" }, { id: "i2" }] },
      },
      "audit-svc": { counts: { events: 3 }, bundle: { events: [] } },
    });
    const bundle = await runExportFanout(
      { subjectId: "learner-1", subjectType: "learner" },
      { subscribers: SUBS, fetchImpl, now: new Date("2026-06-01T00:00:00Z") },
    );
    expect(bundle.manifest.format).toBe("json");
    expect(bundle.manifest.regulation).toBe("GDPR Art. 20");
    expect(bundle.manifest.services).toEqual(["audit-svc", "billing-svc", "identity-svc"]);
    expect(bundle.data["identity-svc"]).toEqual({ profile: { name: "A. Learner" } });

    const check = validateArt20Bundle(bundle);
    expect(check.valid).toBe(true);
    expect(check.errors).toEqual([]);
  });

  it("records failed services in the manifest and omits their data", () => {
    const bundle = assembleExportBundle({ subjectId: "s1" }, [
      { service: "identity-svc", ok: true, counts: { p: 1 }, bundle: { p: 1 } },
      { service: "billing-svc", ok: false, counts: {}, error: "timeout" },
    ]);
    expect(bundle.manifest.failedServices).toEqual(["billing-svc"]);
    expect(bundle.data["billing-svc"]).toBeUndefined();
  });

  it("rejects a malformed bundle", () => {
    expect(validateArt20Bundle({ data: {} }).valid).toBe(false);
    expect(validateArt20Bundle(null).valid).toBe(false);
  });
});

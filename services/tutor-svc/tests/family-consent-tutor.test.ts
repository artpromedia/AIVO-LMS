/**
 * Phase 5 — generic family-consent gate (`verifyTutorConsent`) and the
 * dev short-circuit shared with Speech Buddy.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { verifyTutorConsent, ConsentError } from "../src/lib/familyConsent.js";

const ORIGINAL_FETCH = globalThis.fetch;

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(snapshot)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("verifyTutorConsent (Phase 5)", () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = {
      TUTOR_DEV_CONSENTS: process.env.TUTOR_DEV_CONSENTS,
      SPEECH_BUDDY_DEV_CONSENTS: process.env.SPEECH_BUDDY_DEV_CONSENTS,
      FAMILY_SVC_URL: process.env.FAMILY_SVC_URL,
    };
    delete process.env.TUTOR_DEV_CONSENTS;
    delete process.env.SPEECH_BUDDY_DEV_CONSENTS;
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("dev short-circuit returns the configured consent id", async () => {
    process.env.TUTOR_DEV_CONSENTS = "tenant1:learner1:dev-consent-id";
    const id = await verifyTutorConsent({
      tenantId: "tenant1",
      learnerId: "learner1",
      tutorKey: "harmony",
    });
    assert.equal(id, "dev-consent-id");
  });

  it("dev short-circuit honours optional tutor-key scope", async () => {
    process.env.TUTOR_DEV_CONSENTS = "tenant1:learner1:dev-consent-id:harmony";
    const ok = await verifyTutorConsent({
      tenantId: "tenant1",
      learnerId: "learner1",
      tutorKey: "harmony",
    });
    assert.equal(ok, "dev-consent-id");
    // Different tutor: dev entry should not match → falls through to fetch.
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response(null, { status: 404 });
    };
    await assert.rejects(
      verifyTutorConsent({
        tenantId: "tenant1",
        learnerId: "learner1",
        tutorKey: "compass",
      }),
      ConsentError,
    );
    assert.ok(fetchCalled, "fetch should be invoked when dev entry doesn't match the tutor");
  });

  it("returns the consent id from a granted family-svc response", async () => {
    let receivedBody: any = null;
    globalThis.fetch = async (_url, init) => {
      receivedBody = JSON.parse((init as any).body as string);
      return new Response(JSON.stringify({ granted: true, consentRecordId: "rec-7" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const id = await verifyTutorConsent({
      tenantId: "t",
      learnerId: "l",
      tutorKey: "compass",
      ageBand: "10-12",
    });
    assert.equal(id, "rec-7");
    assert.equal(receivedBody.tutorKey, "compass");
    assert.equal(receivedBody.ageBand, "10-12");
  });

  it("throws 403 ConsentError on 404 (no consent on file)", async () => {
    globalThis.fetch = async () => new Response(null, { status: 404 });
    await assert.rejects(
      verifyTutorConsent({ tenantId: "t", learnerId: "l", tutorKey: "harmony" }),
      (err: unknown) => err instanceof ConsentError && err.status === 403,
    );
  });

  it("throws 403 ConsentError when family-svc reports revoked", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ granted: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    await assert.rejects(
      verifyTutorConsent({ tenantId: "t", learnerId: "l", tutorKey: "harmony" }),
      (err: unknown) => err instanceof ConsentError && err.status === 403,
    );
  });

  it("throws 502 ConsentError on network failure", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("network down");
    };
    await assert.rejects(
      verifyTutorConsent({ tenantId: "t", learnerId: "l", tutorKey: "harmony" }),
      (err: unknown) => err instanceof ConsentError && err.status === 502,
    );
  });
});

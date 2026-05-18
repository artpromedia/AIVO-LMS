import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SPEECH_BUDDY_MODE_ID,
  type StartSessionInput,
  type TurnInput,
} from "../src/modes/speechBuddy.js";
import { aiSvc, __testing as aiTesting } from "../src/lib/aiSvc.js";
import { ConsentError, verifyConsent } from "../src/lib/familyConsent.js";

describe("tutor-svc speech buddy mode scaffold", () => {
  it("exports a stable mode id", () => {
    assert.equal(SPEECH_BUDDY_MODE_ID, "speech_buddy");
  });

  it("StartSessionInput requires consentRecordId at the type level (smoke check)", () => {
    const input: StartSessionInput = {
      tenantId: "t1",
      learnerId: "l1",
      ageBand: "6-9",
      locale: "en",
      consentRecordId: "c1",
    };
    assert.equal(input.consentRecordId, "c1");
  });

  it("TurnInput exposes the post-PII-scrub child utterance field", () => {
    const t: TurnInput = { sessionId: "s1", childUtterance: "hi" };
    assert.equal(t.childUtterance, "hi");
  });
});

describe("tutor-svc → ai-svc speech buddy client", () => {
  it("targets the configured ai-svc base URL", () => {
    assert.ok(aiTesting.AI_SVC_URL.startsWith("http"));
  });

  it("sends the internal-service header on every call", async () => {
    const seenHeaders: Record<string, string>[] = [];
    const seenUrls: string[] = [];
    const realFetch = globalThis.fetch;
    (globalThis as any).fetch = async (url: string, init: any) => {
      seenUrls.push(url);
      seenHeaders.push(init.headers as Record<string, string>);
      return new Response(
        JSON.stringify({
          sessionId: "sx",
          ageBand: "6-9",
          locale: "en",
          nicknameToken: "Buddy",
          state: "greet",
          startedAt: "now",
          targetedSkills: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      await aiSvc.startSession({
        tenantId: "t1",
        learnerId: "l1",
        ageBand: "6-9",
        locale: "en",
        consentRecordId: "c1",
      });
    } finally {
      (globalThis as any).fetch = realFetch;
    }
    assert.equal(seenUrls.length, 1);
    assert.match(seenUrls[0], /\/api\/ai\/speech-buddy\/sessions$/);
    assert.ok(seenHeaders[0]["x-internal-key"], "x-internal-key header missing");
  });

  it("propagates ai-svc 4xx into a typed error with status", async () => {
    const realFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify({ detail: "session not found" }), { status: 404 });
    try {
      await aiSvc.runTurn("does-not-exist", { text: "hi" });
      assert.fail("expected runTurn to throw");
    } catch (err: any) {
      assert.equal(err.status, 404);
      assert.match(err.message, /session not found/);
    } finally {
      (globalThis as any).fetch = realFetch;
    }
  });

  it("forwards owner (tenantId, learnerId) headers on turn/end so ai-svc can enforce ownership", async () => {
    const seenHeaders: Record<string, string>[] = [];
    const realFetch = globalThis.fetch;
    (globalThis as any).fetch = async (_url: string, init: any) => {
      seenHeaders.push(init.headers as Record<string, string>);
      return new Response(
        JSON.stringify({
          buddyText: "ok",
          buddyAudioBase64: "",
          nextState: "roleplayTurn",
          ended: false,
          endedReason: null,
          trace: {},
          safetyFlags: [],
          skillEvidence: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    try {
      await aiSvc.runTurn("sess-1", { text: "hi" }, { tenantId: "tenant-A", learnerId: "child-7" });
      await aiSvc.endSession("sess-1", "completed", { tenantId: "tenant-A", learnerId: "child-7" });
    } finally {
      (globalThis as any).fetch = realFetch;
    }
    assert.equal(seenHeaders.length, 2);
    for (const h of seenHeaders) {
      assert.equal(h["x-aivo-tenant-id"], "tenant-A");
      assert.equal(h["x-aivo-learner-id"], "child-7");
      assert.ok(h["x-internal-key"], "x-internal-key still required alongside ownership");
    }
  });

  it("forwards an AbortSignal so the WS layer can cancel an in-flight turn on barge-in", async () => {
    const realFetch = globalThis.fetch;
    let observedSignal: AbortSignal | undefined;
    let aborted = false;
    (globalThis as any).fetch = (_url: string, init: any) => {
      observedSignal = init.signal;
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          aborted = true;
          const e: any = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      });
    };
    const ac = new AbortController();
    const p = aiSvc.runTurn(
      "s",
      { text: "hi" },
      { tenantId: "t", learnerId: "l" },
      { signal: ac.signal },
    );
    setTimeout(() => ac.abort(), 5);
    try {
      await p;
      assert.fail("expected abort to reject");
    } catch (err: any) {
      assert.equal(err.name, "AbortError");
      assert.ok(observedSignal, "fetch should have received an AbortSignal");
      assert.equal(aborted, true);
    } finally {
      (globalThis as any).fetch = realFetch;
    }
  });

  it("returns base64 buddy audio in TurnResponse so the WS layer can stream it back", async () => {
    const realFetch = globalThis.fetch;
    const audio = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00]).toString("base64");
    (globalThis as any).fetch = async () =>
      new Response(
        JSON.stringify({
          buddyText: "hi friend",
          buddyAudioBase64: audio,
          nextState: "roleplayTurn",
          ended: false,
          endedReason: null,
          trace: {},
          safetyFlags: [],
          skillEvidence: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    try {
      const r = await aiSvc.runTurn("s", { text: "hi" }, { tenantId: "t", learnerId: "l" });
      assert.equal(r.buddyAudioBase64, audio);
      assert.ok(r.buddyAudioBase64.length > 0);
    } finally {
      (globalThis as any).fetch = realFetch;
    }
  });
});

describe("tutor-svc family-consent gate", () => {
  it("short-circuits via SPEECH_BUDDY_DEV_CONSENTS allow-list", async () => {
    process.env.SPEECH_BUDDY_DEV_CONSENTS = "tA:lA:cA,tB:lB:cB";
    const id = await verifyConsent({ tenantId: "tA", learnerId: "lA", ageBand: "6-9" });
    assert.equal(id, "cA");
  });

  it("ConsentError is thrown when family-svc returns 404", async () => {
    delete process.env.SPEECH_BUDDY_DEV_CONSENTS;
    const realFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify({ granted: false }), { status: 404 });
    try {
      await verifyConsent({ tenantId: "tX", learnerId: "lX", ageBand: "6-9" });
      assert.fail("expected ConsentError");
    } catch (err: any) {
      assert.ok(err instanceof ConsentError, `got ${err}`);
      assert.equal(err.status, 403);
    } finally {
      (globalThis as any).fetch = realFetch;
    }
  });

  it("ConsentError is thrown when granted=false even with 200", async () => {
    delete process.env.SPEECH_BUDDY_DEV_CONSENTS;
    const realFetch = globalThis.fetch;
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify({ granted: false }), { status: 200 });
    try {
      await verifyConsent({ tenantId: "tX", learnerId: "lX", ageBand: "10-12" });
      assert.fail("expected ConsentError");
    } catch (err: any) {
      assert.ok(err instanceof ConsentError);
      assert.equal(err.status, 403);
    } finally {
      (globalThis as any).fetch = realFetch;
    }
  });
});

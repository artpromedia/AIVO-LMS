/**
 * Sprint 12.7 — push router tests.
 *
 * The real FCM / APNs adapters require network + provider creds, which
 * CI doesn't have. We inject mock adapters into PushRouter so the test
 * exercises the fan-out / partial-failure / invalidToken plumbing
 * without making outbound calls.
 */
import { test } from "node:test";
import assert from "node:assert";
import { PushRouter, type PushAdapter } from "../src/providers/push-router.js";

function adapterReturning(result: Partial<{ ok: boolean; invalidToken: boolean }> | "throw"): PushAdapter {
  return {
    send: async (target) => {
      if (result === "throw") throw new Error("network down");
      return {
        token: target.token,
        kind: target.kind,
        ok: result.ok ?? false,
        invalidToken: result.invalidToken ?? false,
      };
    },
  };
}

test("partial-failure fan-out: bad token does not abort the others", async () => {
  let n = 0;
  const flaky: PushAdapter = {
    send: async (target) => {
      n += 1;
      if (n === 2) throw new Error("ENOTFOUND");
      return { token: target.token, kind: target.kind, ok: true, invalidToken: false };
    },
  };
  const router = new PushRouter({ fcm: flaky });
  const results = await router.send(
    [
      { token: "a", kind: "fcm" },
      { token: "b", kind: "fcm" },
      { token: "c", kind: "fcm" },
    ],
    { title: "t", body: "b" },
  );
  assert.strictEqual(results.length, 3);
  assert.deepStrictEqual(
    results.map((r) => r.ok),
    [true, false, true],
  );
  assert.match(results[1].error ?? "", /ENOTFOUND/);
});

test("invalid token is surfaced for caller cleanup", async () => {
  const router = new PushRouter({ fcm: adapterReturning({ ok: false, invalidToken: true }) });
  const results = await router.send([{ token: "stale", kind: "fcm" }], {});
  assert.strictEqual(results[0].invalidToken, true);
  assert.strictEqual(results[0].ok, false);
});

test("router routes APNs vs FCM targets to the right adapter", async () => {
  const seen: string[] = [];
  const fcm: PushAdapter = {
    send: async (t) => {
      seen.push(`fcm:${t.token}`);
      return { token: t.token, kind: t.kind, ok: true, invalidToken: false };
    },
  };
  const apns: PushAdapter = {
    send: async (t) => {
      seen.push(`apns:${t.token}`);
      return { token: t.token, kind: t.kind, ok: true, invalidToken: false };
    },
  };
  const router = new PushRouter({ fcm, apns });
  await router.send(
    [
      { token: "1", kind: "fcm" },
      { token: "2", kind: "apns" },
      { token: "3", kind: "fcm" },
    ],
    {},
  );
  assert.deepStrictEqual(seen.sort(), ["apns:2", "fcm:1", "fcm:3"]);
});

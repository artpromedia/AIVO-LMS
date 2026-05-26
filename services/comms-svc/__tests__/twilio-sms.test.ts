/**
 * Sprint 13 — Twilio SMS provider + STOP webhook tests.
 *
 * Covers:
 *   - TwilioSmsProvider.send happy-path (uses injected fetch mock)
 *   - TwilioSmsProvider.send refuses when user is opted out
 *   - verifyTwilioSignature accepts a signed payload
 *   - verifyTwilioSignature rejects a tampered payload
 *   - classifyInboundKeyword handles STOP / START / other
 */
import { test } from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import {
  TwilioSmsProvider,
  verifyTwilioSignature,
  classifyInboundKeyword,
} from "../src/providers/twilio-sms.js";

const ACCOUNT = "ACfake";
const TOKEN = "fake-token";
const FROM = "+15555550100";
const SECRET = "secret-sig-key";

test("TwilioSmsProvider.send POSTs to the Messages.json endpoint", async () => {
  let captured: { url: string; init: any } | null = null;
  const fetchImpl = async (url: any, init: any) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ sid: "SM123" }), { status: 200 });
  };
  const provider = new TwilioSmsProvider({
    accountSid: ACCOUNT,
    authToken: TOKEN,
    fromNumber: FROM,
    fetchImpl: fetchImpl as any,
  });
  const result = await provider.send({ to: "+15555550111", body: "hello" });
  assert.equal(result.status, "sent");
  assert.equal(result.sid, "SM123");
  assert.ok(captured, "fetch was called");
  assert.ok(captured!.url.includes(ACCOUNT));
  assert.ok(captured!.url.endsWith("/Messages.json"));
  assert.equal(captured!.init.method, "POST");
});

test("TwilioSmsProvider.send is skipped when user has opted out", async () => {
  const fetchImpl = async () => {
    throw new Error("should not call Twilio");
  };
  const provider = new TwilioSmsProvider({
    accountSid: ACCOUNT,
    authToken: TOKEN,
    fromNumber: FROM,
    fetchImpl: fetchImpl as any,
    isSmsOptedIn: async () => false,
  });
  const result = await provider.send({ to: "+15555550111", body: "hi", userId: "u1" });
  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "user_opted_out");
});

test("TwilioSmsProvider.send returns 'skipped' when env is missing", async () => {
  const provider = new TwilioSmsProvider({
    accountSid: "",
    authToken: "",
    fromNumber: "",
  });
  const result = await provider.send({ to: "+15555550111", body: "hi" });
  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "twilio_not_configured");
});

test("verifyTwilioSignature accepts a correctly-signed request", () => {
  const url = "https://example.test/api/comms/sms/inbound";
  const params: Record<string, string> = {
    From: "+15551234567",
    Body: "STOP",
    To: FROM,
  };
  const keys = Object.keys(params).sort();
  let data = url;
  for (const k of keys) data += k + params[k];
  const sig = createHmac("sha1", SECRET).update(data).digest("base64");
  const ok = verifyTwilioSignature({ signingSecret: SECRET, url, params, header: sig });
  assert.equal(ok, true);
});

test("verifyTwilioSignature rejects a tampered request", () => {
  const url = "https://example.test/api/comms/sms/inbound";
  const params: Record<string, string> = { From: "+15551234567", Body: "STOP" };
  const sig = createHmac("sha1", SECRET).update("WRONG_DATA").digest("base64");
  const ok = verifyTwilioSignature({ signingSecret: SECRET, url, params, header: sig });
  assert.equal(ok, false);
});

test("verifyTwilioSignature rejects missing header", () => {
  const ok = verifyTwilioSignature({
    signingSecret: SECRET,
    url: "https://example.test/x",
    params: {},
    header: undefined,
  });
  assert.equal(ok, false);
});

test("classifyInboundKeyword recognises STOP variants and START variants", () => {
  assert.equal(classifyInboundKeyword("STOP"), "stop");
  assert.equal(classifyInboundKeyword("stop"), "stop");
  assert.equal(classifyInboundKeyword("Unsubscribe"), "stop");
  assert.equal(classifyInboundKeyword("CANCEL"), "stop");
  assert.equal(classifyInboundKeyword("START"), "start");
  assert.equal(classifyInboundKeyword("yes"), "start");
  assert.equal(classifyInboundKeyword("hello there"), "other");
});

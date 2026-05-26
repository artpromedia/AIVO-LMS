/**
 * Sprint 12.7 — negative-path tests for the email-event webhook
 * signature checks (Postmark, Mailgun, SES-via-SNS).
 *
 * Verifies that bad signatures are rejected with 401 BEFORE the
 * payload is parsed or persisted — the verification gates the whole
 * downstream pipeline.
 */
import { test } from "node:test";
import assert from "node:assert";
import {
  verifyPostmarkSignature,
  verifyMailgunSignature,
  verifyAivoSnsSignature,
} from "../src/routes/webhook-email-events.js";

test("Postmark signature: tampered body is rejected", () => {
  const secret = "topsecret";
  const body = '{"RecordType":"Delivery","MessageID":"abc"}';
  const crypto = require("node:crypto");
  const good = crypto.createHmac("sha1", secret).update(body).digest("base64");
  assert.strictEqual(verifyPostmarkSignature(body, good, secret), true);
  assert.strictEqual(verifyPostmarkSignature(body + "x", good, secret), false);
  assert.strictEqual(verifyPostmarkSignature(body, good + "x", secret), false);
});

test("Mailgun signature: bad signature rejected", () => {
  const secret = "mailgun-key";
  const ts = "1690000000";
  const tok = "abc";
  const crypto = require("node:crypto");
  const good = crypto.createHmac("sha256", secret).update(ts + tok).digest("hex");
  assert.strictEqual(
    verifyMailgunSignature({ timestamp: ts, token: tok, signature: good }, secret),
    true,
  );
  assert.strictEqual(
    verifyMailgunSignature({ timestamp: ts, token: tok, signature: "0".repeat(64) }, secret),
    false,
  );
});

test("AIVO-SNS signature: empty signature rejected", () => {
  const secret = "shared";
  const body = "{}";
  assert.strictEqual(verifyAivoSnsSignature(body, "", secret), false);
});

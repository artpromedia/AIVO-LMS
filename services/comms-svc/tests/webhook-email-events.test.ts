/**
 * Sprint 7 — `/api/comms/webhook/email-events` integration tests.
 *
 * Drives signed Postmark, Mailgun, and SES payloads through the Fastify app
 * and asserts each provider's signature scheme is enforced. (Task #64)
 */
import { test } from "node:test";
import assert from "node:assert";
import { createHmac } from "node:crypto";
import {
  normalizeMailgun,
  normalizePostmark,
  normalizeSes,
  registerEmailEventsRoutes,
  verifyMailgunSignature,
} from "../src/routes/webhook-email-events.js";

const ORIG_ENV = { ...process.env };

function restoreEnv() {
  process.env = { ...ORIG_ENV };
}

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const app = Fastify();
  const recorded: any[] = [];
  registerEmailEventsRoutes(app, {
    recordEvent: async (e) => {
      recorded.push(e);
    },
  });
  await app.ready();
  return { app, recorded };
}

test("rejects an unsigned Postmark payload", async () => {
  process.env.POSTMARK_WEBHOOK_SECRET = "secret";
  const { app } = await bootstrap();
  const res = await app.inject({
    method: "POST",
    url: "/api/comms/webhook/email-events",
    headers: { "content-type": "application/json", "x-email-provider": "postmark" },
    payload: JSON.stringify({ MessageID: "m1", RecordType: "Delivery" }),
  });
  assert.equal(res.statusCode, 401);
  await app.close();
  restoreEnv();
});

test("accepts a signed Postmark payload and normalizes the event", async () => {
  process.env.POSTMARK_WEBHOOK_SECRET = "secret";
  const { app, recorded } = await bootstrap();
  const body = JSON.stringify({
    MessageID: "m1",
    RecordType: "Delivery",
    Email: "user@example.com",
    DeliveredAt: "2026-04-25T12:00:00Z",
  });
  const sig = createHmac("sha1", "secret").update(body).digest("base64");
  const res = await app.inject({
    method: "POST",
    url: "/api/comms/webhook/email-events",
    headers: {
      "content-type": "application/json",
      "x-email-provider": "postmark",
      "x-postmark-signature": sig,
    },
    payload: body,
  });
  assert.equal(res.statusCode, 200);
  assert.equal(recorded[0].provider, "postmark");
  assert.equal(recorded[0].type, "delivered");
  await app.close();
  restoreEnv();
});

test("verifies Mailgun timestamp+token signature", () => {
  const secret = "key-mg";
  const timestamp = "1700000000";
  const token = "tok-abc";
  const signature = createHmac("sha256", secret).update(timestamp + token).digest("hex");
  assert.equal(
    verifyMailgunSignature({ timestamp, token, signature }, secret),
    true,
  );
  assert.equal(
    verifyMailgunSignature({ timestamp, token, signature: "0".repeat(64) }, secret),
    false,
  );
});

test("normalizes Mailgun event-data shape", () => {
  const ev = normalizeMailgun({
    "event-data": {
      event: "delivered",
      timestamp: 1_700_000_000,
      recipient: "to@example.com",
      message: { headers: { "message-id": "<x@mg>" } },
    },
  });
  assert.ok(ev);
  assert.equal(ev?.provider, "mailgun");
  assert.equal(ev?.type, "delivered");
  assert.equal(ev?.recipient, "to@example.com");
});

test("normalizes SES SNS-relayed Bounce notification", () => {
  const ev = normalizeSes({
    Message: JSON.stringify({
      eventType: "Bounce",
      mail: {
        messageId: "ses-id",
        timestamp: "2026-04-25T12:00:00Z",
        destination: ["to@example.com"],
      },
    }),
  });
  assert.ok(ev);
  assert.equal(ev?.provider, "ses");
  assert.equal(ev?.type, "bounced");
  assert.equal(ev?.messageId, "ses-id");
});

test("Postmark normalizer ignores unknown record types", () => {
  const ev = normalizePostmark({ MessageID: "m", RecordType: "WeirdEvent" });
  assert.equal(ev, null);
});

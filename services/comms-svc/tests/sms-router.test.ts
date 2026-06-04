import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getSmsAdapter,
  isSmsConfigured,
  sendSms,
  _resetSmsAdapterForTest,
  type SmsAdapter,
} from "../src/providers/sms-router.js";
import { CHANNELS, isChannelAllowedForTenant, snapshotChannelStatus } from "../src/lib/channels.js";

test("defaults to the disabled adapter when no provider is configured", () => {
  delete process.env.SMS_PROVIDER;
  _resetSmsAdapterForTest();
  assert.equal(getSmsAdapter().name, "disabled");
  assert.equal(isSmsConfigured(), false);
});

test("disabled adapter never sends and reports status 'disabled'", async () => {
  delete process.env.SMS_PROVIDER;
  _resetSmsAdapterForTest();
  const result = await sendSms({ to: "+15555550100", body: "hi" });
  assert.equal(result.status, "disabled");
  assert.equal(result.messageId, undefined);
});

test("activates the twilio adapter only when fully configured", () => {
  process.env.SMS_PROVIDER = "twilio";
  process.env.TWILIO_ACCOUNT_SID = "AC123";
  process.env.TWILIO_AUTH_TOKEN = "tok";
  process.env.TWILIO_FROM_NUMBER = "+15555550101";
  _resetSmsAdapterForTest();
  assert.equal(getSmsAdapter().name, "twilio");
  assert.equal(isSmsConfigured(), true);

  // Missing creds → falls back to disabled.
  delete process.env.TWILIO_AUTH_TOKEN;
  _resetSmsAdapterForTest();
  assert.equal(getSmsAdapter().name, "disabled");
});

test("sendSms routes through an injected adapter", async () => {
  const sent: string[] = [];
  const fake: SmsAdapter = {
    name: "fake",
    async send(msg) {
      sent.push(`${msg.to}:${msg.body}`);
      return { status: "sent", messageId: "m1" };
    },
  };
  const result = await sendSms({ to: "+15555550100", body: "hello" }, fake);
  assert.equal(result.status, "sent");
  assert.equal(result.messageId, "m1");
  assert.deepEqual(sent, ["+15555550100:hello"]);
});

// ── channel registry + per-tenant opt-out ─────────────────────────────────
// These pin the contract the notifications route relies on: a
// tenant-denylist hit must report "not allowed" so the route can return
// a typed `channel_disabled` with audit instead of issuing a fake send.

test("channel registry lists SMS as a first-class real channel", () => {
  assert.equal(CHANNELS.sms.id, "sms");
  assert.equal(CHANNELS.sms.mode, "real");
  assert.ok(CHANNELS.sms.requires.includes("SMS_PROVIDER"));
  assert.equal(typeof CHANNELS.sms.isConfigured, "function");
});

test("per-tenant opt-out blocks SMS for denylisted tenants only", () => {
  process.env.SMS_TENANT_DENYLIST = "tenant-blocked,tenant-also-blocked";
  assert.equal(isChannelAllowedForTenant("sms", "tenant-blocked"), false);
  assert.equal(isChannelAllowedForTenant("sms", "tenant-also-blocked"), false);
  assert.equal(isChannelAllowedForTenant("sms", "tenant-allowed"), true);
  // Platform-level sends (no tenant context) are not blocked by tenant
  // denylist — caller's responsibility to gate at a higher layer.
  assert.equal(isChannelAllowedForTenant("sms", null), true);
  // Other channels are not affected by the SMS denylist.
  assert.equal(isChannelAllowedForTenant("email", "tenant-blocked"), true);
  delete process.env.SMS_TENANT_DENYLIST;
});

test("snapshotChannelStatus surfaces sms with configured=false when disabled", () => {
  delete process.env.SMS_PROVIDER;
  _resetSmsAdapterForTest();
  const snap = snapshotChannelStatus();
  assert.equal(snap.sms.mode, "real");
  assert.equal(snap.sms.configured, false);
  // Email/push/in_app are also represented so a new channel doesn't get
  // lost in a future review.
  assert.ok(snap.email);
  assert.ok(snap.push);
  assert.equal(snap.in_app.configured, true);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getSmsAdapter,
  isSmsConfigured,
  sendSms,
  _resetSmsAdapterForTest,
  type SmsAdapter,
} from "../src/providers/sms-router.js";

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

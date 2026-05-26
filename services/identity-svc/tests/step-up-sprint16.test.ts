/**
 * Sprint 16 step-up middleware coverage.
 *
 * Covers the production-mode shim added in
 * `src/middleware/step-up.ts`: routes requiring step-up reject without
 * a token, expired/invalid tokens surface a `STEP_UP_REQUIRED` code,
 * and a freshly-issued token grants a short-lived elevated session
 * (single-use jti, 5-minute TTL).
 *
 * The legacy/general step-up tests live next door in `step-up.test.ts`
 * (Sprint 3); this file scopes to the production-mode and lifecycle
 * assertions introduced in Sprint 16.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { issueStepUpToken } from "../src/services/step-up.js";
import { requireStepUp, requireStepUpProd } from "../src/middleware/step-up.js";
import * as security from "@aivo/security";

const USER = {
  sub: "31111111-1111-1111-1111-111111111131",
  tenantId: "32222222-2222-2222-2222-222222222232",
  role: "PLATFORM_ADMIN",
  email: "admin16@aivo.test",
};

function mockReply() {
  const captured: { status?: number; body?: any } = {};
  const reply = {
    status(s: number) {
      captured.status = s;
      return this;
    },
    send(b: any) {
      captured.body = b;
      return this;
    },
  };
  return { reply, captured };
}

test("requireStepUp returns 403 STEP_UP_REQUIRED when flag is on and no x-step-up-token", async () => {
  const original = security.ADMIN_ENTERPRISE.STEP_UP_AUTH;
  security.ADMIN_ENTERPRISE.STEP_UP_AUTH = true;
  try {
    const handler = requireStepUp("tenant:delete");
    const { reply, captured } = mockReply();
    const req: any = { headers: {}, user: { sub: USER.sub } };
    await handler(req, reply);
    assert.equal(captured.status, 403);
    assert.equal(captured.body?.code, "STEP_UP_REQUIRED");
    assert.equal(captured.body?.scope, "tenant:delete");
  } finally {
    security.ADMIN_ENTERPRISE.STEP_UP_AUTH = original;
  }
});

test("requireStepUp rejects expired/invalid token with STEP_UP_REQUIRED code", async () => {
  const original = security.ADMIN_ENTERPRISE.STEP_UP_AUTH;
  security.ADMIN_ENTERPRISE.STEP_UP_AUTH = true;
  try {
    const handler = requireStepUp("user:delete");
    const { reply, captured } = mockReply();
    // Garbage token — fails JWT verification, must surface as 403 with
    // the recovery code so the client knows to re-run the challenge UI.
    const req: any = {
      headers: { "x-step-up-token": "not.a.real.jwt" },
      user: { sub: USER.sub },
    };
    await handler(req, reply);
    assert.equal(captured.status, 403);
    assert.equal(captured.body?.code, "STEP_UP_REQUIRED");
    assert.match(captured.body?.error || "", /invalid or expired/i);
  } finally {
    security.ADMIN_ENTERPRISE.STEP_UP_AUTH = original;
  }
});

test("successful step-up grants short-lived elevated session and is single-use", async () => {
  const original = security.ADMIN_ENTERPRISE.STEP_UP_AUTH;
  security.ADMIN_ENTERPRISE.STEP_UP_AUTH = true;
  try {
    const token = await issueStepUpToken(USER, "tenant:suspend", "webauthn");
    const handler = requireStepUp("tenant:suspend");

    // First use — must succeed and attach req.stepUp.
    const first = mockReply();
    const req1: any = {
      headers: { "x-step-up-token": token },
      user: { sub: USER.sub },
    };
    await handler(req1, first.reply);
    assert.equal(first.captured.status, undefined, "first use must pass");
    assert.equal(req1.stepUp?.scope, "tenant:suspend");
    assert.equal(req1.stepUp?.factor, "webauthn");

    // Second use of the same token (replay) — must 403 STEP_UP_REQUIRED.
    const second = mockReply();
    const req2: any = {
      headers: { "x-step-up-token": token },
      user: { sub: USER.sub },
    };
    await handler(req2, second.reply);
    assert.equal(second.captured.status, 403);
    assert.equal(second.captured.body?.code, "STEP_UP_REQUIRED");
    assert.match(second.captured.body?.error || "", /already used/i);
  } finally {
    security.ADMIN_ENTERPRISE.STEP_UP_AUTH = original;
  }
});

test("requireStepUpProd forces enforcement in production even when flag is off", async () => {
  const originalFlag = security.ADMIN_ENTERPRISE.STEP_UP_AUTH;
  const originalEnv = process.env.NODE_ENV;
  security.ADMIN_ENTERPRISE.STEP_UP_AUTH = false;
  process.env.NODE_ENV = "production";
  try {
    const handler = requireStepUpProd("tenant:delete");
    const { reply, captured } = mockReply();
    const req: any = { headers: {}, user: { sub: USER.sub } };
    await handler(req, reply);
    // With flag off in dev, the non-prod handler would no-op. In
    // production it must still reject without a token.
    assert.equal(captured.status, 403);
    assert.equal(captured.body?.code, "STEP_UP_REQUIRED");
  } finally {
    security.ADMIN_ENTERPRISE.STEP_UP_AUTH = originalFlag;
    process.env.NODE_ENV = originalEnv;
  }
});

test("requireStepUpProd preserves dev no-op when flag off and NODE_ENV != production", async () => {
  const originalFlag = security.ADMIN_ENTERPRISE.STEP_UP_AUTH;
  const originalEnv = process.env.NODE_ENV;
  security.ADMIN_ENTERPRISE.STEP_UP_AUTH = false;
  process.env.NODE_ENV = "test";
  try {
    const handler = requireStepUpProd("tenant:delete");
    const { reply, captured } = mockReply();
    const req: any = { headers: {}, user: { sub: USER.sub } };
    await handler(req, reply);
    // In non-prod with flag off, we want the existing dev/test
    // ergonomics to keep working (no forced step-up).
    assert.equal(captured.status, undefined);
  } finally {
    security.ADMIN_ENTERPRISE.STEP_UP_AUTH = originalFlag;
    process.env.NODE_ENV = originalEnv;
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  issueStepUpChallenge,
  issueStepUpToken,
  verifyStepUpChallengeToken,
  selectFactor,
} from "../src/services/step-up.js";
import { requireStepUp } from "../src/routes/step-up.js";
import { verifyJWT, type StepUpJWT, type StepUpChallengeJWT } from "@aivo/security";

const USER = {
  sub: "11111111-1111-1111-1111-111111111111",
  tenantId: "22222222-2222-2222-2222-222222222222",
  role: "PLATFORM_ADMIN",
  email: "admin@aivo.test",
};

test("issueStepUpChallenge produces a verifiable challenge token bound to user+scope+factor", async () => {
  const { challengeToken, nonce } = await issueStepUpChallenge(USER, "user:delete", "totp");
  assert.ok(challengeToken && typeof challengeToken === "string");
  assert.match(nonce, /^[A-Za-z0-9_-]{40,}$/);
  const claims = await verifyJWT<StepUpChallengeJWT>(challengeToken);
  assert.equal(claims.purpose, "step-up-challenge");
  assert.equal(claims.sub, USER.sub);
  assert.equal(claims.scope, "user:delete");
  assert.equal(claims.factor, "totp");
  assert.equal(claims.nonce, nonce);
});

test("verifyStepUpChallengeToken rejects subject mismatch", async () => {
  const { challengeToken } = await issueStepUpChallenge(USER, "tenant:suspend", "email");
  await assert.rejects(
    verifyStepUpChallengeToken(challengeToken, {
      sub: "00000000-0000-0000-0000-000000000000",
      scope: "tenant:suspend",
    }),
    /subject mismatch/i,
  );
});

test("verifyStepUpChallengeToken rejects scope mismatch", async () => {
  const { challengeToken } = await issueStepUpChallenge(USER, "user:delete", "email");
  await assert.rejects(
    verifyStepUpChallengeToken(challengeToken, { sub: USER.sub, scope: "tenant:suspend" }),
    /scope mismatch/i,
  );
});

test("issueStepUpToken produces a 5-minute scoped step-up JWT", async () => {
  const token = await issueStepUpToken(USER, "user:impersonate", "webauthn");
  const claims = await verifyJWT<StepUpJWT>(token);
  assert.equal(claims.purpose, "step-up");
  assert.equal(claims.scope, "user:impersonate");
  assert.equal(claims.factor, "webauthn");
  assert.equal(claims.sub, USER.sub);
});

test("requireStepUp is a no-op when ADMIN_ENTERPRISE_STEP_UP_AUTH=false", async () => {
  // The flag-cache module-level constant captured the value at import time
  // (default false). The preHandler must short-circuit and call neither
  // reply.status nor reply.send.
  const handler = requireStepUp("user:delete");
  let statusCalled = false;
  const reply = {
    status() {
      statusCalled = true;
      return this;
    },
    send() {
      return this;
    },
  };
  const req: any = { headers: {}, user: { sub: USER.sub } };
  await handler(req, reply);
  assert.equal(statusCalled, false, "preHandler must be a no-op when STEP_UP_AUTH flag is off");
});

test("requireStepUp rejects when flag is on, no header is present", async () => {
  // ADMIN_ENTERPRISE is a singleton object exported by @aivo/security and
  // shared across all importers. Mutating it directly is the cleanest way to
  // exercise the flag-on path without process recycling.
  const sec = await import("@aivo/security");
  const original = sec.ADMIN_ENTERPRISE.STEP_UP_AUTH;
  sec.ADMIN_ENTERPRISE.STEP_UP_AUTH = true;
  try {
    const handler = requireStepUp("user:delete");
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
    const req: any = { headers: {}, user: { sub: USER.sub } };
    await handler(req, reply);
    assert.equal(captured.status, 403, "must 403 when flag is on and header is missing");
    assert.equal(captured.body?.code, "STEP_UP_REQUIRED");
    assert.equal(captured.body?.scope, "user:delete");
  } finally {
    sec.ADMIN_ENTERPRISE.STEP_UP_AUTH = original;
  }
});

test("requireStepUp accepts a valid step-up token with matching scope+sub", async () => {
  const sec = await import("@aivo/security");
  const original = sec.ADMIN_ENTERPRISE.STEP_UP_AUTH;
  sec.ADMIN_ENTERPRISE.STEP_UP_AUTH = true;
  try {
    const stepUpToken = await issueStepUpToken(USER, "tenant:suspend", "totp");
    const handler = requireStepUp("tenant:suspend");
    let statusCalled = false;
    const reply = {
      status() {
        statusCalled = true;
        return this;
      },
      send() {
        return this;
      },
    };
    const req: any = {
      headers: { "x-step-up-token": stepUpToken },
      user: { sub: USER.sub },
    };
    await handler(req, reply);
    assert.equal(statusCalled, false, "valid token+scope+sub must pass through");
    assert.equal(req.stepUp?.scope, "tenant:suspend");
  } finally {
    sec.ADMIN_ENTERPRISE.STEP_UP_AUTH = original;
  }
});

test("requireStepUp rejects token issued for a different scope", async () => {
  const sec = await import("@aivo/security");
  const original = sec.ADMIN_ENTERPRISE.STEP_UP_AUTH;
  sec.ADMIN_ENTERPRISE.STEP_UP_AUTH = true;
  try {
    const stepUpToken = await issueStepUpToken(USER, "user:delete", "totp");
    const handler = requireStepUp("tenant:suspend");
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
    const req: any = {
      headers: { "x-step-up-token": stepUpToken },
      user: { sub: USER.sub },
    };
    await handler(req, reply);
    assert.equal(captured.status, 403);
    assert.match(captured.body?.error || "", /scope mismatch/i);
  } finally {
    sec.ADMIN_ENTERPRISE.STEP_UP_AUTH = original;
  }
});

test("requireStepUp rejects token issued for a different subject", async () => {
  const sec = await import("@aivo/security");
  const original = sec.ADMIN_ENTERPRISE.STEP_UP_AUTH;
  sec.ADMIN_ENTERPRISE.STEP_UP_AUTH = true;
  try {
    const stepUpToken = await issueStepUpToken(USER, "user:delete", "totp");
    const handler = requireStepUp("user:delete");
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
    const req: any = {
      headers: { "x-step-up-token": stepUpToken },
      user: { sub: "00000000-0000-0000-0000-000000000000" },
    };
    await handler(req, reply);
    assert.equal(captured.status, 403);
    assert.match(captured.body?.error || "", /subject mismatch/i);
  } finally {
    sec.ADMIN_ENTERPRISE.STEP_UP_AUTH = original;
  }
});

test("selectFactor returns null for missing user (smoke against fake db)", async () => {
  const fakeDb = {
    select() {
      return this;
    },
    from() {
      return this;
    },
    where() {
      return this;
    },
    async limit() {
      return [];
    },
  };
  const f = await selectFactor(fakeDb as any, "missing-user");
  assert.equal(f, null);
});

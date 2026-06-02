import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyJWT } from "@aivo/security";
import {
  isRecentMfa,
  resolveRecentMfaTtl,
  DEFAULT_RECENT_MFA_TTL_SEC,
  type StepUpTokenClaims,
} from "../src/middleware/requireStepUp.js";
import { issueStepUpToken } from "../src/services/step-up.js";

function baseClaims(over: Partial<StepUpTokenClaims> = {}): StepUpTokenClaims {
  return {
    sub: "u1",
    tenantId: "t1",
    role: "PLATFORM_ADMIN",
    purpose: "step-up",
    scope: "user:delete",
    factor: "totp",
    amr: ["pwd", "mfa"],
    iat: 1000,
    ...over,
  } as StepUpTokenClaims;
}

test("isRecentMfa requires amr to include mfa", () => {
  assert.equal(isRecentMfa(baseClaims({ amr: ["pwd"] }), 300, 1100).ok, false);
  assert.equal(isRecentMfa(baseClaims({ amr: undefined }), 300, 1100).reason, "no-amr-mfa");
});

test("isRecentMfa enforces the recency window", () => {
  assert.equal(isRecentMfa(baseClaims({ iat: 1000 }), 300, 1200).ok, true);
  assert.equal(isRecentMfa(baseClaims({ iat: 1000 }), 300, 1300).ok, true); // exactly at edge
  const stale = isRecentMfa(baseClaims({ iat: 1000 }), 300, 1301);
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "stale");
});

test("isRecentMfa rejects tokens with no iat", () => {
  assert.equal(isRecentMfa(baseClaims({ iat: undefined }), 300, 1100).reason, "no-iat");
});

test("resolveRecentMfaTtl: explicit > env > default", () => {
  const prev = process.env.STEP_UP_RECENT_MFA_TTL_SEC;
  delete process.env.STEP_UP_RECENT_MFA_TTL_SEC;
  assert.equal(resolveRecentMfaTtl(), DEFAULT_RECENT_MFA_TTL_SEC);
  assert.equal(resolveRecentMfaTtl(120), 120);
  process.env.STEP_UP_RECENT_MFA_TTL_SEC = "600";
  assert.equal(resolveRecentMfaTtl(), 600);
  assert.equal(resolveRecentMfaTtl(120), 120); // explicit still wins
  if (prev === undefined) delete process.env.STEP_UP_RECENT_MFA_TTL_SEC;
  else process.env.STEP_UP_RECENT_MFA_TTL_SEC = prev;
});

test("issueStepUpToken mints an AAL2 token that isRecentMfa accepts", async () => {
  const token = await issueStepUpToken(
    { sub: "u9", tenantId: "t9", role: "PLATFORM_ADMIN" },
    "role:change",
    "webauthn",
  );
  const claims = await verifyJWT<StepUpTokenClaims>(token);
  assert.deepEqual(claims.amr, ["pwd", "mfa"]);
  assert.equal((claims as any).acr, "aal2");
  const nowSec = Math.floor(Date.now() / 1000);
  assert.equal(isRecentMfa(claims, 300, nowSec).ok, true);
});

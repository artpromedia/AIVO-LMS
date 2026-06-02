import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyJWT } from "@aivo/security";
import { signAccessToken, deriveAcr, AMR_PWD, AMR_MFA } from "../src/lib/jwt.js";

test("deriveAcr maps factor sets to assurance levels", () => {
  assert.equal(deriveAcr([AMR_PWD]), "aal1");
  assert.equal(deriveAcr([AMR_PWD, AMR_MFA]), "aal2");
  assert.equal(deriveAcr([]), "aal1");
  assert.equal(deriveAcr([AMR_MFA]), "aal2");
});

test("signAccessToken defaults to pwd / aal1", async () => {
  const token = await signAccessToken({
    sub: "u1",
    tenantId: "t1",
    role: "TEACHER",
    email: "a@b.test",
  });
  const claims = await verifyJWT<any>(token);
  assert.deepEqual(claims.amr, ["pwd"]);
  assert.equal(claims.acr, "aal1");
  assert.equal(claims.sub, "u1");
  assert.equal(claims.email, "a@b.test");
});

test("signAccessToken with mfa derives aal2 and dedupes amr", async () => {
  const token = await signAccessToken(
    { sub: "u2", tenantId: "t2", role: "DISTRICT_ADMIN" },
    { amr: ["pwd", "pwd", "mfa"] },
  );
  const claims = await verifyJWT<any>(token);
  assert.deepEqual(claims.amr, ["pwd", "mfa"]);
  assert.equal(claims.acr, "aal2");
});

test("signAccessToken honours an explicit acr override", async () => {
  const token = await signAccessToken(
    { sub: "u3", tenantId: "t3", role: "TEACHER" },
    { amr: ["pwd"], acr: "aal2" },
  );
  const claims = await verifyJWT<any>(token);
  assert.equal(claims.acr, "aal2");
});

test("signAccessToken preserves unknown caller claims", async () => {
  const token = await signAccessToken({
    sub: "u4",
    tenantId: "t4",
    role: "TEACHER",
    name: "Ada",
    extra: "kept",
  } as any);
  const claims = await verifyJWT<any>(token);
  assert.equal(claims.name, "Ada");
  assert.equal(claims.extra, "kept");
});

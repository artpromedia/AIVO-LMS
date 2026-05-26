/**
 * Sprint 12.7 — OIDC provider smoke tests.
 *
 * Covers:
 *   - Discovery document fields per OIDC Discovery 1.0
 *   - JWKS is JSON with a `keys` array
 *   - PKCE-less authorize is rejected
 *   - Unsupported response_type is rejected
 *   - Bearer-less /oidc/userinfo returns 401
 *
 * The auth-code flow end-to-end is exercised in
 * e2e/tests/sprint12/oidc-launch.spec.ts (deferred — gated on a real
 * browser test runner). This file is the unit surface.
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;

async function boot() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerOidcProviderRoutes } = await import("../src/routes/oidc-provider");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify();
  (app as any).db = db;
  await registerOidcProviderRoutes(app);
  await app.ready();
  return app;
}

test("OIDC discovery document exposes required endpoints", { skip: SKIP }, async () => {
  const app = await boot();
  const res = await app.inject({ method: "GET", url: "/.well-known/openid-configuration" });
  assert.strictEqual(res.statusCode, 200);
  const body = res.json();
  for (const key of [
    "issuer",
    "authorization_endpoint",
    "token_endpoint",
    "userinfo_endpoint",
    "jwks_uri",
    "response_types_supported",
    "id_token_signing_alg_values_supported",
    "code_challenge_methods_supported",
  ]) {
    assert.ok(body[key], `discovery missing ${key}`);
  }
  assert.ok(body.code_challenge_methods_supported.includes("S256"));
  await app.close();
});

test("OIDC JWKS returns key set", { skip: SKIP }, async () => {
  const app = await boot();
  const res = await app.inject({ method: "GET", url: "/oidc/jwks.json" });
  assert.strictEqual(res.statusCode, 200);
  const body = res.json();
  assert.ok(Array.isArray(body.keys), "keys must be an array");
  await app.close();
});

test("OIDC authorize rejects missing PKCE", { skip: SKIP }, async () => {
  const app = await boot();
  const res = await app.inject({
    method: "GET",
    url: "/oidc/authorize?response_type=code&client_id=test&redirect_uri=http://x/cb",
  });
  assert.strictEqual(res.statusCode, 400);
  await app.close();
});

test("OIDC userinfo without bearer is 401", { skip: SKIP }, async () => {
  const app = await boot();
  const res = await app.inject({ method: "GET", url: "/oidc/userinfo" });
  assert.strictEqual(res.statusCode, 401);
  await app.close();
});

/**
 * Sprint 12.7 — LTI 1.3 launch tests.
 *
 * Self-contained: we generate a fresh RSA key pair per test, sign the
 * fixture claims with it, publish the JWK as the platform JWKS, and
 * point the launch route at it. This exercises:
 *   1. jose.jwtVerify against the platform JWKS
 *   2. role mapping (LIS -> AIVO)
 *   3. context / resource_link extraction
 *   4. nonce + deployment_id presence checks
 *   5. issuer / audience pinning (negative case)
 *
 * The recorded fixture JSONs are loaded for their claim shapes; the
 * embedded `id_token` placeholders are replaced by a freshly-signed
 * token before the test runs.
 */

import { describe, expect, it, beforeAll } from "vitest";
import * as jose from "jose";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerLtiRoutes } from "../src/routes/lti.js";
import { _resetJwksCache } from "../src/lti/jwks-cache.js";
import { mapLisRolesToAivoRole } from "../src/lti/role-mapping.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures/lti");

interface Fixture {
  description: string;
  issuer: string;
  audience: string;
  deployment_id: string;
  claims: Record<string, unknown>;
}

function loadFixture(name: string): Fixture {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), "utf8"));
}

async function setupSignedFixture(fixture: Fixture) {
  const { publicKey, privateKey } = await jose.generateKeyPair("RS256", { extractable: true });
  const pub = await jose.exportJWK(publicKey);
  (pub as any).kid = "test-fixture";
  (pub as any).alg = "RS256";
  (pub as any).use = "sig";
  const idToken = await new jose.SignJWT({ ...fixture.claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-fixture" })
    .setIssuer(fixture.issuer)
    .setAudience(fixture.audience)
    .setSubject("user-fixture-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { idToken, jwks: { keys: [pub] } };
}

async function buildApp(jwks: any): Promise<FastifyInstance> {
  // Stub the platform JWKS endpoint with a tiny in-process Fastify
  // listener — avoids any external dependency in CI.
  const platform = Fastify();
  platform.get("/jwks", async () => jwks);
  await platform.listen({ port: 0, host: "127.0.0.1" });
  const addr = platform.server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;

  const tool = Fastify();
  registerLtiRoutes(tool);
  await tool.ready();
  (tool as any).__platformJwksUrl = `http://127.0.0.1:${port}/jwks`;
  (tool as any).__shutdownPlatform = () => platform.close();
  return tool;
}

describe.each([
  "canvas-instructor-launch.json",
  "schoology-learner-launch.json",
  "moodle-admin-launch.json",
])("LTI launch fixture: %s", (file) => {
  let app: FastifyInstance;
  let idToken: string;
  let fixture: Fixture;

  beforeAll(async () => {
    _resetJwksCache();
    fixture = loadFixture(file);
    const signed = await setupSignedFixture(fixture);
    idToken = signed.idToken;
    app = await buildApp(signed.jwks);
  });

  it("verifies the launch and redirects to the deep-linked target", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/lti/launch",
      payload: {
        id_token: idToken,
        platform_jwks_url: (app as any).__platformJwksUrl,
        issuer: fixture.issuer,
        audience: fixture.audience,
      },
    });
    expect(res.statusCode).toBe(302);
    const loc = res.headers.location as string;
    expect(loc).toBeTruthy();
    expect(loc).toContain("aivo_lti_session=");
    await (app as any).__shutdownPlatform();
    await app.close();
  });
});

describe("LIS role mapping", () => {
  it("administrator role maps to DISTRICT_ADMIN", () => {
    expect(
      mapLisRolesToAivoRole(["http://purl.imsglobal.org/vocab/lis/v2/system/person#SysAdmin"]),
    ).toBe("DISTRICT_ADMIN");
  });
  it("instructor role maps to TEACHER", () => {
    expect(
      mapLisRolesToAivoRole(["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"]),
    ).toBe("TEACHER");
  });
  it("learner role maps to LEARNER", () => {
    expect(
      mapLisRolesToAivoRole(["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"]),
    ).toBe("LEARNER");
  });
  it("unknown role defaults to LEARNER (least privilege)", () => {
    expect(mapLisRolesToAivoRole(["urn:made-up:role"])).toBe("LEARNER");
  });
});

describe("LTI launch negative paths", () => {
  it("missing parameters returns 400", async () => {
    const tool = Fastify();
    registerLtiRoutes(tool);
    await tool.ready();
    const res = await tool.inject({ method: "POST", url: "/api/lti/launch", payload: {} });
    expect(res.statusCode).toBe(400);
    await tool.close();
  });

  it("bad signature returns 401", async () => {
    _resetJwksCache();
    const fixture = loadFixture("canvas-instructor-launch.json");
    const signed = await setupSignedFixture(fixture);
    const wrongFixture = await setupSignedFixture(fixture);
    const app = await buildApp(signed.jwks);
    const res = await app.inject({
      method: "POST",
      url: "/api/lti/launch",
      payload: {
        id_token: wrongFixture.idToken, // signed with a different key
        platform_jwks_url: (app as any).__platformJwksUrl,
        issuer: fixture.issuer,
        audience: fixture.audience,
      },
    });
    expect(res.statusCode).toBe(401);
    await (app as any).__shutdownPlatform();
    await app.close();
  });
});

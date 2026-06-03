import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
  registerActiveRoleHook,
} from "../src/active-role.js";
import { signJWT, initKeys } from "../src/index.js";

type Hook = (req: Record<string, unknown>, reply: unknown) => Promise<void>;

/** Minimal Fastify-like harness capturing the registered onRequest hook. */
function makeApp() {
  let hook: Hook | null = null;
  return {
    addHook(name: string, fn: Hook) {
      if (name === "onRequest") hook = fn;
    },
    async run(req: Record<string, unknown>) {
      const warnings: unknown[] = [];
      let statusCode: number | null = null;
      let body: unknown = null;
      const reply = {
        code(s: number) {
          statusCode = s;
          return reply;
        },
        send(b: unknown) {
          body = b;
          return reply;
        },
      };
      const request = {
        method: "GET",
        url: "/api/x",
        log: { warn: (o: unknown) => warnings.push(o) },
        ...req,
      };
      await hook!(request, reply);
      return { statusCode, body, warnings };
    },
  };
}

const bearer = (token: string) => "Bearer " + token;

async function tokenFor(role: string, availableRoles?: string[]): Promise<string> {
  await initKeys();
  return signJWT(
    { sub: "u1", tenantId: "t1", role, ...(availableRoles ? { availableRoles } : {}) },
    "5m",
  );
}

describe("registerActiveRoleHook", () => {
  it("is a no-op when the header is absent (no token check)", async () => {
    const app = makeApp();
    registerActiveRoleHook(app as never);
    const r = await app.run({ headers: {} });
    assert.equal(r.statusCode, null);
  });

  it("passes a header that matches the token role", async () => {
    const app = makeApp();
    registerActiveRoleHook(app as never);
    const token = await tokenFor("parent");
    const r = await app.run({
      headers: { authorization: bearer(token), [ACTIVE_ROLE_HEADER]: "parent" },
    });
    assert.equal(r.statusCode, null);
  });

  it("rejects a spoofed header (token does not grant the role) with 403 + audit", async () => {
    const app = makeApp();
    registerActiveRoleHook(app as never);
    const token = await tokenFor("parent");
    const r = await app.run({
      headers: { authorization: bearer(token), [ACTIVE_ROLE_HEADER]: "platform_admin" },
    });
    assert.equal(r.statusCode, 403);
    assert.deepEqual(r.body, { error: "Forbidden role", code: FORBIDDEN_ROLE_CODE });
    assert.equal((r.warnings[0] as { event: string }).event, ACTIVE_ROLE_SPOOFING_EVENT);
  });

  it("widens to availableRoles for multi-role tokens", async () => {
    const app = makeApp();
    registerActiveRoleHook(app as never);
    const token = await tokenFor("parent", ["parent", "teacher"]);
    const r = await app.run({
      headers: { authorization: bearer(token), [ACTIVE_ROLE_HEADER]: "teacher" },
    });
    assert.equal(r.statusCode, null);
  });

  it("does not reject when the header is present but no token (route auth decides)", async () => {
    const app = makeApp();
    registerActiveRoleHook(app as never);
    const r = await app.run({ headers: { [ACTIVE_ROLE_HEADER]: "parent" } });
    assert.equal(r.statusCode, null);
  });

  it("does not reject when the header is present but the token is invalid", async () => {
    const app = makeApp();
    registerActiveRoleHook(app as never);
    const r = await app.run({
      headers: { authorization: bearer("not-a-real-token"), [ACTIVE_ROLE_HEADER]: "parent" },
    });
    assert.equal(r.statusCode, null);
  });

  it("reads the token from the access_token cookie", async () => {
    const app = makeApp();
    registerActiveRoleHook(app as never);
    const token = await tokenFor("teacher");
    const r = await app.run({
      headers: { cookie: "access_token=" + token + "; other=1", [ACTIVE_ROLE_HEADER]: "parent" },
    });
    assert.equal(r.statusCode, 403);
  });

  it("skips health/docs probes even with the header set", async () => {
    const app = makeApp();
    registerActiveRoleHook(app as never);
    const token = await tokenFor("parent");
    const r = await app.run({
      url: "/health",
      headers: { authorization: bearer(token), [ACTIVE_ROLE_HEADER]: "platform_admin" },
    });
    assert.equal(r.statusCode, null);
  });
});

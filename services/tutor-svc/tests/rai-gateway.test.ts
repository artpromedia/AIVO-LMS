import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerRaiGateway, __clearRaiGatewayCache } from "../src/lib/rai-gateway.js";

/**
 * Builds a minimal app: an auth-ish hook that sets req.auth.tenantId from a
 * header, the RAI gateway, and a stub inference route under a guarded prefix.
 */
function buildHarness(opts: {
  allowed: boolean;
  denyReason?: string | null;
  onAudit?: (body: any) => void;
}) {
  const calls = { policy: 0, audit: 0 };
  const fetchImpl = (async (url: any, init: any) => {
    const u = String(url);
    if (u.includes("/policies/effective")) {
      calls.policy += 1;
      return new Response(
        JSON.stringify({ allowed: opts.allowed, denyReason: opts.denyReason ?? null }),
        { status: 200 },
      );
    }
    if (u.includes("/audit-events")) {
      calls.audit += 1;
      opts.onAudit?.(JSON.parse(init.body));
      return new Response("{}", { status: 201 });
    }
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;

  const app = Fastify();
  app.addHook("onRequest", async (req: any) => {
    const t = req.headers["x-tenant-id"];
    if (t) req.auth = { sub: "u1", role: "learner", tenantId: t };
  });
  registerRaiGateway(app, { fetchImpl });
  app.post("/api/tutor/chat", async () => ({ reply: "Hello from the tutor!" }));
  return { app, calls };
}

describe("tutor-svc RAI gateway", () => {
  beforeEach(() => __clearRaiGatewayCache());

  it("lets an allowed tenant reach inference", async () => {
    const { app } = buildHarness({ allowed: true });
    const res = await app.inject({
      method: "POST",
      url: "/api/tutor/chat",
      headers: { "x-tenant-id": "tenant-ok" },
      payload: {},
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().reply, "Hello from the tutor!");
    await app.close();
  });

  it("blocks an opted-out tenant with a graceful 403 and emits ai.call.blocked", async () => {
    let audited: any = null;
    const { app, calls } = buildHarness({
      allowed: false,
      denyReason: "OPT_OUT",
      onAudit: (b) => (audited = b),
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/tutor/chat",
      headers: { "x-tenant-id": "tenant-blocked" },
      payload: {},
    });
    assert.equal(res.statusCode, 403);
    const body = res.json();
    assert.equal(body.fallback, true);
    assert.equal(body.reason, "OPT_OUT");
    assert.equal(calls.audit, 1);
    assert.equal(audited.action, "ai.call.blocked");
    assert.equal(audited.tenantId, "tenant-blocked");
    await app.close();
  });

  it("caches the decision for repeated calls (one policy lookup)", async () => {
    const { app, calls } = buildHarness({ allowed: true });
    for (let i = 0; i < 3; i++) {
      await app.inject({
        method: "POST",
        url: "/api/tutor/chat",
        headers: { "x-tenant-id": "tenant-cache" },
        payload: {},
      });
    }
    assert.equal(calls.policy, 1);
    await app.close();
  });

  it("does not guard non-inference routes", async () => {
    const { app, calls } = buildHarness({ allowed: false, denyReason: "OPT_OUT" });
    app.get("/api/tutor/store/items", async () => ({ items: [] }));
    const res = await app.inject({
      method: "GET",
      url: "/api/tutor/store/items",
      headers: { "x-tenant-id": "tenant-blocked" },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(calls.policy, 0);
    await app.close();
  });

  it("fails open when responsible-ai-svc is unreachable", async () => {
    const fetchImpl = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const app = Fastify();
    app.addHook("onRequest", async (req: any) => {
      req.auth = { sub: "u1", role: "learner", tenantId: "tenant-x" };
    });
    registerRaiGateway(app, { fetchImpl });
    app.post("/api/tutor/chat", async () => ({ reply: "ok" }));
    const res = await app.inject({ method: "POST", url: "/api/tutor/chat", payload: {} });
    assert.equal(res.statusCode, 200);
    await app.close();
  });
});

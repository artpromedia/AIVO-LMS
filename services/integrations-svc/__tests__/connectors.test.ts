/**
 * Sprint 12.6 — unit coverage for the connector marketplace routes.
 *
 * Exercises the four contracts the parity matrix demands for
 * `integrations-svc`:
 *
 *   1. GET /api/integrations/connectors returns the full catalogue with
 *      status flags (available vs coming_soon) intact.
 *   2. POST /api/integrations/waitlist appends a row and is idempotent
 *      on duplicate (connectorId, districtId, contactEmail) — the
 *      second insert is flagged `deduped: true` instead of growing the
 *      store.
 *   3. POST /api/integrations/connect on a `coming_soon` connector
 *      refuses with a 4xx error (currently 400 "not yet available";
 *      see ADR 0017 — the contract is "refuses to provision", not the
 *      specific status code).
 *   4. GET /api/integrations/oauth/callback validates state. A
 *      malformed/missing state string redirects to the failure URL
 *      rather than crashing the route or persisting a half-baked
 *      connection.
 *
 * The route module is intentionally db-free for these checks — the
 * waitlist store is in-memory and we substitute a stub db that fails
 * loudly if the OAuth-callback path under test ever reaches it (the
 * malformed-state branch should short-circuit before any insert).
 */
import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { signJWT } from "@aivo/security";
import {
  registerConnectorRoutes,
  CONNECTORS,
  getWaitlistStore,
} from "../src/routes/connectors.js";

function makeStubDb() {
  // Throws if invoked — none of the four routes under test should
  // reach the db. If a future change wires one in, the test will fail
  // loudly instead of silently swallowing a query.
  const trap = (name: string) => () => {
    throw new Error(`stub db: unexpected call to ${name}`);
  };
  return {
    insert: trap("insert"),
    select: trap("select"),
    update: trap("update"),
    delete: trap("delete"),
  } as any;
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerConnectorRoutes(app, makeStubDb());
  await app.ready();
  return app;
}

async function adminToken(tenantId = "tenant-a") {
  return signJWT({
    sub: "user-admin",
    role: "DISTRICT_ADMIN",
    email: "admin@example.test",
    tenantId,
    name: "Admin",
  } as any);
}

async function platformToken() {
  return signJWT({
    sub: "user-platform",
    role: "PLATFORM_ADMIN",
    email: "platform@example.test",
    tenantId: null,
    name: "Platform",
  } as any);
}

describe("integrations-svc connector routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  it("GET /api/integrations/connectors returns the full catalogue with status flags", async () => {
    const res = await app.inject({ method: "GET", url: "/api/integrations/connectors" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.connectors)).toBe(true);
    expect(body.connectors.length).toBe(CONNECTORS.length);

    // Every catalogue row exposes the status flag (available vs coming_soon)
    // — the UI uses this to gate the "Connect" button.
    for (const c of body.connectors) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.status).toBe("string");
      expect(["available", "coming_soon"]).toContain(c.status);
    }

    // The catalogue must include at least one of each status so the
    // UI gating contract has data to render.
    expect(body.connectors.some((c: any) => c.status === "available")).toBe(true);
    expect(body.connectors.some((c: any) => c.status === "coming_soon")).toBe(true);
  });

  it("POST /api/integrations/waitlist appends a row and dedupes on (connector, district, email)", async () => {
    const token = await adminToken("tenant-waitlist-1");
    const store = getWaitlistStore();
    const startSize = store.length;
    const body = {
      connectorId: "schoology", // coming_soon in CONNECTORS
      contactEmail: "lead@example.test",
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/integrations/waitlist",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: body,
    });
    expect(first.statusCode).toBe(200);
    const firstJson = first.json();
    expect(firstJson.entry).toBeTruthy();
    expect(firstJson.entry.connectorId).toBe("schoology");
    expect(firstJson.entry.contactEmail).toBe("lead@example.test");
    expect(firstJson.entry.districtId).toBe("tenant-waitlist-1");
    expect(firstJson.deduped).toBeFalsy();
    expect(store.length).toBe(startSize + 1);

    // Idempotent on duplicate — same email, same connector, same
    // districtId-from-token. Second call must NOT grow the store.
    const second = await app.inject({
      method: "POST",
      url: "/api/integrations/waitlist",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: body,
    });
    expect(second.statusCode).toBe(200);
    const secondJson = second.json();
    expect(secondJson.deduped).toBe(true);
    expect(secondJson.entry.id).toBe(firstJson.entry.id);
    expect(store.length).toBe(startSize + 1);
  });

  it("POST /api/integrations/connect on a coming_soon connector refuses to provision", async () => {
    const token = await platformToken();
    const res = await app.inject({
      method: "POST",
      url: "/api/integrations/connect",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: {
        tenantId: "tenant-x",
        connectorId: "schoology", // coming_soon
        credentials: {},
        config: {},
      },
    });
    // The contract is "refuses to activate a coming_soon connector".
    // Today the route returns 400 ("not yet available"); a future
    // sprint may align this to 409. Either is acceptable as long as
    // the connector is NOT provisioned.
    expect([400, 409]).toContain(res.statusCode);
    const body = res.json();
    expect(String(body.error || "").toLowerCase()).toMatch(/not yet|coming|unavailable|conflict/);
  });

  it("GET /api/integrations/oauth/callback rejects a malformed state and never persists", async () => {
    // Malformed base64url state — the route should redirect to the
    // failure URL, not throw. The stub db would throw on any insert,
    // so reaching this assertion proves no persistence happened.
    const res = await app.inject({
      method: "GET",
      url: "/api/integrations/oauth/callback?code=test-code&state=not-valid-base64-json",
    });
    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain("/dashboard/district/integrations");
    expect(location).toContain("error=");
  });

  it("GET /api/integrations/oauth/callback short-circuits when the provider returns an error", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/integrations/oauth/callback?error=access_denied",
    });
    expect(res.statusCode).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain("error=access_denied");
  });

  it("POST /api/integrations/waitlist rejects unauthenticated callers", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/integrations/waitlist",
      headers: { "content-type": "application/json" },
      payload: { connectorId: "schoology", contactEmail: "x@example.test" },
    });
    expect(res.statusCode).toBe(401);
  });
});

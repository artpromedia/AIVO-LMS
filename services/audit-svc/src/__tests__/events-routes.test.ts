/**
 * Sprint B4 — route-level tests for the `/events` surface: tenant
 * isolation (district A cannot export/read B), the self-auditing export,
 * ranged chain verification, and the producer-only append gate.
 *
 * Auth is exercised by injecting `enterpriseContext` exactly as the
 * enterprise hook would have set it (the hook itself is unit-tested in
 * @aivo/enterprise-core).
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AuditEventInput } from "@aivo/audit-client";
import { buildApp } from "../server.js";
import { InMemoryEventStore } from "../services/event-store.js";

type Principal =
  | { kind: "service" }
  | { kind: "platform"; actorId?: string }
  | { kind: "district"; tenantId: string; actorId?: string }
  | { kind: "contextless-tenant" };

function contextFor(principal: Principal) {
  switch (principal.kind) {
    case "service":
      return { actorId: "internal-service", actorRole: "service", requestId: "req-test" };
    case "platform":
      return {
        actorId: principal.actorId ?? "admin-1",
        actorRole: "platform_admin",
        requestId: "req-test",
      };
    case "district":
      return {
        actorId: principal.actorId ?? "district-admin-1",
        actorRole: "district_admin",
        tenant: { tenantId: principal.tenantId, role: "district_admin" },
        requestId: "req-test",
      };
    case "contextless-tenant":
      return {
        actorId: "limbo-user",
        actorRole: "district_admin",
        requestId: "req-test",
      };
  }
}

async function makeApp(store: InMemoryEventStore): Promise<{
  app: FastifyInstance;
  as: (p: Principal) => void;
}> {
  const app = await buildApp({ eventStore: store, skipAuth: true });
  let principal: Principal = { kind: "service" };
  app.addHook("onRequest", async (req) => {
    (req as { enterpriseContext?: unknown }).enterpriseContext = contextFor(principal);
  });
  return {
    app,
    as: (p) => {
      principal = p;
    },
  };
}

function input(over: Partial<AuditEventInput> = {}): AuditEventInput {
  return {
    occurred_at: over.occurred_at ?? new Date().toISOString(),
    tenant_id: over.tenant_id ?? "tenant-a",
    actor: over.actor ?? { id: "u1", role: "teacher", ip: "1.2.3.4", ua: "test" },
    action: over.action ?? "identity.user.updated",
    entity: over.entity ?? { type: "user", id: "u9" },
    outcome: over.outcome ?? "success",
    details: over.details ?? {},
    request_id: over.request_id ?? "req-1",
    id: over.id,
  };
}

describe("/events tenant isolation", () => {
  let store: InMemoryEventStore;

  beforeEach(async () => {
    store = new InMemoryEventStore();
    await store.append(input({ tenant_id: "tenant-a", action: "district.a.event" }));
    await store.append(input({ tenant_id: "tenant-b", action: "district.b.event" }));
  });

  it("a district principal only sees its own tenant's events", async () => {
    const { app, as } = await makeApp(store);
    as({ kind: "district", tenantId: "tenant-a" });
    const res = await app.inject({ method: "GET", url: "/events?tenantId=tenant-b" });
    expect(res.statusCode).toBe(200);
    const events = res.json().events as Array<{ tenant_id: string }>;
    expect(events.length).toBe(1);
    expect(events[0].tenant_id).toBe("tenant-a"); // forced scope beat the query param
    await app.close();
  });

  it("district A cannot export district B (forced filter)", async () => {
    const { app, as } = await makeApp(store);
    as({ kind: "district", tenantId: "tenant-a" });
    const res = await app.inject({ method: "GET", url: "/export?format=ndjson&tenantId=tenant-b" });
    expect(res.statusCode).toBe(200);
    const lines = res.body.trim().split("\n").map((l) => JSON.parse(l) as { tenant_id: string | null; action: string });
    expect(lines.some((e) => e.tenant_id === "tenant-b" && e.action !== "audit.exported")).toBe(false);
    expect(lines.some((e) => e.action === "district.a.event")).toBe(true);
    await app.close();
  });

  it("cross-tenant event ids 404 for tenant principals", async () => {
    const { app, as } = await makeApp(store);
    const bEvent = (await store.query({ tenantId: "tenant-b" })).events[0];
    as({ kind: "district", tenantId: "tenant-a" });
    const res = await app.inject({ method: "GET", url: `/events/${bEvent.id}` });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("a tenant principal without a tenant id is refused", async () => {
    const { app, as } = await makeApp(store);
    as({ kind: "contextless-tenant" });
    const res = await app.inject({ method: "GET", url: "/events" });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("platform principals stay unscoped", async () => {
    const { app, as } = await makeApp(store);
    as({ kind: "platform" });
    const res = await app.inject({ method: "GET", url: "/events" });
    expect(res.statusCode).toBe(200);
    expect((res.json().events as unknown[]).length).toBe(2);
    await app.close();
  });
});

describe("POST /events producer gate", () => {
  it("rejects tenant principals and accepts services", async () => {
    const store = new InMemoryEventStore();
    const { app, as } = await makeApp(store);

    as({ kind: "district", tenantId: "tenant-a" });
    const forged = await app.inject({ method: "POST", url: "/events", payload: input() });
    expect(forged.statusCode).toBe(403);

    as({ kind: "service" });
    const ok = await app.inject({ method: "POST", url: "/events", payload: input() });
    expect(ok.statusCode).toBe(201);
    await app.close();
  });
});

describe("export self-auditing", () => {
  it("appends audit.exported BEFORE streaming, carrying the exporter's tenant", async () => {
    const store = new InMemoryEventStore();
    await store.append(input({ tenant_id: "tenant-a" }));
    const { app, as } = await makeApp(store);
    as({ kind: "district", tenantId: "tenant-a", actorId: "district-admin-7" });
    const res = await app.inject({ method: "GET", url: "/export?format=csv" });
    expect(res.statusCode).toBe(200);

    const trail = await store.query({ action: "audit.exported" });
    expect(trail.events.length).toBe(1);
    expect(trail.events[0].tenant_id).toBe("tenant-a");
    expect(trail.events[0].actor.id).toBe("district-admin-7");
    expect(trail.events[0].details.format).toBe("csv");
    // …and the export stream itself contains the export event (it matched
    // the same tenant filter), so the trail the district holds is complete.
    expect(res.body).toContain("audit.exported");
    await app.close();
  });
});

describe("GET /events/verify with a range", () => {
  it("verifies a clean range, detects tampering inside it, and ignores outside", async () => {
    const store = new InMemoryEventStore();
    const t0 = "2026-06-01T00:00:00.000Z";
    const t1 = "2026-06-02T00:00:00.000Z";
    const t2 = "2026-06-03T00:00:00.000Z";
    await store.append(input({ occurred_at: t0, id: "ev-0" }));
    const target = await store.append(input({ occurred_at: t1, id: "ev-1" }));
    await store.append(input({ occurred_at: t2, id: "ev-2" }));
    const { app, as } = await makeApp(store);
    as({ kind: "district", tenantId: "tenant-a" });

    let res = await app.inject({
      method: "GET",
      url: `/events/verify?from=${encodeURIComponent(t1)}`,
    });
    expect(res.json()).toMatchObject({ intact: true, brokenAt: null });

    store._tamper(target.id, (e) => {
      e.details = { injected: true };
    });

    // Tamper detected when the range covers the row…
    res = await app.inject({ method: "GET", url: `/events/verify?from=${encodeURIComponent(t1)}` });
    expect(res.json().intact).toBe(false);
    expect(res.json().brokenAt).toBe("ev-1");

    // …and the slice BEFORE it still verifies (anchored at genesis).
    res = await app.inject({ method: "GET", url: `/events/verify?to=${encodeURIComponent(t0)}` });
    expect(res.json().intact).toBe(true);
    await app.close();
  });
});

import { describe, expect, it, beforeEach } from "vitest";
import { buildApp } from "../src/index.js";
import { resetStore, DAILY_QUOTA } from "../src/store.js";
import type { FastifyInstance } from "fastify";

// The enterprise auth hook (non-prod) accepts x-actor-* headers.
function hdr(role: string, tenantId = "tenant-springfield", actorId = "admin-1") {
  return { "x-actor-id": actorId, "x-actor-role": role, "x-tenant-id": tenantId };
}

let app: FastifyInstance;
beforeEach(async () => {
  resetStore();
  app = await buildApp();
});

describe("catalog scope filtering", () => {
  it("school admin sees only school reports", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/reports",
      headers: hdr("school_admin"),
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().reports.map((r: any) => r.id);
    expect(ids).toContain("enrollment");
    expect(ids).not.toContain("enrollment-by-school");
    expect(ids).not.toContain("mrr-by-plan");
  });

  it("platform admin sees platform + district + school reports", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/reports",
      headers: hdr("platform_admin"),
    });
    const ids = res.json().reports.map((r: any) => r.id);
    expect(ids).toEqual(expect.arrayContaining(["mrr-by-plan", "enrollment-by-school", "enrollment"]));
  });
});

describe("district admin runs enrollment-by-school → CSV → download", () => {
  it("runs, polls status, and downloads a CSV", async () => {
    const run = await app.inject({
      method: "POST",
      url: "/api/reports/enrollment-by-school/run",
      headers: hdr("district_admin"),
      payload: { params: { tenantId: "tenant-springfield" }, format: "csv" },
    });
    expect(run.statusCode).toBe(202);
    const { runId } = run.json();

    const status = await app.inject({
      method: "GET",
      url: `/api/reports/runs/${runId}`,
      headers: hdr("district_admin"),
    });
    expect(status.json().status).toBe("succeeded");
    expect(status.json().downloadUrl).toBe(`/api/reports/runs/${runId}/download`);
    expect(status.json().lineage.sources[0].service).toBe("identity-svc");

    const dl = await app.inject({
      method: "GET",
      url: `/api/reports/runs/${runId}/download`,
      headers: hdr("district_admin"),
    });
    expect(dl.statusCode).toBe(200);
    expect(dl.headers["content-type"]).toContain("text/csv");
    expect(dl.headers["content-disposition"]).toContain("enrollment-by-school");
    // Springfield + Shelbyville are in district-springfield.
    expect(dl.body).toContain("School");
    expect(dl.body).toContain("Springfield Elementary");
  });

  it("schedules a weekly delivery to a verified recipient", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/reports/schedules",
      headers: {
        ...hdr("district_admin"),
        "x-verified-recipients": "lead@springfield.example",
      },
      payload: {
        reportId: "enrollment-by-school",
        params: { tenantId: "tenant-springfield" },
        cron: "0 7 * * 1",
        recipients: ["lead@springfield.example"],
        format: "csv",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().schedule.cron).toBe("0 7 * * 1");
  });

  it("rejects unverified recipients", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/reports/schedules",
      headers: { ...hdr("district_admin"), "x-verified-recipients": "ok@springfield.example" },
      payload: {
        reportId: "enrollment-by-school",
        params: { tenantId: "tenant-springfield" },
        cron: "0 7 * * 1",
        recipients: ["stranger@evil.example"],
        format: "csv",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("UNVERIFIED_RECIPIENTS");
  });
});

describe("RBAC: school admin attempting a district report", () => {
  it("hides it from catalog and 404s the schema (no existence leak)", async () => {
    const schema = await app.inject({
      method: "GET",
      url: "/api/reports/enrollment-by-school/schema",
      headers: hdr("school_admin"),
    });
    expect(schema.statusCode).toBe(404);
  });

  it("403s a direct run of a district report", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/reports/enrollment-by-school/run",
      headers: hdr("school_admin"),
      payload: { params: { tenantId: "tenant-springfield" } },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("SCOPE_FORBIDDEN");
  });
});

describe("tenant access", () => {
  it("403s a district admin requesting a tenant outside their district", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/reports/enrollment-by-school/run",
      headers: hdr("district_admin", "tenant-springfield"),
      payload: { params: { tenantId: "tenant-riverdale" } },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("TENANT_FORBIDDEN");
  });
});

describe("quota", () => {
  it("returns 429 when the daily quota is exceeded", async () => {
    // Pre-fill the quota counter to the limit via the store.
    const { getStore, quotaKey } = await import("../src/store.js");
    getStore().quota.set(quotaKey("tenant-springfield"), DAILY_QUOTA);
    const res = await app.inject({
      method: "POST",
      url: "/api/reports/seat-utilization/run",
      headers: hdr("district_admin"),
      payload: { params: { tenantId: "tenant-springfield" } },
    });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe("QUOTA_EXCEEDED");
  });
});

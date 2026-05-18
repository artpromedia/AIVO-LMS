/**
 * Journey 5: SOC2 evidence continuity
 */
import { describe, it, expect, beforeAll } from "vitest";
import { serviceUrl } from "./helpers/services.js";
import { createTenant, createUser } from "./helpers/fixtures.js";

describe("Journey 5: SOC2 evidence continuity", () => {
  let adminToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const tenant = await createTenant();
    tenantId = tenant.tenantId;
    adminToken = tenant.adminTokens.accessToken;
  });

  it("1. Performs 10 audit-generating actions across identity-svc", async () => {
    for (let i = 0; i < 10; i++) {
      // Each user creation generates an audit_entry in admin-svc.
      await fetch(serviceUrl("identity-svc", "/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          email: `audituser${i}-${Date.now()}@test.aivo.dev`,
          password: "TestPass1!",
          name: `Audit User ${i}`,
          role: "parent",
          tenantId,
        }),
      });
    }
  });

  it("2. Audit log contains at least 10 entries", async () => {
    const res = await fetch(
      serviceUrl("admin-svc", `/api/admin/audit?tenantId=${tenantId}&limit=20`),
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as any[];
    expect(data.length).toBeGreaterThanOrEqual(10);
  });

  it("3. Audit chain verification returns { valid: true }", async () => {
    const res = await fetch(serviceUrl("admin-svc", "/api/admin/audit/verify"), {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.valid).toBe(true);
  });

  it("4. SOC2 evidence collection produces a record with sha256 hash", async () => {
    const res = await fetch(serviceUrl("admin-svc", "/api/admin/evidence/collect"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ tenantId }),
    });
    expect(res.status).toBeLessThan(300);
    const data = (await res.json()) as any;
    expect(data.sha256).toBeTruthy();
    expect(data.sha256.length).toBe(64); // hex-encoded SHA-256
  });

  it("5. Evidence retention is >= 7 years (2555 days)", async () => {
    const res = await fetch(serviceUrl("admin-svc", "/api/admin/evidence/collect"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ tenantId }),
    });
    const data = (await res.json()) as any;
    const retainUntil = new Date(data.retainUntil);
    const daysRetained = (retainUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysRetained).toBeGreaterThanOrEqual(7 * 365);
  });
});

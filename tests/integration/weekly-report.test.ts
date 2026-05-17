/**
 * Journey 3: Weekly progress report delivery
 */
import { describe, it, expect, beforeAll } from "vitest";
import { serviceUrl } from "./helpers/services.js";
import { createTenant, createUser, createLearner, createBrainState, pollUntil } from "./helpers/fixtures.js";

describe("Journey 3: Weekly progress report", () => {
  let adminToken: string;
  let tenantId: string;
  let parentToken: string;
  let learnerId: string;
  let reportId: string;

  beforeAll(async () => {
    const tenant = await createTenant();
    tenantId = tenant.tenantId;
    adminToken = tenant.adminTokens.accessToken;

    const parent = await createUser("parent", tenantId, adminToken);
    parentToken = parent.tokens.accessToken;

    const learner = await createLearner(tenantId, parent.id, adminToken);
    learnerId = learner.id;

    // Seed a brain state so there's data for the report to summarize.
    await createBrainState(learnerId, tenantId, adminToken);
  });

  it("1. Triggers weekly report generation", async () => {
    const res = await fetch(serviceUrl("assessment-svc", "/api/assessment/reports/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ learnerId, tenantId }),
    });
    expect(res.status).toBeLessThan(300);
    const data = (await res.json()) as any;
    expect(data.reportId || data.id).toBeTruthy();
    reportId = data.reportId ?? data.id;
  });

  it("2. Report becomes 'ready' within 30 seconds", async () => {
    const data = await pollUntil(
      () =>
        fetch(serviceUrl("assessment-svc", `/api/assessment/reports/${reportId}`), {
          headers: { Authorization: `Bearer ${adminToken}` },
        }).then((r) => r.json()),
      (d: any) => d?.status === "ready",
      { maxMs: 30_000, intervalMs: 2_000 },
    );
    expect((data as any).status).toBe("ready");
  });

  it("3. Report has at least one goal_summary entry", async () => {
    const res = await fetch(serviceUrl("assessment-svc", `/api/assessment/reports/${reportId}`), {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = (await res.json()) as any;
    expect(Array.isArray(data.goalSummaries)).toBe(true);
    expect(data.goalSummaries.length).toBeGreaterThan(0);
  });

  it("4. Report narrative_text is 100–500 characters", async () => {
    const res = await fetch(serviceUrl("assessment-svc", `/api/assessment/reports/${reportId}`), {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = (await res.json()) as any;
    expect(data.narrativeText.length).toBeGreaterThanOrEqual(100);
    expect(data.narrativeText.length).toBeLessThanOrEqual(500);
  });

  it("5. Comms-svc notification created for parent", async () => {
    const res = await fetch(serviceUrl("comms-svc", `/api/comms/notifications?learnerId=${learnerId}&type=weekly_report`), {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any[];
    expect(data.length).toBeGreaterThan(0);
  });
});

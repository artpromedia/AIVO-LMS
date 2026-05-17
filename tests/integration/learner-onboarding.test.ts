/**
 * Journey 1: Learner onboarding (assessment → brain clone → first lesson)
 *
 * This is the smoke test. All other journeys should run after this one passes.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { serviceUrl } from "./helpers/services.js";
import { createTenant, createUser, createLearner, pollUntil } from "./helpers/fixtures.js";

describe("Journey 1: Learner onboarding", () => {
  let adminToken: string;
  let tenantId: string;
  let parentId: string;
  let parentToken: string;
  let learnerId: string;
  let sessionId: string;

  beforeAll(async () => {
    const tenant = await createTenant();
    tenantId = tenant.tenantId;
    adminToken = tenant.adminTokens.accessToken;

    const parent = await createUser("parent", tenantId, adminToken);
    parentId = parent.id;
    parentToken = parent.tokens.accessToken;

    const learner = await createLearner(tenantId, parentId, adminToken);
    learnerId = learner.id;
  });

  it("1. Submits parent assessment", async () => {
    const res = await fetch(serviceUrl("assessment-svc", "/api/assessment/parent"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${parentToken}` },
      body: JSON.stringify({ learnerId, communicationMode: "verbal", diagnoses: [] }),
    });
    expect(res.status).toBeLessThan(300);
  });

  it("2. Triggers brain clone", async () => {
    const res = await fetch(serviceUrl("brain-svc", "/api/brain/clone"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ learnerId, tenantId }),
    });
    expect(res.status).toBeLessThan(300);
  });

  it("3. Brain state created with approval_status=pending_parent_review", async () => {
    const data = await pollUntil(
      () =>
        fetch(serviceUrl("brain-svc", `/api/brain/${learnerId}`), {
          headers: { Authorization: `Bearer ${adminToken}` },
        }).then((r) => r.json()),
      (d: any) => d?.approvalStatus === "pending_parent_review",
      { maxMs: 15_000 },
    );
    expect((data as any).approvalStatus).toBe("pending_parent_review");
  });

  it("4. Approves brain clone", async () => {
    const res = await fetch(serviceUrl("brain-svc", `/api/brain/${learnerId}/approve`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${parentToken}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBeLessThan(300);
  });

  it("5. Starts a lesson session and receives first beat", async () => {
    const res = await fetch(serviceUrl("tutor-svc", "/api/tutor/lessons/start"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${parentToken}` },
      body: JSON.stringify({ learnerId, tutorKey: "nova" }),
    });
    expect(res.status).toBeLessThan(300);
    const data = (await res.json()) as any;
    expect(data.sessionId).toBeTruthy();
    expect(data.firstBeat).toBeTruthy();
    expect(["narration", "interaction"]).toContain(data.firstBeat.type);
    sessionId = data.sessionId;
  });

  it("6. Submits an answer", async () => {
    const res = await fetch(serviceUrl("tutor-svc", `/api/tutor/lessons/${sessionId}/answer`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${parentToken}` },
      body: JSON.stringify({ beatIndex: 0, response: "correct" }),
    });
    expect(res.status).toBeLessThan(300);
  });

  it("7. Ends session and mastery delta is positive", async () => {
    const res = await fetch(serviceUrl("tutor-svc", `/api/tutor/lessons/${sessionId}/end`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${parentToken}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBeLessThan(300);
    const data = (await res.json()) as any;
    const mathDelta = data?.masteryDeltas?.math ?? 0;
    expect(mathDelta).toBeGreaterThan(0);
  });

  it("8. Gradebook entry created in learning-svc", async () => {
    const res = await fetch(serviceUrl("learning-svc", `/api/learning/gradebook/${learnerId}`), {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

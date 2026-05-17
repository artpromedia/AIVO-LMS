/**
 * Journey 4: Content pack authoring → delivery
 */
import { describe, it, expect, beforeAll } from "vitest";
import { serviceUrl } from "./helpers/services.js";
import { createTenant, createUser, createLearner } from "./helpers/fixtures.js";

describe("Journey 4: Content pack authoring → delivery", () => {
  let adminToken: string;
  let tenantId: string;
  let parentToken: string;
  let learnerId: string;
  let packId: string;

  beforeAll(async () => {
    const tenant = await createTenant();
    tenantId = tenant.tenantId;
    adminToken = tenant.adminTokens.accessToken;

    const parent = await createUser("parent", tenantId, adminToken);
    parentToken = parent.tokens.accessToken;
    const learner = await createLearner(tenantId, parent.id, adminToken);
    learnerId = learner.id;
  });

  it("1. Admin creates a content pack", async () => {
    const res = await fetch(serviceUrl("admin-svc", "/api/admin/content/packs"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: "Math Pack — Counting",
        subject: "math",
        gradeLevel: "K-2",
        functioningLevel: "STANDARD",
      }),
    });
    expect(res.status).toBeLessThan(300);
    const data = (await res.json()) as any;
    packId = data.id;
  });

  it("2. Adds 5 items to the pack", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(serviceUrl("admin-svc", `/api/admin/content/packs/${packId}/items`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          type: "multiple_choice",
          prompt: `What is ${i + 1} + 1?`,
          choices: [String(i), String(i + 2), String(i + 3), String(i + 4)],
          correctAnswer: String(i + 2),
          subject: "math",
        }),
      });
      expect(res.status).toBeLessThan(300);
    }
  });

  it("3. Submits pack for review", async () => {
    const res = await fetch(serviceUrl("admin-svc", `/api/admin/content/packs/${packId}/submit`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBeLessThan(300);
  });

  it("4. Publishes the pack", async () => {
    const res = await fetch(serviceUrl("admin-svc", `/api/admin/content/packs/${packId}/publish`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reviewNotes: "LGTM" }),
    });
    expect(res.status).toBeLessThan(300);
    const data = (await res.json()) as any;
    expect(data.status).toBe("published");
  });

  it("5. Assigns pack to learner", async () => {
    const res = await fetch(serviceUrl("admin-svc", `/api/admin/content/packs/${packId}/assign`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ learnerId }),
    });
    expect(res.status).toBeLessThan(300);
  });

  it("6. Lesson items come from the published pack (not FALLBACK)", async () => {
    const res = await fetch(serviceUrl("tutor-svc", "/api/tutor/lessons/start"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${parentToken}` },
      body: JSON.stringify({ learnerId, tutorKey: "nova" }),
    });
    expect(res.status).toBeLessThan(300);
    const data = (await res.json()) as any;
    // The content source should be the pack, not the hardcoded fallback constant.
    expect(data.contentSource).not.toBe("FALLBACK");
  });
});

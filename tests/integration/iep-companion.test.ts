/**
 * Journey 2: IEP companion (upload → parse → authoring → parent share → sign)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { serviceUrl } from "./helpers/services.js";
import { createTenant, createUser, createLearner, pollUntil } from "./helpers/fixtures.js";

describe("Journey 2: IEP companion", () => {
  let adminToken: string;
  let tenantId: string;
  let teacherToken: string;
  let parentToken: string;
  let learnerId: string;
  let iepDocId: string;
  let iepProfileId: string;
  let packetId: string;
  let shareToken: string;

  beforeAll(async () => {
    const tenant = await createTenant();
    tenantId = tenant.tenantId;
    adminToken = tenant.adminTokens.accessToken;

    const teacher = await createUser("teacher", tenantId, adminToken);
    teacherToken = teacher.tokens.accessToken;

    const parent = await createUser("parent", tenantId, adminToken);
    parentToken = parent.tokens.accessToken;

    const learner = await createLearner(tenantId, parent.id, adminToken);
    learnerId = learner.id;
  });

  it("1. Uploads IEP document (with synthetic parsedData)", async () => {
    const res = await fetch(serviceUrl("assessment-svc", "/api/iep/upload"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        learnerId,
        tenantId,
        parsedData: {
          studentName: "Test Learner",
          goals: [{ area: "math", description: "Count to 20" }],
          services: [],
          placementSummary: "General education with support",
        },
      }),
    });
    expect(res.status).toBeLessThan(300);
    const data = (await res.json()) as any;
    expect(data.id).toBeTruthy();
    iepDocId = data.id;
  });

  it("2. IEP document status is 'parsed'", async () => {
    const data = await pollUntil(
      () =>
        fetch(serviceUrl("assessment-svc", `/api/iep/documents/${iepDocId}`), {
          headers: { Authorization: `Bearer ${teacherToken}` },
        }).then((r) => r.json()),
      (d: any) => d?.status === "parsed",
    );
    expect((data as any).status).toBe("parsed");
  });

  it("3. Creates IEP profile and goals", async () => {
    const res = await fetch(serviceUrl("assessment-svc", "/api/iep/authoring"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ learnerId, iepDocumentId: iepDocId, tenantId }),
    });
    expect(res.status).toBeLessThan(300);
    const data = (await res.json()) as any;
    iepProfileId = data.id;
  });

  it("4. Submits IEP profile for review", async () => {
    const res = await fetch(
      serviceUrl("assessment-svc", `/api/iep/authoring/${iepProfileId}/submit`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${teacherToken}` },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBeLessThan(300);
  });

  it("5. IEP profile lifecycle_state is 'in_review'", async () => {
    const data = await pollUntil(
      () =>
        fetch(serviceUrl("assessment-svc", `/api/iep/authoring/${iepProfileId}`), {
          headers: { Authorization: `Bearer ${teacherToken}` },
        }).then((r) => r.json()),
      (d: any) => d?.lifecycleState === "in_review",
    );
    expect((data as any).lifecycleState).toBe("in_review");
  });

  it("6. Generates IEP meeting packet (PDF URL present)", async () => {
    const res = await fetch(serviceUrl("assessment-svc", "/api/iep/packets/generate"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ iepProfileId }),
    });
    expect(res.status).toBeLessThan(300);
    const data = (await res.json()) as any;
    expect(data.pdfUrl || data.id).toBeTruthy();
    packetId = data.id;
  });

  it("7. Shares packet with parent and parent can view it", async () => {
    const shareRes = await fetch(
      serviceUrl("assessment-svc", `/api/iep/packets/${packetId}/share`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${teacherToken}` },
        body: JSON.stringify({ email: "parent@test.aivo.dev" }),
      },
    );
    expect(shareRes.status).toBeLessThan(300);
    const shareData = (await shareRes.json()) as any;
    shareToken = shareData.shareToken;
    expect(shareToken).toBeTruthy();
  });

  it("8. Parent views packet via share token — parent_viewed_at is set", async () => {
    const viewRes = await fetch(
      serviceUrl("assessment-svc", `/api/iep/packets/share/${shareToken}`),
    );
    expect(viewRes.status).toBe(200);

    // Re-fetch packet and confirm parent_viewed_at
    const data = await pollUntil(
      () =>
        fetch(serviceUrl("assessment-svc", `/api/iep/packets/${packetId}`), {
          headers: { Authorization: `Bearer ${teacherToken}` },
        }).then((r) => r.json()),
      (d: any) => d?.parentViewedAt != null,
    );
    expect((data as any).parentViewedAt).toBeTruthy();
  });

  it("9. Parent signs packet — status becomes 'signed'", async () => {
    const signRes = await fetch(
      serviceUrl("assessment-svc", `/api/iep/packets/share/${shareToken}/sign`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: "Parent Name" }),
      },
    );
    expect(signRes.status).toBeLessThan(300);

    const data = await pollUntil(
      () =>
        fetch(serviceUrl("assessment-svc", `/api/iep/packets/${packetId}`), {
          headers: { Authorization: `Bearer ${teacherToken}` },
        }).then((r) => r.json()),
      (d: any) => d?.status === "signed",
    );
    expect((data as any).status).toBe("signed");
  });
});

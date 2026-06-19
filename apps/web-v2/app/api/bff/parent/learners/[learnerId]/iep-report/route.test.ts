/**
 * BFF integration for the IEP report PDF download.
 *
 * Session is injected via `getRequestSession` (guards stay real and run
 * against the seeded in-memory store); the report data builder + PDF renderer
 * run for real, so this asserts the full pipeline end to end: role + learner
 * scope, a real `application/pdf` body, and an attachment filename.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SessionProfile } from "@/lib/auth/types";

const TENANT = "t_demo";
const PARENT = "u_parent_1";
const OWNED_LEARNER = "lrn_demo_sky";

const parentSession: SessionProfile = {
  userId: PARENT,
  tenantId: TENANT,
  role: "parent",
  email: "parent@demo.aivo",
  displayName: "Riley Parent",
  permissions: [],
};

const sessionRef: { current: SessionProfile | null } = { current: parentSession };
vi.mock("@/lib/auth/session", async (orig) => {
  const actual = await orig<typeof import("@/lib/auth/session")>();
  return { ...actual, getRequestSession: vi.fn(async () => sessionRef.current) };
});

const auditMock = vi.fn();
vi.mock("@/lib/bff/audit", () => ({ audit: (...a: unknown[]) => auditMock(...a) }));

async function call(learnerId: string) {
  const { GET } = await import("@/app/api/bff/parent/learners/[learnerId]/iep-report/route");
  return GET(new Request(`https://app.aivo.test/api/bff/parent/learners/${learnerId}/iep-report`), {
    params: Promise.resolve({ learnerId }),
  });
}

beforeEach(() => {
  sessionRef.current = parentSession;
  auditMock.mockClear();
});

describe("GET …/iep-report", () => {
  // Generous timeout: this is the first real repo touch in the file and can
  // absorb the cold-start cost of importing/seeding the large repo layer.
  it("returns a real PDF attachment for an owned learner", async () => {
    const res = await call(OWNED_LEARNER);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const disp = res.headers.get("content-disposition") ?? "";
    expect(disp).toContain("attachment");
    expect(disp).toMatch(/filename="IEP-Report-.*\.pdf"/);

    const body = Buffer.from(await res.arrayBuffer());
    expect(body.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(body.subarray(-5).toString("latin1")).toBe("%%EOF");
    expect(Number(res.headers.get("content-length"))).toBe(body.byteLength);

    expect(auditMock).toHaveBeenCalledWith(
      parentSession,
      "parent.iep_report.download",
      expect.any(String),
      expect.objectContaining({ learnerId: OWNED_LEARNER }),
    );
  }, 15000);

  it("forbids a learner the parent does not own", async () => {
    const res = await call("lrn_not_mine");
    expect(res.status).toBe(403);
  });

  it("forbids the wrong role", async () => {
    sessionRef.current = { ...parentSession, role: "teacher" };
    const res = await call(OWNED_LEARNER);
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    sessionRef.current = null;
    const res = await call(OWNED_LEARNER);
    expect(res.status).toBe(401);
  });
});

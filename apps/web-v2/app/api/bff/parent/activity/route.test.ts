/**
 * BFF integration for the parent "Live updates" activity feed.
 *
 * The handler lives under `app/` (vitest doesn't collect it) so we import it
 * via the `@/app/...` alias. The session is injected by stubbing
 * `getRequestSession` (the guards stay real and run against the seeded
 * in-memory store), so role + learner-scope are exercised for real. The
 * aggregator and the i18n translator are stubbed so we can assert the route's
 * own job: guard order, the `learnerId` contract, consent-label localization,
 * and the exact `{ id, kind, text, occurredAt, learnerId }` wire envelope.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SessionProfile } from "@/lib/auth/types";
import type { ParentActivityPage } from "@/lib/parent/activity";

const TENANT = "t_demo";
const PARENT = "u_parent_1"; // seeded parent who owns lrn_demo_sky
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

// Deterministic translator: interpolates params and gives consent types a
// recognizable label, so we can assert localization without the request scope.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, params: Record<string, unknown> = {}) => {
    if (key.startsWith("consent_type.")) return `LBL:${key.slice("consent_type.".length)}`;
    const tail = Object.entries(params)
      .map(([k, v]) => `${k}=${v}`)
      .join("|");
    return tail ? `${key}|${tail}` : key;
  },
}));

// Control the aggregator boundary so the route's mapping is the unit under test.
const pageRef: { current: ParentActivityPage } = { current: { events: [], nextCursor: null } };
const listMock = vi.fn(async (..._a: unknown[]) => pageRef.current);
vi.mock("@/lib/parent/activity", () => ({
  listLearnerActivity: (...a: unknown[]) => listMock(...a),
}));

async function call(qs: string) {
  const { GET } = await import("@/app/api/bff/parent/activity/route");
  const res = await GET(new Request(`https://app.aivo.test/api/bff/parent/activity${qs}`));
  return { res, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  sessionRef.current = parentSession;
  pageRef.current = { events: [], nextCursor: null };
  auditMock.mockClear();
  listMock.mockClear();
});

describe("GET /api/bff/parent/activity", () => {
  it("returns the localized wire envelope for an owned learner", async () => {
    pageRef.current = {
      events: [
        {
          id: "lesson:r1",
          kind: "lesson",
          messageKey: "lesson_completed",
          params: { name: "Sky", subject: "Reading" },
          occurredAt: "2026-06-10T10:00:00.000Z",
          learnerId: OWNED_LEARNER,
        },
        {
          id: "consent:c1:a",
          kind: "consent",
          messageKey: "consent_granted",
          params: { type: "ai_personalization" },
          occurredAt: "2026-06-09T10:00:00.000Z",
          learnerId: OWNED_LEARNER,
        },
      ],
      nextCursor: "CURSOR",
    };

    const { res, body } = await call(`?learnerId=${OWNED_LEARNER}&limit=6`);
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    const data = body.data as { events: Array<Record<string, unknown>>; nextCursor: string };
    expect(data.nextCursor).toBe("CURSOR");
    // Envelope is exactly { id, kind, text, occurredAt, learnerId } — no leaked
    // structured fields (messageKey / params).
    expect(Object.keys(data.events[0]).sort()).toEqual([
      "id",
      "kind",
      "learnerId",
      "occurredAt",
      "text",
    ]);
    expect(data.events[0].text).toBe("lesson_completed|name=Sky|subject=Reading");
    // Consent type is localized before interpolation.
    expect(data.events[1].text).toBe("consent_granted|type=LBL:ai_personalization");

    // The aggregator was scoped to the parent + learner.
    expect(listMock).toHaveBeenCalledWith(
      OWNED_LEARNER,
      TENANT,
      expect.objectContaining({ parentUserId: PARENT, limit: 6 }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      parentSession,
      "parent.activity.list",
      expect.any(String),
      expect.objectContaining({ learnerId: OWNED_LEARNER }),
    );
  });

  it("rejects a missing learnerId with a validation error", async () => {
    const { res, body } = await call(``);
    expect(res.status).toBe(400);
    expect((body.error as { code: string }).code).toBe("VALIDATION_FAILED");
    expect(listMock).not.toHaveBeenCalled();
  });

  it("forbids a learner not owned by the parent (real scope guard)", async () => {
    const { res } = await call(`?learnerId=lrn_not_mine`);
    expect(res.status).toBe(403);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("forbids the wrong role before doing any work", async () => {
    sessionRef.current = { ...parentSession, role: "learner", learnerId: OWNED_LEARNER };
    const { res, body } = await call(`?learnerId=${OWNED_LEARNER}`);
    expect(res.status).toBe(403);
    expect((body.error as { code: string }).code).toBe("FORBIDDEN_ROLE");
    expect(listMock).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    sessionRef.current = null;
    const { res } = await call(`?learnerId=${OWNED_LEARNER}`);
    expect(res.status).toBe(401);
  });
});

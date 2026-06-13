/**
 * Sprint C-13 — brain-change ACK BFF authorization + behaviour.
 *
 * The route handler lives under `app/` (vitest does not collect it), so we
 * import it via the `@/app/...` alias. The session is injected by stubbing
 * `getRequestSession` (the guards stay real). The change store + repos run for
 * real against a fresh in-memory store.
 *
 * Trust rule under test: a NON-PARENT role gets 403 — enforced server-side, not
 * just in the UI. Plus: the parent path acks a pending structural delta, is
 * idempotent, refuses a mastery / unknown id (404), and is tenant+learner
 * scoped.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SessionProfile } from "@/lib/auth/types";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

const parentSession: SessionProfile = {
  userId: PARENT,
  tenantId: TENANT,
  role: "parent",
  email: "parent@demo.aivo",
  displayName: "Pat Parent",
  permissions: [],
};

const sessionRef: { current: SessionProfile | null } = { current: parentSession };
vi.mock("@/lib/auth/session", async (orig) => {
  const actual = await orig<typeof import("@/lib/auth/session")>();
  return { ...actual, getRequestSession: vi.fn(async () => sessionRef.current) };
});
const auditMock = vi.fn();
vi.mock("@/lib/bff/audit", () => ({ audit: (...a: unknown[]) => auditMock(...a) }));

import { POST } from "@/app/api/bff/learners/[learnerId]/brain-changes/ack/route";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import { resetPersistence } from "@/lib/db/persistence";
import {
  createLearner,
  recordBrainProfileChange,
  listBrainProfileChanges,
} from "@/lib/db/repos";
import type { LearnerBrainProfileChange } from "@/lib/db/types";

function req(learnerId: string, body: unknown): Request {
  return new Request(
    `http://localhost/api/bff/learners/${learnerId}/brain-changes/ack`,
    {
      method: "POST",
      headers: { "x-request-id": "req_test", "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}
function params(learnerId: string) {
  return { params: Promise.resolve({ learnerId }) };
}

async function ownLearner(): Promise<string> {
  const l = await createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName: "Maya", birthYear: 2016 },
  });
  return l.id;
}

async function seedStructural(learnerId: string): Promise<LearnerBrainProfileChange> {
  return recordBrainProfileChange({
    tenantId: TENANT,
    learnerId,
    brainProfileId: "brp_x",
    revision: 3,
    kind: "structural",
    fields: ["accommodation.read_aloud"],
    summary: "Read-aloud turned on.",
    source: "regenerate",
    requiresAck: true,
  });
}

describe("POST brain-changes/ack — authz + behaviour", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
    sessionRef.current = parentSession;
    auditMock.mockClear();
  });

  it("a parent acks their own learner's pending structural delta (200, idempotent)", async () => {
    const learnerId = await ownLearner();
    const change = await seedStructural(learnerId);

    const res = await POST(req(learnerId, { changeId: change.id }), params(learnerId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.change.ackedAt).toBeTruthy();

    // The store row is acked, and a disclosure was recorded.
    const stored = (await listBrainProfileChanges(learnerId, TENANT))[0];
    expect(stored.ackedAt).toBeTruthy();

    // Idempotent: a second ack still 200s, keeping the first ack time.
    const firstAck = stored.ackedAt;
    const res2 = await POST(req(learnerId, { changeId: change.id }), params(learnerId));
    expect(res2.status).toBe(200);
    expect((await listBrainProfileChanges(learnerId, TENANT))[0].ackedAt).toBe(firstAck);
  });

  it("a NON-PARENT role gets 403 — never acks", async () => {
    const learnerId = await ownLearner();
    const change = await seedStructural(learnerId);
    sessionRef.current = { ...parentSession, role: "teacher" };

    const res = await POST(req(learnerId, { changeId: change.id }), params(learnerId));
    expect(res.status).toBe(403);
    // Untouched.
    expect((await listBrainProfileChanges(learnerId, TENANT))[0].ackedAt).toBeNull();
  });

  it("an unknown changeId → 404 (a forged id flips nothing)", async () => {
    const learnerId = await ownLearner();
    await seedStructural(learnerId);
    const res = await POST(req(learnerId, { changeId: "bpc_does_not_exist" }), params(learnerId));
    expect(res.status).toBe(404);
  });

  it("a mastery change cannot be acked (404 — only structural deltas are ackable)", async () => {
    const learnerId = await ownLearner();
    const mastery = await recordBrainProfileChange({
      tenantId: TENANT,
      learnerId,
      brainProfileId: "brp_x",
      revision: 4,
      kind: "mastery",
      fields: ["masteryLevels.math"],
      summary: "Math progress.",
      source: "engagement_sync",
      requiresAck: false,
    });
    const res = await POST(req(learnerId, { changeId: mastery.id }), params(learnerId));
    expect(res.status).toBe(404);
  });

  it("a parent who does not own the learner is out of scope (not 200)", async () => {
    // Seed a change under a learner owned by a DIFFERENT parent.
    const other = await createLearner({
      tenantId: TENANT,
      parentUserId: "u_other_parent",
      data: { firstName: "Theo", birthYear: 2015 },
    });
    const change = await seedStructural(other.id);
    // Current session is PARENT, who does not own `other`.
    const res = await POST(req(other.id, { changeId: change.id }), params(other.id));
    expect(res.status).not.toBe(200);
    expect((await listBrainProfileChanges(other.id, TENANT))[0].ackedAt).toBeNull();
  });
});

/**
 * Sprint C-07 — Teacher assessment BFF integration.
 *
 * The route handler lives under `app/` (vitest does not collect it), so we
 * import it via the `@/app/...` alias — same pattern as today-start-bff.
 * The session is injected by stubbing `getRequestSession` (the guards stay
 * real). Roster scope, the draft store, validators, and the submit
 * projection all run for real against a fresh in-memory store. The two
 * upstream calls (assessment-svc, family-svc) are stubbed at the fetch /
 * family-svc boundary so we can drive submit-success and mirror-failure.
 *
 * Asserts:
 *   - role + roster scope (a teacher NOT on the roster → 403)
 *   - PATCH validates + persists a section (autosave)
 *   - resume: a second GET after a PATCH returns the saved section
 *   - submit posts to assessment-svc, captures elapsed-time TELEMETRY,
 *     and mirrors a summary insight
 *   - mirror-failure: family-svc down → submit still 201, mirror "deferred",
 *     deferred event audited (no silent loss)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { SessionProfile } from "@/lib/auth/types";

const TENANT = "t_demo";
const TEACHER = "u_teacher_1"; // seeded teacher with a classroom + learners

const teacherSession: SessionProfile = {
  userId: TEACHER,
  tenantId: TENANT,
  role: "teacher",
  email: "teacher@demo.aivo",
  displayName: "Sam Teacher",
  permissions: [],
};

// Inject the session at the guards' source (requireSession/requireRole stay
// real). Other roles/no-session are exercised elsewhere; here we focus on
// the teacher path + roster scope.
const sessionRef: { current: SessionProfile | null } = { current: teacherSession };
vi.mock("@/lib/auth/session", async (orig) => {
  const actual = await orig<typeof import("@/lib/auth/session")>();
  return { ...actual, getRequestSession: vi.fn(async () => sessionRef.current) };
});

// Capture telemetry without persisting (audit is fire-and-forget anyway).
const auditMock = vi.fn();
vi.mock("@/lib/bff/audit", () => ({ audit: (...a: unknown[]) => auditMock(...a) }));

// Control the family-svc mirror boundary.
const familyState = {
  enabled: true,
  bearer: "Bearer test-token" as string | null,
  createResult: { ok: true as boolean, status: 200, error: "" },
};
const createTeacherInsightMock = vi.fn(
  async (..._args: unknown[]) =>
    familyState.createResult.ok
      ? { ok: true, data: { insight: { id: "ins_1" } } }
      : {
          ok: false,
          status: familyState.createResult.status,
          error: familyState.createResult.error,
        },
);
vi.mock("@/lib/bff/family-svc", () => ({
  isFamilySvcEnabled: () => familyState.enabled,
  getFamilyBearer: async () => familyState.bearer,
  createTeacherInsight: (...a: unknown[]) => createTeacherInsightMock(...a),
}));

import { GET, PATCH, POST } from "@/app/api/bff/learners/[learnerId]/teacher-assessment/route";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import { resetPersistence } from "@/lib/db/persistence";
import { listLearnersForTeacher, createLearner } from "@/lib/db/repos";

function req(learnerId: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost/api/bff/learners/${learnerId}/teacher-assessment`, {
    method,
    headers: { "x-request-id": "req_test", "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
function params(learnerId: string) {
  return { params: Promise.resolve({ learnerId }) };
}

/** A learner the seeded teacher genuinely has on their roster. */
async function inScopeLearner(): Promise<string> {
  const learners = await listLearnersForTeacher(TEACHER, TENANT);
  expect(learners.length, "seed must give u_teacher_1 at least one learner").toBeGreaterThan(0);
  return learners[0]!.id;
}

// fetch stub: assessment-svc submit + status. Default: submit OK.
let svcSubmitStatus = 200;
const originalFetch = global.fetch;
function stubFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/assessments/teacher") && url.endsWith("/status")) {
      return new Response(JSON.stringify({ completed: false }), { status: 200 });
    }
    if (url.includes("/api/assessments/teacher")) {
      return new Response(JSON.stringify({ assessment: { id: "tea_svc_1" } }), {
        status: svcSubmitStatus,
      });
    }
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
}

describe("teacher-assessment BFF", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
    auditMock.mockClear();
    createTeacherInsightMock.mockClear();
    sessionRef.current = teacherSession;
    familyState.enabled = true;
    familyState.bearer = "Bearer test-token";
    familyState.createResult = { ok: true, status: 200, error: "" };
    svcSubmitStatus = 200;
    stubFetch();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("403s a teacher who is not on the learner's roster (Trust rule)", async () => {
    // A brand-new learner the seeded teacher has no classroom link to.
    const stranger = await createLearner({
      tenantId: TENANT,
      parentUserId: "u_demo_parent",
      data: { firstName: "Unlinked", birthYear: 2015 },
    });
    const res = await POST(req(stranger.id, "POST", {}), params(stranger.id));
    expect(res.status).toBe(403);
    const json = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("FORBIDDEN_LEARNER");
  });

  it("PATCH validates and persists a section; GET resumes it", async () => {
    const learnerId = await inScopeLearner();
    const patchRes = await PATCH(
      req(learnerId, "PATCH", {
        section: "classroom_context",
        data: { cc_role: "general_ed", cc_grade: "3-5" },
      }),
      params(learnerId),
    );
    expect(patchRes.status).toBe(200);

    // A fresh GET (simulating reopening the tab) returns the saved section.
    const getRes = await GET(req(learnerId, "GET"), params(learnerId));
    expect(getRes.status).toBe(200);
    const json = (await getRes.json()) as {
      data: { draft: { answers: Record<string, unknown>; completedSections: string[] } };
    };
    expect(json.data.draft.completedSections).toContain("classroom_context");
    expect(json.data.draft.answers.classroom_context).toMatchObject({
      cc_role: "general_ed",
      cc_grade: "3-5",
    });
  });

  it("rejects an invalid section payload with 400", async () => {
    const learnerId = await inScopeLearner();
    const res = await PATCH(
      req(learnerId, "PATCH", { section: "classroom_context", data: { cc_role: "principal" } }),
      params(learnerId),
    );
    expect(res.status).toBe(400);
  });

  it("submit posts to assessment-svc, captures elapsed telemetry, and mirrors the insight", async () => {
    const learnerId = await inScopeLearner();
    // Build a draft across two sections.
    await PATCH(
      req(learnerId, "PATCH", {
        section: "classroom_context",
        data: { cc_role: "general_ed", cc_grade: "3-5" },
      }),
      params(learnerId),
    );
    await PATCH(
      req(learnerId, "PATCH", {
        section: "academic_strengths",
        data: { as_strong_subjects: ["reading", "math"] },
      }),
      params(learnerId),
    );

    const startedAtMs = Date.now() - 272_000; // ~4:32 ago
    const res = await POST(req(learnerId, "POST", { startedAtMs }), params(learnerId));
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      ok: boolean;
      data: { assessment: { id: string }; elapsedSeconds: number; mirror: string };
    };
    expect(json.ok).toBe(true);
    expect(json.data.assessment.id).toBe("tea_svc_1");
    expect(json.data.elapsedSeconds).toBeGreaterThanOrEqual(270);
    expect(json.data.mirror).toBe("written");

    // Mirror fired with a strengths-first summary.
    expect(createTeacherInsightMock).toHaveBeenCalledTimes(1);
    const mirrorArg = createTeacherInsightMock.mock.calls[0]![1] as { insightText: string };
    expect(mirrorArg.insightText).toContain("Reading");

    // Telemetry: a submit audit event carrying elapsedSeconds (DoD: median
    // time-to-complete must be measurable).
    const submitCall = auditMock.mock.calls.find((c) => c[1] === "teacher_assessment.submit");
    expect(submitCall, "a teacher_assessment.submit audit event").toBeTruthy();
    const meta = submitCall![3] as { metadata: { elapsedSeconds: number; assessmentId: string } };
    expect(meta.metadata.elapsedSeconds).toBeGreaterThanOrEqual(270);
    expect(meta.metadata.assessmentId).toBe("tea_svc_1");
  });

  it("mirror-failure: family-svc down → submit still 201, mirror deferred, deferred event audited", async () => {
    const learnerId = await inScopeLearner();
    await PATCH(
      req(learnerId, "PATCH", {
        section: "classroom_context",
        data: { cc_role: "special_ed", cc_grade: "6-8" },
      }),
      params(learnerId),
    );
    familyState.createResult = { ok: false, status: 502, error: "family-svc unreachable" };

    const res = await POST(req(learnerId, "POST", { startedAtMs: Date.now() - 5000 }), params(learnerId));
    expect(res.status).toBe(201); // submit is NOT failed by a mirror error
    const json = (await res.json()) as { data: { mirror: string } };
    expect(json.data.mirror).toBe("deferred");

    // No silent loss: the deferral is audited.
    const deferred = auditMock.mock.calls.find(
      (c) => c[1] === "teacher_assessment.mirror_deferred",
    );
    expect(deferred, "a mirror_deferred audit event").toBeTruthy();
  });

  it("assessment-svc failure fails the submit (system of record must succeed)", async () => {
    const learnerId = await inScopeLearner();
    await PATCH(
      req(learnerId, "PATCH", {
        section: "classroom_context",
        data: { cc_role: "general_ed", cc_grade: "K" },
      }),
      params(learnerId),
    );
    svcSubmitStatus = 503;
    const res = await POST(req(learnerId, "POST", {}), params(learnerId));
    expect(res.status).toBe(502);
    const json = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("UPSTREAM_UNAVAILABLE");
    // The mirror must NOT fire when the system-of-record write failed.
    expect(createTeacherInsightMock).not.toHaveBeenCalled();
  });

  it("a non-teacher role is forbidden", async () => {
    const learnerId = await inScopeLearner();
    sessionRef.current = { ...teacherSession, role: "learner", learnerId: "x" };
    const res = await GET(req(learnerId, "GET"), params(learnerId));
    expect(res.status).toBe(403);
  });
});

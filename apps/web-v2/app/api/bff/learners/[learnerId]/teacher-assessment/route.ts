/**
 * Sprint C-07 — Teacher assessment BFF.
 *
 *   GET   /api/bff/learners/:learnerId/teacher-assessment
 *           → { draft, status } — the autosave draft for THIS teacher plus
 *             the assessment-svc completion status (for the resume/contributed
 *             affordances).
 *   PATCH → validate one wizard section and persist it to the web-v2 draft
 *             store (autosave). Returns the updated draft.
 *   POST  → final submit. Projects the accumulated draft into the
 *             assessment-svc `POST /api/assessments/teacher` payload (system of
 *             record), captures elapsed-time telemetry, marks the local draft
 *             submitted, and best-effort mirrors a summary insight to family-svc
 *             (`createTeacherInsight`) so the brain-clone collaborator fold sees
 *             the contribution. A family-svc failure NEVER fails the submit —
 *             it is surfaced as `mirror: "deferred"` so there is no silent loss.
 *
 * Guards mirror the therapist BFF: web session + role `teacher` (+ admin
 * roles per the service contract) + ROSTER SCOPE. The roster scope is the
 * same `teacherCanAccessLearner` mechanism the teacher pages use; a teacher
 * with no shared classroom / no ACCEPTED link for the learner gets a 403
 * here (Trust rule), and assessment-svc independently re-enforces the
 * ACCEPTED `learner_teachers` link as the system of record.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  getLearner,
  teacherCanAccessLearner,
  getOrCreateTeacherAssessmentDraft,
  patchTeacherAssessmentSection,
  markTeacherAssessmentDraftSubmitted,
} from "@/lib/db/repos";
import {
  TEACHER_ASSESSMENT_SECTION_ORDER,
  validateTeacherSection,
  toTeacherSubmitPayload,
  toTeacherInsightSummary,
  type TeacherAssessmentSectionId,
} from "@/lib/validators/teacher-assessment";
import { isFamilySvcEnabled, getFamilyBearer, createTeacherInsight } from "@/lib/bff/family-svc";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** Roles allowed to author/read a teacher assessment via this BFF. Admin
 *  roles ride the same surface (the service contract widens to them); the
 *  roster-scope gate below still applies to the `teacher` role. */
const ALLOWED_ROLES = ["teacher", "school_admin", "district_admin", "platform_admin"] as const;

const PatchBody = z.object({
  section: z.enum(
    TEACHER_ASSESSMENT_SECTION_ORDER as [
      TeacherAssessmentSectionId,
      ...TeacherAssessmentSectionId[],
    ],
  ),
  data: z.unknown(),
});

const SubmitBody = z.object({
  /** Wall-clock the wizard started, ms epoch. The client owns the timer
   *  (the draft's startedAtMs is the server fallback) so the elapsed value
   *  reflects the user's real session, surviving server restarts. */
  startedAtMs: z.number().int().positive().optional(),
});

/**
 * Shared gate: session + role + roster scope. For the `teacher` role the
 * learner MUST be on the teacher's roster (shared classroom / accepted
 * link) — a stranger teacher gets 403. Admin roles pass on tenant scope
 * (the learner-in-tenant check). Returns a populated `gate` on success or
 * a `response` to short-circuit.
 */
async function gateTeacherScope(req: Request, learnerId: string, requestId: string) {
  const { session, response } = await requireSession(req, requestId);
  if (response) return { response } as const;
  const roleErr = requireRole(session!, [...ALLOWED_ROLES], requestId);
  if (roleErr) return { response: roleErr } as const;

  const learner = await getLearner(learnerId, session!.tenantId);
  if (!learner) {
    return {
      response: fail(
        { ...ERRORS.FORBIDDEN_LEARNER, message: "Learner not found in tenant" },
        requestId,
      ),
    } as const;
  }

  if (session!.role === "teacher") {
    const onRoster = await teacherCanAccessLearner(session!.userId, learnerId, session!.tenantId);
    if (!onRoster) {
      // Trust rule: a teacher with no accepted link to the learner is
      // forbidden — never a soft 404 that hides the boundary.
      return {
        response: fail(
          { ...ERRORS.FORBIDDEN_LEARNER, message: "Learner is not on your roster" },
          requestId,
        ),
      } as const;
    }
  }
  return { session: session!, learner } as const;
}

/** GET the assessment-svc completion status (best-effort; degrades to not
 *  completed when the token/flag is absent or the service is down). */
async function fetchTeacherStatus(
  learnerId: string,
  bearer: string | null,
): Promise<{ completed: boolean; completedAt: string | null; teacherRole: string | null }> {
  const empty = { completed: false, completedAt: null, teacherRole: null };
  try {
    const res = await fetch(
      `${serverEnv.ASSESSMENT_SVC_URL}/api/assessments/teacher/${encodeURIComponent(
        learnerId,
      )}/status`,
      {
        method: "GET",
        headers: {
          "content-type": "application/json",
          "x-internal-service": "web-v2-bff",
          ...(bearer ? { authorization: bearer } : {}),
          ...(serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN
            ? { "x-service-token": serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN }
            : {}),
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return empty;
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      completed: Boolean(json.completed),
      completedAt: typeof json.completedAt === "string" ? json.completedAt : null,
      teacherRole: typeof json.teacherRole === "string" ? json.teacherRole : null,
    };
  } catch {
    return empty;
  }
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const gate = await gateTeacherScope(req, learnerId, requestId);
    if (gate.response) return gate.response;
    const { session } = gate;

    const draft = await getOrCreateTeacherAssessmentDraft(
      learnerId,
      session.tenantId,
      session.userId,
    );
    const status = await fetchTeacherStatus(learnerId, await getFamilyBearer());
    return ok({ draft, status }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const gate = await gateTeacherScope(req, learnerId, requestId);
    if (gate.response) return gate.response;
    const { session } = gate;

    const body = await req.json().catch(() => ({}));
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }
    const v = validateTeacherSection(parsed.data.section, parsed.data.data);
    if (!v.ok) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: v.message }, requestId);
    }
    const next = await patchTeacherAssessmentSection(
      learnerId,
      session.tenantId,
      session.userId,
      parsed.data.section,
      v.data,
    );
    audit(session, "teacher_assessment.section.patch", requestId, {
      learnerId,
      metadata: { section: parsed.data.section },
    });
    return ok({ draft: next }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const gate = await gateTeacherScope(req, learnerId, requestId);
    if (gate.response) return gate.response;
    const { session, learner } = gate;

    const body = await req.json().catch(() => ({}));
    const parsedBody = SubmitBody.safeParse(body);
    if (!parsedBody.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsedBody.error.message }, requestId);
    }

    const draft = await getOrCreateTeacherAssessmentDraft(
      learnerId,
      session.tenantId,
      session.userId,
    );

    // Submit to assessment-svc (system of record). Every field except
    // learnerId is optional there, so a partial professional contribution
    // is accepted; the projection drops empty sections cleanly.
    const payload = toTeacherSubmitPayload(learnerId, draft.answers);
    const svcRes = await fetch(`${serverEnv.ASSESSMENT_SVC_URL}/api/assessments/teacher`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-service": "web-v2-bff",
        ...(serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN
          ? { "x-service-token": serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN }
          : {}),
      },
      body: JSON.stringify({
        ...payload,
        additionalResponses: {
          ...payload.additionalResponses,
          // Record the web identity for the audit trail — the assessment-svc
          // SERVICE principal carries no user sub (same as the therapist BFF).
          submittedViaWebBff: true,
          webUserId: session.userId,
          webUserEmail: session.email,
        },
      }),
    });
    if (!svcRes.ok) {
      const detail = await svcRes.text().catch(() => "");
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: `assessment-svc teacher submit failed: ${svcRes.status} ${detail.slice(0, 300)}`,
          userMessage: "Couldn't save your assessment — please try again in a moment.",
        },
        requestId,
      );
    }
    const svcData = (await svcRes.json().catch(() => ({}))) as {
      assessment?: { id?: string };
    };

    // Elapsed time-to-complete. The client timer wins (real session wall
    // clock), with the draft's server-side startedAtMs as the fallback.
    const startedAtMs = parsedBody.data.startedAtMs ?? draft.startedAtMs;
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAtMs) / 1000));

    await markTeacherAssessmentDraftSubmitted(learnerId, session.tenantId, session.userId);

    // Telemetry: median time-to-complete must be measurable (DoD). The
    // audit pipeline persists a durable row AND emits a structured log
    // line carrying elapsedSeconds.
    audit(session, "teacher_assessment.submit", requestId, {
      learnerId,
      metadata: {
        assessmentId: svcData.assessment?.id ?? null,
        elapsedSeconds,
        sectionsCompleted: draft.completedSections.length,
      },
    });

    // Best-effort mirror to family-svc so the brain-clone collaborator fold
    // sees the teacher's contribution. A failure here NEVER fails the submit
    // (the system-of-record write already succeeded) — we report it as a
    // deferred mirror so there is no silent loss and the UI can be honest.
    let mirror: "written" | "deferred" = "deferred";
    let mirrorDetail: string | null = null;
    try {
      const bearer = await getFamilyBearer();
      if (isFamilySvcEnabled() && bearer) {
        const summary = toTeacherInsightSummary(learner.displayName, draft.answers);
        const r = await createTeacherInsight(bearer, {
          learnerId,
          insightText: summary.insightText,
          domain: summary.domain,
        });
        if (r.ok) {
          mirror = "written";
        } else {
          mirrorDetail = r.error;
        }
      } else {
        mirrorDetail = "family-svc not enabled or no access token";
      }
    } catch (err) {
      mirrorDetail = err instanceof Error ? err.message : "mirror failed";
    }
    if (mirror === "deferred") {
      audit(session, "teacher_assessment.mirror_deferred", requestId, {
        learnerId,
        metadata: { reason: mirrorDetail },
      });
    }

    return ok(
      {
        assessment: svcData.assessment ?? null,
        elapsedSeconds,
        mirror,
      },
      requestId,
      { status: 201 },
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

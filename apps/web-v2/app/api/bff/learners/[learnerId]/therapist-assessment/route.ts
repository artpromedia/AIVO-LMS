/**
 * Therapist assessment BFF.
 *
 *   GET   /api/bff/learners/:learnerId/therapist-assessment
 *           → { draft, status, iep } — the autosave draft for THIS therapist,
 *             the assessment-svc completion status (resume affordance), and the
 *             learner's IEP goals + accommodations summary for the side-panel
 *             (authorized, role-appropriate read — never raw IEP text).
 *   PATCH → autosave the single-page form payload to the web-v2 draft store.
 *             Returns the updated draft + a "savedAt" stamp for the indicator.
 *   POST  → final submit. Proxies to assessment-svc (system of record),
 *             captures elapsed-time telemetry, marks the local draft submitted,
 *             and returns a timestamped summary record of exactly what was
 *             shared so the form can render the post-submit record screen.
 *
 * Sprint 6 introduced the POST proxy; Sprint C-10 adds the autosave draft
 * (GET/PATCH), the IEP side-panel read, and the submission summary record.
 *
 * Guards (unchanged): web session + role `therapist` + CASELOAD SCOPE (the
 * learner must be on this therapist's accepted care-team list). A therapist
 * with no accepted link to the learner gets 403 (Trust rule); assessment-svc
 * independently re-enforces the ACCEPTED `learner_therapists` link as the
 * system of record.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { listLearnersForMember } from "@/lib/db/team-invites";
import {
  getIEPForLearner,
  getOrCreateTherapistAssessmentDraft,
  patchTherapistAssessmentForm,
  markTherapistAssessmentDraftSubmitted,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** The therapist intake fields. Every field except discipline is optional —
 *  partial professional contributions are welcome (the baseline degrades
 *  gracefully). Shared by PATCH (autosave) and POST (submit); POST requires a
 *  discipline so the system-of-record row is well-formed. */
const formShape = {
  therapyDiscipline: z.enum(["speech", "occupational", "behavioral", "physical", "other"]),
  areasOfFocus: z.array(z.string().max(200)).max(20).default([]),
  strengths: z.array(z.string().max(200)).max(20).default([]),
  challenges: z.array(z.string().max(200)).max(20).default([]),
  sensoryNotes: z.string().max(4000).optional(),
  communicationNotes: z.string().max(4000).optional(),
  regulationStrategies: z.array(z.string().max(200)).max(20).default([]),
  recommendedAccommodations: z.array(z.string().max(200)).max(20).default([]),
  observations: z.string().max(8000).optional(),
} as const;

const submitSchema = z.object({
  ...formShape,
  /** Wall-clock the form was opened, ms epoch — the client owns the timer so
   *  the elapsed value reflects the real session. The draft's startedAtMs is
   *  the server-side fallback. */
  startedAtMs: z.number().int().positive().optional(),
});

/** Autosave accepts the same fields but discipline is optional too (the form
 *  may be saved before the clinician confirms a discipline). */
const patchSchema = z.object({
  therapyDiscipline: z.enum(["speech", "occupational", "behavioral", "physical", "other"]).optional(),
  areasOfFocus: z.array(z.string().max(200)).max(20).optional(),
  strengths: z.array(z.string().max(200)).max(20).optional(),
  challenges: z.array(z.string().max(200)).max(20).optional(),
  sensoryNotes: z.string().max(4000).optional(),
  communicationNotes: z.string().max(4000).optional(),
  regulationStrategies: z.array(z.string().max(200)).max(20).optional(),
  recommendedAccommodations: z.array(z.string().max(200)).max(20).optional(),
  observations: z.string().max(8000).optional(),
});

/**
 * Shared gate: session + role `therapist` + caseload scope. Returns the
 * session on success or a `response` to short-circuit. The IEP side-panel and
 * the draft are only reachable once this passes, so the IEP read can never
 * widen access beyond a clinician's own caseload.
 */
async function gateTherapistScope(req: Request, learnerId: string, requestId: string) {
  const { session, response } = await requireSession(req, requestId);
  if (response) return { response } as const;
  const roleErr = requireRole(session!, ["therapist"], requestId);
  if (roleErr) return { response: roleErr } as const;

  const caseload = await listLearnersForMember(
    session!.userId,
    session!.email,
    "therapist",
    session!.tenantId,
  );
  if (!caseload.includes(learnerId)) {
    return {
      response: fail(
        { ...ERRORS.FORBIDDEN_LEARNER, message: "Learner is not on your caseload" },
        requestId,
      ),
    } as const;
  }
  return { session: session! } as const;
}

/**
 * Authorized, role-appropriate IEP read for the therapist side-panel.
 * Therapists hold `read_brain_hipaa` / `therapy_goals`, so they see the SAME
 * structured, professional-facing extraction a teacher sees — active learning
 * goals, the accommodations + service areas, and the clinician summary. Raw IEP
 * text and parent/learner-only narratives are never surfaced. Returns a
 * compact panel shape (or `{ onFile: false }` for the empty state).
 */
async function readIepPanel(learnerId: string, tenantId: string) {
  const iep = await getIEPForLearner(learnerId, tenantId);
  if (!iep || !iep.extraction) return { onFile: false } as const;
  const x = iep.extraction;
  return {
    onFile: true,
    goals: x.learningGoals ?? [],
    accommodations: x.accommodations ?? [],
    serviceAreas: x.serviceAreas ?? [],
    // The clinician-facing summary only — never parentSummary/learnerSafeSummary.
    summary: x.teacherSummary || null,
    uploadedAt: iep.uploadedAt,
  } as const;
}

/** GET the assessment-svc completion status (best-effort; degrades to not
 *  completed when the token/flag is absent or the service is down). */
async function fetchTherapistStatus(
  learnerId: string,
): Promise<{ completed: boolean; completedAt: string | null; therapyDiscipline: string | null }> {
  const empty = { completed: false, completedAt: null, therapyDiscipline: null };
  try {
    const res = await fetch(
      `${serverEnv.ASSESSMENT_SVC_URL}/api/assessments/therapist/${encodeURIComponent(
        learnerId,
      )}/status`,
      {
        method: "GET",
        headers: {
          "content-type": "application/json",
          "x-internal-service": "web-v2-bff",
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
      therapyDiscipline:
        typeof json.therapyDiscipline === "string" ? json.therapyDiscipline : null,
    };
  } catch {
    return empty;
  }
}

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const gate = await gateTherapistScope(req, learnerId, requestId);
    if (gate.response) return gate.response;
    const { session } = gate;

    const draft = await getOrCreateTherapistAssessmentDraft(
      learnerId,
      session.tenantId,
      session.userId,
    );
    const [status, iep] = await Promise.all([
      fetchTherapistStatus(learnerId),
      readIepPanel(learnerId, session.tenantId),
    ]);
    return ok({ draft, status, iep }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const gate = await gateTherapistScope(req, learnerId, requestId);
    if (gate.response) return gate.response;
    const { session } = gate;

    const json = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }
    const next = await patchTherapistAssessmentForm(
      learnerId,
      session.tenantId,
      session.userId,
      parsed.data,
    );
    audit(session, "therapist_assessment.autosave", requestId, { learnerId });
    return ok({ draft: next, savedAt: next.updatedAt }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const gate = await gateTherapistScope(req, learnerId, requestId);
    if (gate.response) return gate.response;
    const { session } = gate;

    const json = await req.json().catch(() => ({}));
    const parsed = submitSchema.safeParse(json);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }
    const { startedAtMs: clientStartedAtMs, ...payload } = parsed.data;

    const res = await fetch(`${serverEnv.ASSESSMENT_SVC_URL}/api/assessments/therapist`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-service": "web-v2-bff",
        ...(serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN
          ? { "x-service-token": serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN }
          : {}),
      },
      body: JSON.stringify({
        learnerId,
        ...payload,
        additionalResponses: {
          submittedViaWebBff: true,
          webUserId: session.userId,
          webUserEmail: session.email,
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: `assessment-svc therapist submit failed: ${res.status} ${detail.slice(0, 300)}`,
          userMessage: "Couldn't save the assessment — try again shortly.",
        },
        requestId,
      );
    }
    const data = (await res.json()) as { assessment: { id: string } };

    // Elapsed time-to-complete: the client timer wins (real session wall
    // clock), with the draft's server-side startedAtMs as the fallback.
    const draft = await getOrCreateTherapistAssessmentDraft(
      learnerId,
      session.tenantId,
      session.userId,
    );
    const startedAtMs = clientStartedAtMs ?? draft.startedAtMs;
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAtMs) / 1000));

    await markTherapistAssessmentDraftSubmitted(learnerId, session.tenantId, session.userId);

    const submittedAt = new Date().toISOString();
    audit(session, "therapist_assessment.submit", requestId, {
      learnerId,
      metadata: {
        assessmentId: data.assessment?.id,
        discipline: payload.therapyDiscipline,
        elapsedSeconds,
      },
    });

    // The submission summary record — exactly what was shared, timestamped, so
    // the form can render the post-submit record screen and the clinician keeps
    // a reviewable trace of their contribution.
    const record = {
      assessmentId: data.assessment?.id ?? null,
      submittedAt,
      elapsedSeconds,
      therapyDiscipline: payload.therapyDiscipline,
      areasOfFocus: payload.areasOfFocus,
      strengths: payload.strengths,
      challenges: payload.challenges,
      regulationStrategies: payload.regulationStrategies,
      recommendedAccommodations: payload.recommendedAccommodations,
      sensoryNotes: payload.sensoryNotes ?? null,
      communicationNotes: payload.communicationNotes ?? null,
      observations: payload.observations ?? null,
    };
    return ok({ assessment: data.assessment, record }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

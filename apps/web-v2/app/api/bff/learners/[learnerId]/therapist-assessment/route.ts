/**
 * Sprint 6: POST /api/bff/learners/:learnerId/therapist-assessment
 *
 * Therapist intake feeding the baseline generator. Guards: web session with
 * the therapist role + caseload scope (the learner must be on this
 * therapist's accepted care-team list). Proxies to assessment-svc with the
 * internal service token — the same bridge the baseline-llm and IEP flows
 * use — recording the web identity in additionalResponses for the audit
 * trail (assessment-svc's SERVICE principal carries no user sub).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { listLearnersForMember } from "@/lib/db/team-invites";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

const bodySchema = z.object({
  therapyDiscipline: z.enum(["speech", "occupational", "behavioral", "physical", "other"]),
  areasOfFocus: z.array(z.string().max(200)).max(20).default([]),
  strengths: z.array(z.string().max(200)).max(20).default([]),
  challenges: z.array(z.string().max(200)).max(20).default([]),
  sensoryNotes: z.string().max(4000).optional(),
  communicationNotes: z.string().max(4000).optional(),
  regulationStrategies: z.array(z.string().max(200)).max(20).default([]),
  recommendedAccommodations: z.array(z.string().max(200)).max(20).default([]),
  observations: z.string().max(8000).optional(),
});

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["therapist"], requestId);
    if (roleErr) return roleErr;

    // Caseload scope: therapists may only submit for learners on their
    // accepted care-team list (mirrors the therapist home page's scoping).
    const caseload = await listLearnersForMember(
      session!.userId,
      session!.email,
      "therapist",
      session!.tenantId,
    );
    if (!caseload.includes(learnerId)) {
      return fail(
        { ...ERRORS.FORBIDDEN_LEARNER, message: "Learner is not on your caseload" },
        requestId,
      );
    }

    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }

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
        ...parsed.data,
        additionalResponses: {
          submittedViaWebBff: true,
          webUserId: session!.userId,
          webUserEmail: session!.email,
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
    audit(session!, "therapist_assessment.submit", requestId, {
      learnerId,
      metadata: { assessmentId: data.assessment?.id, discipline: parsed.data.therapyDiscipline },
    });
    return ok({ assessment: data.assessment }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

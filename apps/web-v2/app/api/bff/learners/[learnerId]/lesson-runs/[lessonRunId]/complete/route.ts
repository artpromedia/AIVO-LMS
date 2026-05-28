import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { z } from "zod";
import { completeLessonRun, deriveOutcomeFromInteractions, getLessonRun } from "@/lib/db/repos";

/**
 * Post-architect-review: the client is no longer trusted to report check
 * counts, hint usage, scaffold usage, or time spent. The BFF derives the
 * outcome from server-recorded LessonInteraction rows and only accepts the
 * UX-only `abandoned` flag from the client. Submitting any other key in
 * `outcome` fails validation.
 */
const BodySchema = z
  .object({
    outcome: z
      .object({ abandoned: z.boolean().default(false) })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; lessonRunId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, lessonRunId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;
    const found = await getLessonRun(lessonRunId, session!.tenantId);
    if (!found || found.lessonRun.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Lesson run not found" }, requestId);
    }
    if (found.lessonRun.status === "failed" || found.lessonRun.status === "generating") {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: `Cannot complete a ${found.lessonRun.status} run`,
        },
        requestId,
      );
    }
    let abandoned = false;
    if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
      try {
        const raw = await req.json();
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) {
          return fail(
            {
              ...ERRORS.VALIDATION_FAILED,
              message: parsed.error.issues[0]?.message ?? "Invalid outcome",
            },
            requestId,
          );
        }
        abandoned = parsed.data?.outcome?.abandoned ?? false;
      } catch {
        // No JSON body — that's fine, outcome is fully optional.
      }
    }
    const wasAlreadyComplete = found.lessonRun.status === "completed";
    // Authoritative outcome derived server-side from recorded interactions.
    const derivedOutcome = wasAlreadyComplete
      ? undefined
      : deriveOutcomeFromInteractions(found.lessonRun, abandoned);
    const updated = await completeLessonRun(lessonRunId, session!.tenantId, derivedOutcome);
    if (!updated) return fail({ ...ERRORS.NOT_FOUND, message: "Lesson run not found" }, requestId);
    if (!wasAlreadyComplete) {
      audit(session!, "lesson_run.complete", requestId, {
        learnerId,
        metadata: {
          lessonRunId: updated.id,
          subjectId: updated.subjectId,
          skillId: updated.skillId,
        },
      });
    }
    return ok({ lessonRun: updated, alreadyCompleted: wasAlreadyComplete }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

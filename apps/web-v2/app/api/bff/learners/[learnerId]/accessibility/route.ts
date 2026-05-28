/**
 * Sprint 15: GET + PATCH /api/bff/learners/:learnerId/accessibility
 *
 * GET returns the persisted preferences (or defaults). PATCH applies a
 * partial update with strict validation.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { getAccessibilityPrefs, getLearner, updateAccessibilityPrefs } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

const PatchSchema = z
  .object({
    reducedMotion: z.boolean().optional(),
    highContrast: z.boolean().optional(),
    largeText: z.boolean().optional(),
    audioFirst: z.boolean().optional(),
    captionsAlwaysOn: z.boolean().optional(),
    hapticsEnabled: z.boolean().optional(),
    readAloud: z.boolean().optional(),
    dyslexiaFriendlyFont: z.boolean().optional(),
    shorterSteps: z.boolean().optional(),
    extraHints: z.boolean().optional(),
    visualSupports: z.boolean().optional(),
    breakReminders: z.boolean().optional(),
    keyboardOptimized: z.boolean().optional(),
  })
  .strict();

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(
      session!,
      ["parent", "learner", "teacher", "school_admin"],
      requestId,
    );
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;
    if (!getLearner(learnerId, session!.tenantId)) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    const prefs = getAccessibilityPrefs(learnerId, session!.tenantId);
    return ok({ accessibility: prefs }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
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
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;
    if (!getLearner(learnerId, session!.tenantId)) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);
    }
    const raw = await req.json().catch(() => ({}));
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid preferences",
        },
        requestId,
      );
    }
    const next = updateAccessibilityPrefs(learnerId, session!.tenantId, parsed.data);
    audit(session!, "accessibility.update", requestId, {
      learnerId,
      metadata: { changedKeys: Object.keys(parsed.data) },
    });
    return ok({ accessibility: next }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

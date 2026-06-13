import { NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { getBrainProfile, recordContributionAcknowledgements } from "@/lib/db/repos";

/**
 * Sprint C-16 — the cross-stack contributor-acknowledgement trigger.
 *
 * The contributor feedback loop fires on APPROVAL (C-06's record write — "both
 * stacks per C-12"). The web-v2 approval ceremony triggers it directly in
 * `performBrainApproval`; THIS route is the seam for the OTHER stack: when
 * brain-svc owns the approval (its `POST /api/brain/{id}/approve` handler), it
 * calls here best-effort so web-v2 — the single owner of the contributor
 * surfaces, the acknowledgement records, the notification machinery, and the
 * privacy logic — derives + records the acknowledgements from its own profile
 * state. (The C-13 precedent: brain-svc writes the shared record; web does the
 * notifying.)
 *
 * Auth is the shared `INTERNAL_SERVICE_TOKEN` (`x-service-token`), the same
 * service-to-service seam the creator/pacing integrations use — never browsers.
 *
 * Idempotent: `recordContributionAcknowledgements` is keyed on (contributor,
 * learner, revision), so a duplicate trigger (web + brain-svc both firing for
 * the same approval) never produces a duplicate acknowledgement or notification.
 */
const BodySchema = z
  .object({
    learnerId: z.string().min(1),
    tenantId: z.string().min(1),
    /** The reviewed revision the approval keyed off; defaults to the profile's
     *  current revision when omitted. */
    profileRevision: z.number().int().nonnegative().optional(),
  })
  .strict();

export const dynamic = "force-dynamic";

function tokenMatches(presented: string | null): boolean {
  const expected = serverEnv.INTERNAL_SERVICE_TOKEN;
  if (!expected || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    if (!serverEnv.INTERNAL_SERVICE_TOKEN) {
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message:
            "Contribution acknowledgement requires INTERNAL_SERVICE_TOKEN to be " +
            "configured on web-v2 (service-to-service auth).",
        },
        requestId,
      );
    }
    if (!tokenMatches(req.headers.get("x-service-token"))) {
      return fail({ ...ERRORS.FORBIDDEN_ROLE, message: "invalid service token" }, requestId);
    }
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body" },
        requestId,
      );
    }
    const { learnerId, tenantId, profileRevision } = parsed.data;
    const profile = await getBrainProfile(learnerId, tenantId);
    // No approved profile to acknowledge from → nothing to do (a brain-svc
    // approval that hasn't synced into web's profile yet is a no-op, not an
    // error; the next approval re-fires).
    if (!profile || profile.cloneStage !== "approved") {
      return ok({ acknowledged: 0, reason: "no_approved_profile" }, requestId);
    }
    const records = await recordContributionAcknowledgements({
      profile,
      profileRevision: profileRevision ?? profile.revision ?? 1,
      requestId,
    });
    return ok({ acknowledged: records.length }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

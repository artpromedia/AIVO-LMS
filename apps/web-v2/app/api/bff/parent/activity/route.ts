import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { listLearnerActivity, type ParentActivityEvent } from "@/lib/parent/activity";

export const dynamic = "force-dynamic";

/** Wire envelope — matches BACKEND-WIRING.md: `{ id, kind, text, occurredAt, learnerId }`. */
interface ActivityWireEvent {
  id: string;
  kind: ParentActivityEvent["kind"];
  text: string;
  occurredAt: string;
  learnerId: string;
}

function parseLimit(req: Request): number | undefined {
  const raw = new URL(req.url).searchParams.get("limit");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parent / caregiver "Live updates" activity feed for one learner.
 *
 * Returns recent, real activity (lessons, tutor sessions, mastery moves, streak
 * milestones, IEP supports, consent changes, care-team joins) newest-first,
 * cursor-paged. Every string is localized to the request locale via `next-intl`
 * so the feed honors the i18n plan; the structured events come from
 * `lib/parent/activity.ts` (truthful-data contract — no fabricated activity).
 *
 * Today the home card polls this endpoint via `lib/use-live-refresh.ts`; the
 * envelope is unchanged when the SSE/WebSocket fan-out lands.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "caregiver"], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const learnerId = url.searchParams.get("learnerId");
    if (!learnerId) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "learnerId is required." }, requestId);
    }
    const scopeErr = await requireLearnerScope(session!, learnerId, requestId);
    if (scopeErr) return scopeErr;

    const cursor = url.searchParams.get("cursor");
    const page = await listLearnerActivity(learnerId, session!.tenantId, {
      parentUserId: session!.userId,
      cursor,
      limit: parseLimit(req),
    });

    // Resolve each event's copy in the request locale. Consent types get their
    // own keyed labels so the interpolated value is localized too.
    const t = await getTranslations("parent.activity");
    const events: ActivityWireEvent[] = page.events.map((e) => {
      const params: Record<string, string | number> = { ...e.params };
      // Consent types carry their own localized labels (every ConsentType has
      // a `consent_type.*` key) so the interpolated value is localized too.
      if (e.kind === "consent" && typeof params.type === "string") {
        params.type = t(`consent_type.${params.type}`);
      }
      return {
        id: e.id,
        kind: e.kind,
        text: t(e.messageKey, params),
        occurredAt: e.occurredAt,
        learnerId: e.learnerId,
      };
    });

    audit(session!, "parent.activity.list", requestId, {
      learnerId,
      metadata: { returned: events.length },
    });

    return ok({ events, nextCursor: page.nextCursor }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

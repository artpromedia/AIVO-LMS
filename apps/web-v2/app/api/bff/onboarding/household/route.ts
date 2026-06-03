import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  isCommsSvcEnabled,
  getCommsBearer,
  sendCoParentInviteSvc,
} from "@/lib/bff/comms-svc";
import {
  addCoParentInvite,
  getHousehold,
  normalizeEmail,
  setHouseholdName,
} from "@/lib/db/household-store";

export const dynamic = "force-dynamic";

/**
 * /api/bff/onboarding/household
 *
 * Persists the parent-setup step (gap #7, slice 4): the household display name
 * and an optional co-parent / caregiver invite the funnel used to discard on
 * `<Link>` navigation.
 *
 * - `POST` saves the household name and, when a co-parent email is supplied,
 *   records a household-scoped invite. Dual-path (ADR 0009): when comms-svc is
 *   enabled and a real access token is present the invite is emailed via
 *   comms-svc; otherwise the dev path records the invite without a real email.
 * - `GET` returns the saved name + pending invites.
 *
 * Both inputs are optional, so an empty submit still advances the funnel
 * honestly (nothing to persist) rather than silently dropping server state.
 */

async function authorize(req: Request, requestId: string) {
  const { session, response } = await requireSession(req, requestId);
  if (response) return { error: response };
  const roleErr = requireRole(session!, ["parent"], requestId);
  if (roleErr) return { error: roleErr };
  return { session: session! };
}

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const auth = await authorize(req, requestId);
    if (auth.error) return auth.error;
    return ok(getHousehold(auth.session.userId), requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const postSchema = z.object({
  name: z.string().max(120).optional(),
  coParentEmail: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const auth = await authorize(req, requestId);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = (await req.json().catch(() => ({}))) as {
      name?: unknown;
      coParentEmail?: unknown;
    };
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "invalid household payload" }, requestId);
    }

    // A co-parent email, when present, must be valid — a typo'd address should
    // surface rather than silently record an undeliverable invite.
    const rawEmail = parsed.data.coParentEmail?.trim();
    let coParentEmail: string | null = null;
    if (rawEmail) {
      coParentEmail = normalizeEmail(rawEmail);
      if (!coParentEmail) {
        return fail(
          { ...ERRORS.VALIDATION_FAILED, message: "co-parent email is not valid" },
          requestId,
        );
      }
    }

    setHouseholdName(session.userId, session.tenantId, parsed.data.name ?? null);
    audit(session, "household.updated", requestId, {
      metadata: { hasName: Boolean(parsed.data.name?.trim()) },
    });

    let coParentInvited = false;
    if (coParentEmail) {
      const result = addCoParentInvite(session.userId, session.tenantId, coParentEmail);
      if (!result.ok) {
        return fail({ ...ERRORS.VALIDATION_FAILED, message: result.error }, requestId);
      }
      coParentInvited = true;

      // Dual-path delivery — the invite record is authoritative; comms-svc is
      // only the email transport. An unreachable/disabled upstream is not fatal:
      // dev/demo record the invite without a real send.
      let via: "email" | "dev" = "dev";
      const bearer = await getCommsBearer();
      if (isCommsSvcEnabled() && bearer) {
        const r = await sendCoParentInviteSvc(bearer, coParentEmail, { inviterName: session.email });
        if (r.ok && r.data.status === "sent") via = "email";
      }
      audit(session, "household.coparent.invited", requestId, { metadata: { via } });
    }

    return ok({ saved: true, coParentInvited }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

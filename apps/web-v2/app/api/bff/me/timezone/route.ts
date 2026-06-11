import { cookies } from "next/headers";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession } from "@/lib/bff/guards";
import {
  IDENTITY_ACCESS_TOKEN_COOKIE,
  identityUpdateTimezone,
} from "@/lib/auth/identity-client";
import { isValidTimeZone } from "@/lib/i18n/timezone";
import { isMockAuthAllowed } from "@/lib/auth/mock-session";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  timezone: z.string().min(1).max(64),
  source: z.enum(["auto", "user"]),
});

/**
 * Sprint A8 — persist the viewer's timezone. Mock mode acks without a
 * round-trip (no identity-svc on the mock path); real mode PATCHes
 * identity-svc, which enforces the auto-never-overwrites-user rule.
 */
export async function PATCH(req: Request) {
  const requestId = getRequestId(req);
  try {
    const { response } = await requireSession(req, requestId);
    if (response) return response;
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }
    if (!isValidTimeZone(parsed.data.timezone)) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "Unknown IANA timezone" }, requestId);
    }
    if (isMockAuthAllowed()) {
      return ok({ timezone: parsed.data.timezone, tzSource: parsed.data.source }, requestId);
    }
    const jar = await cookies();
    const accessToken = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
    if (!accessToken) {
      return fail({ ...ERRORS.UNAUTHENTICATED, message: "No access token cookie" }, requestId);
    }
    const result = await identityUpdateTimezone(accessToken, parsed.data);
    if (!result.ok) {
      return fail(
        { ...ERRORS.UPSTREAM_UNAVAILABLE, message: result.error ?? "timezone update failed" },
        requestId,
      );
    }
    return ok({ timezone: result.timezone, tzSource: result.tzSource }, requestId);
  } catch (err) {
    return failFromUnknown(err, requestId);
  }
}

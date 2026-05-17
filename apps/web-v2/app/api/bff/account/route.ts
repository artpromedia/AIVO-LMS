import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { updateUserDisplayName } from "@/lib/db/repos";
import { getStore } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const user = getStore().users.get(session!.userId) ?? null;
    return ok({ user, role: session!.role }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim() : null;
    if (!displayName || displayName.length > 120) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "displayName is required (1-120)." },
        requestId,
      );
    }
    const user = updateUserDisplayName(session!.userId, displayName);
    audit(session!, "account.update", requestId, {});
    return ok({ user }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

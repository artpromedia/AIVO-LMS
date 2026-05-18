import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { getNotificationPreference, updateNotificationPreference } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  preferences: z.record(z.string(), z.boolean()).optional(),
  quietHours: z
    .string()
    .regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  digestCadence: z.enum(["daily", "weekly", "off"]).optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const pref = getNotificationPreference(session!.userId, session!.tenantId);
    return ok({ preference: pref }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    const pref = updateNotificationPreference(session!.userId, session!.tenantId, parsed.data);
    audit(session!, "notification.prefs.updated", requestId, {
      metadata: { digestCadence: pref.digestCadence },
    });
    return ok({ preference: pref }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

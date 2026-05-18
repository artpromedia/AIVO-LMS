import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession } from "@/lib/bff/guards";
import { markNotificationsRead } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(req: Request): Promise<NextResponse> {
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
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    const count = markNotificationsRead(session!.userId, session!.tenantId, parsed.data.ids);
    return ok({ marked: count }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

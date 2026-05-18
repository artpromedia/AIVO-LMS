import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { getSecurityControl, updateSecurityControl } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().min(1).max(2000).optional(),
  owner: z.string().min(1).max(80).optional(),
  status: z.enum(["implemented", "partial", "not_started", "not_applicable"]).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ controlId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const { controlId } = await ctx.params;
    if (!getSecurityControl(controlId)) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Control not found." }, requestId);
    }
    const body = await req.json().catch(() => null);
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
    const updated = updateSecurityControl(controlId, parsed.data);
    audit(session!, "security.control.updated", requestId, { metadata: { controlId } });
    return ok({ control: updated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

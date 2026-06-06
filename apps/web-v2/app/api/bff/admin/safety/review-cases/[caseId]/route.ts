import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireRole, requireSession } from "@/lib/bff/guards";
import { updateModerationEventStatus, type AdminModerationStatus } from "@aivo/admin-api/moderation";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["resolved_allow", "resolved_block", "escalated"]),
  resolution: z.string().trim().max(1000).nullable().optional(),
});

const STATUS_MAP: Record<z.infer<typeof patchSchema>["status"], AdminModerationStatus> = {
  resolved_allow: "APPROVED",
  resolved_block: "REJECTED",
  escalated: "ESCALATED",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;

    const body = await req.json().catch(() => ({}));
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

    const { caseId } = await params;
    const event = await updateModerationEventStatus(
      session!,
      caseId,
      STATUS_MAP[parsed.data.status],
      parsed.data.resolution ?? null,
    );
    return ok({ event }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

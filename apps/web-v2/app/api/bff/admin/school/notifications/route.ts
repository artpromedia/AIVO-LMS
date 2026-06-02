import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  getNotificationMatrix,
  setNotificationMatrix,
  ALL_EVENT_TYPES,
  ALL_STAFF_ROLES,
  type NotificationMatrix,
  type EventType,
  type StaffRole,
} from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

// Build a zod shape for the matrix
const staffRoleShape = z.object({
  teacher: z.boolean(),
  counselor: z.boolean(),
  school_admin: z.boolean(),
});

const matrixSchema = z.object({
  learner_added: staffRoleShape,
  import_completed: staffRoleShape,
  intervention_flagged: staffRoleShape,
  weekly_summary: staffRoleShape,
});

const putBodySchema = z.object({
  schoolId: z.string().min(1),
  matrix: matrixSchema,
});

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const url = new URL(req.url);
    const schoolId = url.searchParams.get("schoolId") ?? session!.tenantId ?? "";
    const matrix = getNotificationMatrix(schoolId);
    return ok({ matrix }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PUT(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = putBodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }

    const matrix = setNotificationMatrix(
      parsed.data.schoolId,
      parsed.data.matrix as NotificationMatrix,
    );

    audit(session!, "school.notifications.update", requestId, {
      metadata: { schoolId: parsed.data.schoolId },
    });

    return ok({ matrix }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

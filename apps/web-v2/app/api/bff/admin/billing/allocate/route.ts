import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ERRORS } from "@/lib/bff/errors";
import { audit } from "@/lib/bff/audit";
import { allocateSeats } from "@/lib/billing/district-pool";

export const dynamic = "force-dynamic";

const allocateSchema = z.object({
  districtId: z.string().min(1).optional(),
  from_tenant_id: z.string().nullable().default(null),
  to_tenant_id: z.string().min(1),
  count: z.number().int().positive(),
  effective_at: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;

    // Only platform_admin or district_admin may allocate seats
    const roleErr = requireRole(session!, ["platform_admin", "district_admin"], requestId);
    if (roleErr) return roleErr;

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const parsed = allocateSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
        requestId,
      );
    }

    const {
      districtId: bodyDistrictId,
      from_tenant_id,
      to_tenant_id,
      count,
      effective_at,
    } = parsed.data;

    // Resolve districtId: district_admin can only operate on their own tenant
    let districtId: string;
    if (session!.role === "district_admin") {
      districtId = session!.tenantId;
    } else {
      // platform_admin: must supply districtId in body
      if (!bodyDistrictId) {
        return fail(
          {
            ...ERRORS.VALIDATION_FAILED,
            message: "districtId is required for platform_admin.",
          },
          requestId,
        );
      }
      districtId = bodyDistrictId;
    }

    const result = allocateSeats({
      districtId,
      fromSchoolId: from_tenant_id,
      toSchoolId: to_tenant_id,
      count,
      effectiveAt: effective_at,
    });

    if (!result.ok) {
      const reason = result.reason;
      const isValidation =
        reason === "non_positive_count" ||
        reason === "invalid_effective_at" ||
        reason === "unknown_school";
      return fail(
        {
          ...(isValidation ? ERRORS.VALIDATION_FAILED : ERRORS.PRECONDITION_FAILED),
          message: `Allocation failed: ${reason.replace(/_/g, " ")}.`,
        },
        requestId,
      );
    }

    audit(session!, "billing.seats.allocated", requestId, {
      metadata: {
        districtId,
        fromSchoolId: from_tenant_id,
        toSchoolId: to_tenant_id,
        count,
        effectiveAt: effective_at,
      },
    });

    return ok({ pool: result.pool }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

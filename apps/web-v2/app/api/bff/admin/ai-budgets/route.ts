import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  checkAIBudget,
  getAIBudget,
  monthToDateSpendCents,
  scopeTenantsForSession,
  updateAIBudget,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const tenants = scopeTenantsForSession(session!.role, session!.tenantId);
    const rows = await Promise.all(
      tenants.map(async (t) => ({
        tenant: { id: t.id, name: t.name, type: t.type },
        budget: await getAIBudget(t.id),
        spentCents: await monthToDateSpendCents(t.id),
        check: await checkAIBudget(t.id),
      })),
    );
    return ok({ rows }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const patchSchema = z.object({
  tenantId: z.string().min(1),
  monthlyCapCents: z.number().int().nonnegative().nullable().optional(),
  warnAt: z.number().min(0).max(1).optional(),
  hardStop: z.boolean().optional(),
});

export async function PATCH(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
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
    const { tenantId, ...patch } = parsed.data;
    const b = await updateAIBudget(tenantId, patch);
    audit(session!, "billing.ai_budget.updated", requestId, {
      metadata: {
        tenantId,
        capCents: String(b.monthlyCapCents ?? "null"),
        hardStop: String(b.hardStop),
      },
    });
    return ok({ budget: b }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

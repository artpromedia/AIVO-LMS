import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createVendor, listVendors } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    return ok({ vendors: listVendors() }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const schema = z.object({
  name: z.string().min(1).max(80),
  category: z.enum([
    "llm_provider",
    "tts_provider",
    "infra",
    "analytics",
    "support",
    "billing",
    "other",
  ]),
  dataResidency: z.string().min(1).max(40),
  processesLearnerData: z.boolean(),
  dpaSigned: z.boolean(),
  riskTier: z.enum(["tier1", "tier2", "tier3"]),
  approved: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    const vendor = createVendor({ ...parsed.data, notes: parsed.data.notes ?? null });
    audit(session!, "security.vendor.created", requestId, {
      metadata: { vendorId: vendor.id, name: vendor.name },
    });
    return ok({ vendor }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

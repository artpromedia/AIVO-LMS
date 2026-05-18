import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createPronunciationOverride, listPronunciationOverrides } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1).max(64),
  replacement: z.string().min(1).max(128),
  encoding: z.enum(["ipa", "x-sampa", "plain"]),
  scope: z.enum(["platform", "tenant"]),
  notes: z.string().max(500).nullable().optional(),
});

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const tenantId = session!.role === "platform_admin" ? undefined : session!.tenantId;
    const overrides = listPronunciationOverrides(tenantId);
    return ok({ overrides }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
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
    if (parsed.data.scope === "platform" && session!.role !== "platform_admin") {
      return fail(
        {
          ...ERRORS.FORBIDDEN_ROLE,
          message: "Only platform admins can publish platform-scope overrides.",
        },
        requestId,
      );
    }
    const rec = createPronunciationOverride({
      tenantId: session!.tenantId,
      token: parsed.data.token,
      replacement: parsed.data.replacement,
      encoding: parsed.data.encoding,
      scope: parsed.data.scope,
      notes: parsed.data.notes ?? null,
      createdByUserId: session!.userId,
    });
    audit(session!, "audio.pronunciation.created", requestId, {
      metadata: { id: rec.id, token: rec.token, scope: rec.scope },
    });
    return ok({ override: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

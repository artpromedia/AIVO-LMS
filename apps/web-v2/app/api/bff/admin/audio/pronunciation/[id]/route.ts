import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { getPronunciationOverride, updatePronunciationOverride } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  replacement: z.string().min(1).max(128).optional(),
  encoding: z.enum(["ipa", "x-sampa", "plain"]).optional(),
  scope: z.enum(["platform", "tenant"]).optional(),
  notes: z.string().max(500).nullable().optional(),
});

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { id } = await params;
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
    // Load the existing row first so we can authorize against its *current*
    // scope, not just the incoming patch. Without this, a school/district
    // admin who knows a platform override id could mutate it via PATCH simply
    // by omitting `scope` from the body.
    const existing = await getPronunciationOverride(id);
    if (!existing) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Override not found." }, requestId);
    }
    if (existing.scope === "platform" && session!.role !== "platform_admin") {
      return fail(
        {
          ...ERRORS.FORBIDDEN_ROLE,
          message: "Only platform admins can modify platform-scope overrides.",
        },
        requestId,
      );
    }
    if (
      existing.scope === "tenant" &&
      existing.tenantId !== session!.tenantId &&
      session!.role !== "platform_admin"
    ) {
      return fail(
        { ...ERRORS.FORBIDDEN_TENANT, message: "Override belongs to another tenant." },
        requestId,
      );
    }
    if (parsed.data.scope === "platform" && session!.role !== "platform_admin") {
      return fail(
        {
          ...ERRORS.FORBIDDEN_ROLE,
          message: "Only platform admins can promote to platform scope.",
        },
        requestId,
      );
    }
    const rec = await updatePronunciationOverride(id, parsed.data);
    if (!rec) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Override not found." }, requestId);
    }
    audit(session!, "audio.pronunciation.updated", requestId, {
      metadata: { id, scope: rec.scope },
    });
    return ok({ override: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

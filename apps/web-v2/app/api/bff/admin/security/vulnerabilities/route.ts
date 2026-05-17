import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { createVulnerability, listVulnerabilities, updateVulnerability } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    return ok({ vulnerabilities: listVulnerabilities() }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  cveId: z.string().max(40).nullable().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  source: z.enum(["dependency_scan", "container_scan", "iac_scan", "pen_test", "external_report", "internal"]),
  affectedComponent: z.string().min(1).max(120),
  fixedIn: z.string().max(80).nullable().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." }, requestId);
    }
    const rec = createVulnerability({
      title: parsed.data.title,
      cveId: parsed.data.cveId ?? null,
      severity: parsed.data.severity,
      status: "open",
      source: parsed.data.source,
      affectedComponent: parsed.data.affectedComponent,
      fixedIn: parsed.data.fixedIn ?? null,
    });
    audit(session!, "security.vulnerability.recorded", requestId, { metadata: { vulnId: rec.id, severity: rec.severity } });
    return ok({ vulnerability: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

const patchSchema = z.object({
  vulnId: z.string().min(1),
  status: z.enum(["open", "triaged", "fixed", "wontfix"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  fixedIn: z.string().max(80).nullable().optional(),
});

export async function PATCH(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." }, requestId);
    }
    const { vulnId, ...patch } = parsed.data;
    const updated = updateVulnerability(vulnId, { ...patch, fixedIn: patch.fixedIn ?? undefined });
    if (!updated) return fail({ ...ERRORS.NOT_FOUND, message: "Vulnerability not found." }, requestId);
    audit(session!, "security.vulnerability.updated", requestId, { metadata: { vulnId, status: updated.status } });
    return ok({ vulnerability: updated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

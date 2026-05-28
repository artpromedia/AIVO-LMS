import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { getSchool, runRosterImport } from "@/lib/db/repos";
import { enterpriseFlags } from "@/lib/bff/feature-flags";
import { importSisExport } from "@/lib/bff/service-clients/integration";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  schoolId: z.string().min(1),
  source: z.enum(["csv", "oneroster_v1p1", "oneroster_v1p2", "clever", "classlink"]),
  csvText: z
    .string()
    .min(1)
    .max(2 * 1024 * 1024), // 2 MB cap on the raw text
  dryRun: z.boolean().default(false),
});

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

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
    const school = await getSchool(parsed.data.schoolId);
    if (!school) {
      return fail({ ...ERRORS.NOT_FOUND, message: "School not found." }, requestId);
    }
    if (school.tenantId !== session!.tenantId && session!.role !== "platform_admin") {
      return fail(
        { ...ERRORS.FORBIDDEN_TENANT, message: "School belongs to another tenant." },
        requestId,
      );
    }
    const job = await runRosterImport({
      tenantId: school.tenantId,
      schoolId: parsed.data.schoolId,
      source: parsed.data.source,
      csvText: parsed.data.csvText,
      dryRun: parsed.data.dryRun,
      createdByUserId: session!.userId,
    });

    // Sprint H: when the sisSync flag is on AND the source is a real
    // SIS vendor (Clever / ClassLink), forward the canonical
    // normalized roster to integration-svc so its provider adapters
    // own the actual normalization. CSV / OneRoster imports continue
    // to use the local pipeline. Failure is non-fatal — the local
    // dry-run still surfaces to the admin.
    if (
      enterpriseFlags.sisSync() &&
      (parsed.data.source === "clever" || parsed.data.source === "classlink") &&
      !parsed.data.dryRun
    ) {
      // The local runRosterImport already produces a NormalizedRosterExport
      // (job.normalized) for vendor-sourced imports. When that field is
      // present, fan it out; otherwise treat as a CSV import.
      const normalized = (job as { normalized?: unknown }).normalized;
      if (normalized) {
        const remote = await importSisExport({
          vendor: parsed.data.source,
          export: normalized,
          tenantId: school.tenantId,
        });
        if (remote.ok) {
          audit(session!, "rostering.import.svc_dispatched", requestId, {
            metadata: {
              jobId: job.id,
              vendor: parsed.data.source,
              schools: String(remote.data.summary.schools),
              students: String(remote.data.summary.students),
            },
          });
        } else {
          audit(session!, "rostering.import.svc_failed", requestId, {
            metadata: {
              jobId: job.id,
              vendor: parsed.data.source,
              reason: remote.reason,
            },
          });
        }
      }
    }

    audit(session!, "rostering.import", requestId, {
      metadata: {
        jobId: job.id,
        schoolId: parsed.data.schoolId,
        dryRun: parsed.data.dryRun ? "1" : "0",
        created: String(job.createdRows),
        errors: String(job.errorRows),
      },
    });
    return ok({ job }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

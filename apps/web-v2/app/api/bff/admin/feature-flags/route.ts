/**
 * Sprint 12 — feature-flag admin surface.
 *
 *   GET /api/bff/admin/feature-flags
 *
 * Read-only inventory of the enterprise feature flags + the
 * Sprint 1-11 product flags introduced by the baseline pipeline.
 * Env vars remain the source of truth; the UI surfaces them so
 * operators don't have to grep .env to know what's live.
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES } from "@/lib/bff/admin-scope";
import {
  ENTERPRISE_FLAG_META,
  type FlagMeta,
  type FlagRiskBand,
  resolveEnterpriseFlags,
} from "@aivo/feature-flags";

export const dynamic = "force-dynamic";

interface FlagSnapshot extends FlagMeta {
  active: boolean;
}

const SPRINT_PIPELINE_FLAGS: Array<Omit<FlagSnapshot, "active"> & { envVar: string }> = [
  {
    key: "responsibleAiGuardrails" as never,
    envVar: "AIVO_FEATURE_CURRICULUM_GROUNDING",
    label: "Curriculum grounding (Sprint 1)",
    description:
      "ai-svc calls curriculum-svc for district-scoped skill anchors before generating a baseline. Off → free-form prompt only.",
    surface: "ai",
    riskBand: "low" as FlagRiskBand,
    defaultValue: false,
  },
];

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const env = (process.env ?? {}) as Record<string, string | undefined>;
    const resolved = resolveEnterpriseFlags(env);
    const enterprise: FlagSnapshot[] = Object.values(ENTERPRISE_FLAG_META).map(
      (meta) => ({
        ...meta,
        active: resolved[meta.key],
      }),
    );
    const sprintPipeline = SPRINT_PIPELINE_FLAGS.map((meta) => ({
      ...meta,
      active: ["1", "true", "yes", "on"].includes(
        String(env[meta.envVar] ?? "").trim().toLowerCase(),
      ),
    }));
    return ok({ flags: { enterprise, sprintPipeline } }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

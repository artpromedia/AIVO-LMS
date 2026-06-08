/**
 * Feature-flag inventory (web-admin migration).
 *
 *   GET /api/admin-svc/feature-flags
 *
 * Read-only surface over the enterprise feature flags (resolved from the
 * canonical @aivo/feature-flags metadata) plus the sprint-pipeline product
 * flags. Environment variables remain the source of truth; this endpoint
 * surfaces their resolved state so operators don't have to grep .env.
 *
 * Ported from apps/web-v2/app/api/bff/admin/feature-flags so the standalone
 * web-admin console (which talks only to admin-svc) can render it.
 */
import { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import {
  ENTERPRISE_FLAG_META,
  type FlagMeta,
  type FlagRiskBand,
  resolveEnterpriseFlags,
} from "@aivo/feature-flags";

const ADMIN_ROLES = ["PLATFORM_ADMIN", "DISTRICT_ADMIN", "SUPPORT", "ENGINEERING", "DEVOPS"];

interface FlagSnapshot extends FlagMeta {
  active: boolean;
}

interface SprintFlagMeta {
  key: string;
  envVar: string;
  label: string;
  description: string;
  surface: FlagMeta["surface"];
  riskBand: FlagRiskBand;
  defaultValue: boolean;
}

const SPRINT_PIPELINE_FLAGS: SprintFlagMeta[] = [
  {
    key: "curriculumGrounding",
    envVar: "AIVO_FEATURE_CURRICULUM_GROUNDING",
    label: "Curriculum grounding (Sprint 1)",
    description:
      "ai-svc calls curriculum-svc for district-scoped skill anchors before generating a baseline. Off → free-form prompt only.",
    surface: "ai",
    riskBand: "low",
    defaultValue: false,
  },
];

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function envFlagActive(env: Record<string, string | undefined>, name: string): boolean {
  return TRUTHY.has(String(env[name] ?? "").trim().toLowerCase());
}

async function requireAdmin(req: any, reply: any): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization header" });
    return false;
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (!ADMIN_ROLES.includes(payload.role as string)) {
      reply.status(403).send({ error: "Admin access required" });
      return false;
    }
    req.user = payload;
    return true;
  } catch {
    reply.status(401).send({ error: "Invalid token" });
    return false;
  }
}

export function registerFeatureFlagRoutes(app: FastifyInstance): void {
  app.get(
    "/api/admin-svc/feature-flags",
    { schema: { tags: ["feature-flags"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requireAdmin(req, reply))) return;

      const env = (process.env ?? {}) as Record<string, string | undefined>;
      const resolved = resolveEnterpriseFlags(env);

      const enterprise: FlagSnapshot[] = Object.values(ENTERPRISE_FLAG_META).map((meta) => ({
        ...meta,
        active: resolved[meta.key],
      }));

      const sprintPipeline = SPRINT_PIPELINE_FLAGS.map((meta) => ({
        ...meta,
        active: envFlagActive(env, meta.envVar),
      }));

      return { flags: { enterprise, sprintPipeline } };
    },
  );
}

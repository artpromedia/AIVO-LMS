/**
 * Teacher-readable rostering grant.
 *
 * The district setting that controls whether teachers may connect roster
 * sources lives on `districtSettings.featureOverrides.teacherRosteringEnabled`
 * and is toggled by a district admin via `/api/district/settings`. Those
 * routes are hard-gated to district admins, so teachers need a separate,
 * own-tenant read to learn whether their district has granted the right.
 *
 * This endpoint returns a single boolean about the *caller's own tenant*
 * (derived from their JWT) — no district-admin role required. The learner
 * app's teacher rostering BFF reads it to enforce the grant.
 */
import { FastifyInstance } from "fastify";
import { districtSettings } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { eq } from "drizzle-orm";

async function authenticate(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization" });
  }
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export async function registerRosteringRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.get(
    "/api/rostering/teacher-grant",
    { preHandler: authenticate },
    async (req: any, reply: any) => {
      const tenantId = req.user?.tenantId as string | undefined;
      if (!tenantId) {
        return reply.status(400).send({ error: "No tenant context" });
      }
      const [settings] = await db
        .select()
        .from(districtSettings)
        .where(eq(districtSettings.tenantId, tenantId))
        .limit(1);
      const enabled = Boolean((settings?.featureOverrides as any)?.teacherRosteringEnabled);
      return { enabled };
    },
  );
}

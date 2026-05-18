import { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { sensoryProfiles, learners } from "@aivo/db";
import { eq } from "drizzle-orm";
import {
  assessmentsSensoryProfileSchema,
  getAssessmentsSensoryProfileByLearnerIdSchema,
} from "./schemas.js";

// JWT payload shape we care about for authz. `verifyJWT` returns a
// looser record; we narrow to just the fields used by the ownership
// check so type errors catch missing claims rather than `any`-ing
// them away.
type AuthClaims = {
  sub?: string;
  role?: "LEARNER" | "PARENT" | "ADMIN" | "SERVICE" | string;
};

// Minimal shape of the learner row needed for the ownership check.
// Drizzle types are inferred from the schema; we only depend on
// these two fields here.
type LearnerRow = { id: string; userId: string | null; parentId: string | null };

type AuthzResult =
  | { ok: true; learner: LearnerRow }
  | { ok: false; status: 401 | 403 | 404; error: string };

// Authorization helper — mirrors the pattern used by
// learner-profile.ts. A LEARNER may only read/write their own
// sensory profile; a PARENT may only read/write profiles for
// learners whose `parentId` matches their user id. ADMIN /
// SERVICE callers (internal staff tooling) bypass the ownership
// check. Any other role, or a JWT without `sub`, is rejected.
async function authorizeLearnerAccess(
  // Drizzle's `NodePgDatabase` type is parameterised by the full
  // schema and isn't worth re-importing here; we type the surface
  // we actually call (`.select().from().where().limit()`).
  db: {
    select: () => {
      from: (t: typeof learners) => {
        where: (c: unknown) => { limit: (n: number) => Promise<LearnerRow[]> };
      };
    };
  },
  auth: AuthClaims | null,
  learnerId: string,
): Promise<AuthzResult> {
  if (!auth || !auth.sub) return { ok: false, status: 401, error: "Unauthorized" };

  // Look up the learner by row id first, then by userId (the mobile
  // app sometimes passes the user id when the learner is the
  // signed-in user).
  let [learner] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
  if (!learner) {
    [learner] = await db.select().from(learners).where(eq(learners.userId, learnerId)).limit(1);
  }
  if (!learner) return { ok: false, status: 404, error: "learner not found" };

  const role = auth.role;
  if (role === "ADMIN" || role === "SERVICE") return { ok: true, learner };
  if (role === "LEARNER" && auth.sub === learner.userId) return { ok: true, learner };
  if (role === "PARENT" && auth.sub === learner.parentId) return { ok: true, learner };

  return { ok: false, status: 403, error: "Forbidden" };
}

export async function registerSensoryProfileRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.post(
    "/api/assessments/sensory-profile",
    { schema: assessmentsSensoryProfileSchema },
    async (req, reply) => {
      let auth: AuthClaims | null = null;
      try {
        auth = (await verifyJWT(
          req.headers.authorization?.replace("Bearer ", "") || "",
        )) as AuthClaims;
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      if (!auth) return reply.status(401).send({ error: "Unauthorized" });

      const body = (req.body ?? {}) as {
        learnerId?: string;
        visual?: string;
        auditory?: string;
        tactile?: string;
        vestibular?: string;
        proprioceptive?: string;
        notes?: string;
        mode?: string;
      };
      const { learnerId, visual, auditory, tactile, vestibular, proprioceptive, notes, mode } =
        body;
      if (!learnerId) return reply.status(400).send({ error: "learnerId required" });

      const access = await authorizeLearnerAccess(db, auth, learnerId);
      if (!access.ok) {
        // The Fastify schema declares 401/400/200 here; 403/404 from
        // the authz helper are mapped to 401 over the wire (the
        // client just sees "not allowed to read this learner") to
        // keep behavior aligned with the declared response shape.
        const wireStatus: 401 = 401;
        return reply.status(wireStatus).send({ error: access.error });
      }
      // Always operate on the canonical learner.id even if the client
      // passed a user id alias.
      const canonicalLearnerId = access.learner.id;

      const validValues = ["hyper", "hypo", "typical"];
      for (const [field, val] of Object.entries({
        visual,
        auditory,
        tactile,
        vestibular,
        proprioceptive,
      })) {
        if (val && !validValues.includes(val as string)) {
          return reply.status(400).send({ error: `${field} must be one of: hyper, hypo, typical` });
        }
      }

      const validModes = ["standard", "calm", "high-contrast"];
      if (mode && !validModes.includes(mode as string)) {
        return reply
          .status(400)
          .send({ error: "mode must be one of: standard, calm, high-contrast" });
      }

      const existing = await db
        .select()
        .from(sensoryProfiles)
        .where(eq(sensoryProfiles.learnerId, canonicalLearnerId))
        .limit(1);

      if (existing.length > 0) {
        // Partial update: only overwrite fields that were sent. This
        // lets the mobile sensory-mode toggle PATCH just `mode` without
        // resetting the per-channel sensitivities back to "typical".
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (visual !== undefined) patch.visual = visual || "typical";
        if (auditory !== undefined) patch.auditory = auditory || "typical";
        if (tactile !== undefined) patch.tactile = tactile || "typical";
        if (vestibular !== undefined) patch.vestibular = vestibular || "typical";
        if (proprioceptive !== undefined) patch.proprioceptive = proprioceptive || "typical";
        if (notes !== undefined) patch.notes = notes || null;
        if (mode !== undefined) patch.mode = mode || "standard";

        await db
          .update(sensoryProfiles)
          .set(patch)
          .where(eq(sensoryProfiles.learnerId, canonicalLearnerId));

        return { status: "updated", learnerId: canonicalLearnerId };
      }

      const [profile] = await db
        .insert(sensoryProfiles)
        .values({
          learnerId: canonicalLearnerId,
          visual: visual || "typical",
          auditory: auditory || "typical",
          tactile: tactile || "typical",
          vestibular: vestibular || "typical",
          proprioceptive: proprioceptive || "typical",
          notes: notes || null,
          mode: mode || "standard",
        })
        .returning();

      return { status: "created", profile };
    },
  );

  app.get(
    "/api/assessments/sensory-profile/:learnerId",
    { schema: getAssessmentsSensoryProfileByLearnerIdSchema },
    async (req, reply) => {
      let auth: AuthClaims | null = null;
      try {
        auth = (await verifyJWT(
          req.headers.authorization?.replace("Bearer ", "") || "",
        )) as AuthClaims;
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      if (!auth) return reply.status(401).send({ error: "Unauthorized" });

      const { learnerId } = req.params as { learnerId: string };

      const access = await authorizeLearnerAccess(db, auth, learnerId);
      if (!access.ok) {
        const wireStatus: 401 = 401;
        return reply.status(wireStatus).send({ error: access.error });
      }

      const [profile] = await db
        .select()
        .from(sensoryProfiles)
        .where(eq(sensoryProfiles.learnerId, access.learner.id))
        .limit(1);

      if (!profile) return reply.status(200).send({ profile: null });
      return profile;
    },
  );
}

import { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { learnerAccessibilityPrefs, learners } from "@aivo/db";
import { eq } from "drizzle-orm";
import {
  ACCESSIBILITY_DEFAULTS,
  ACCESSIBILITY_FIELDS,
  AAC_INPUT_METHODS,
  MIN_AAC_SCAN_DELAY_MS,
  MAX_AAC_SCAN_DELAY_MS,
  type AccessibilityProfile,
} from "@aivo/accessibility-contract";

// Per-learner accessibility preferences sync. Mirrors sensory-profile.ts: a
// LEARNER may read/write their own preferences, a PARENT those of their
// learners, and ADMIN/SERVICE callers bypass the ownership check. The mobile
// app GETs on sign-in to reconcile (server wins) and POSTs on every change so
// the learner's accessibility choices follow them across devices.

type AuthClaims = {
  sub?: string;
  role?: "LEARNER" | "PARENT" | "ADMIN" | "SERVICE" | string;
};

type LearnerRow = { id: string; userId: string | null; parentId: string | null };

type AuthzResult =
  | { ok: true; learner: LearnerRow }
  | { ok: false; status: 401 | 403 | 404; error: string };

async function authorizeLearnerAccess(
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

  // Accept either the learner row id or the signed-in user's id (mobile passes
  // the user id when the learner is the signed-in user).
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

/**
 * Validate + coerce an untrusted partial body into a clean partial profile.
 * Unknown keys are dropped; wrong-typed values are ignored. Returns only the
 * fields that were present and valid, so callers can merge over the stored
 * profile without resetting untouched preferences.
 */
function coercePartialProfile(body: Record<string, unknown>): Partial<AccessibilityProfile> {
  const out: Partial<AccessibilityProfile> = {};
  for (const field of ACCESSIBILITY_FIELDS) {
    if (!(field in body)) continue;
    const v = body[field];
    if (field === "aacInputMethod") {
      if (typeof v === "string" && (AAC_INPUT_METHODS as readonly string[]).includes(v)) {
        out.aacInputMethod = v as AccessibilityProfile["aacInputMethod"];
      }
    } else if (field === "aacScanDelayMs") {
      if (typeof v === "number" && Number.isFinite(v)) {
        out.aacScanDelayMs = Math.max(MIN_AAC_SCAN_DELAY_MS, Math.min(MAX_AAC_SCAN_DELAY_MS, Math.round(v)));
      }
    } else if (typeof v === "boolean") {
      (out as Record<string, unknown>)[field] = v;
    }
  }
  return out;
}

export async function registerAccessibilityPreferencesRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  // Upsert (partial). Body: { learnerId, ...any subset of AccessibilityProfile }.
  app.post("/api/assessments/accessibility-preferences", async (req, reply) => {
    let auth: AuthClaims | null = null;
    try {
      auth = (await verifyJWT(
        req.headers.authorization?.replace("Bearer ", "") || "",
      )) as AuthClaims;
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    if (!auth) return reply.status(401).send({ error: "Unauthorized" });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const learnerId = typeof body.learnerId === "string" ? body.learnerId : undefined;
    if (!learnerId) return reply.status(400).send({ error: "learnerId required" });

    const access = await authorizeLearnerAccess(db, auth, learnerId);
    if (!access.ok) {
      return reply.status(access.status).send({ error: access.error });
    }
    const canonicalLearnerId = access.learner.id;
    const patch = coercePartialProfile(body);

    const [existing] = await db
      .select()
      .from(learnerAccessibilityPrefs)
      .where(eq(learnerAccessibilityPrefs.learnerId, canonicalLearnerId))
      .limit(1);

    const base: AccessibilityProfile = existing
      ? { ...ACCESSIBILITY_DEFAULTS, ...(existing.prefs as AccessibilityProfile) }
      : { ...ACCESSIBILITY_DEFAULTS };
    const next: AccessibilityProfile = { ...base, ...patch };

    if (existing) {
      await db
        .update(learnerAccessibilityPrefs)
        .set({ prefs: next, updatedAt: new Date() })
        .where(eq(learnerAccessibilityPrefs.learnerId, canonicalLearnerId));
      return { status: "updated", learnerId: canonicalLearnerId, prefs: next };
    }

    await db
      .insert(learnerAccessibilityPrefs)
      .values({ learnerId: canonicalLearnerId, prefs: next });
    return { status: "created", learnerId: canonicalLearnerId, prefs: next };
  });

  // Read. Returns { prefs: null } when nothing has been stored (client applies
  // ACCESSIBILITY_DEFAULTS), matching the sensory-profile route's shape.
  app.get("/api/assessments/accessibility-preferences/:learnerId", async (req, reply) => {
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
      return reply.status(access.status).send({ error: access.error });
    }

    const [row] = await db
      .select()
      .from(learnerAccessibilityPrefs)
      .where(eq(learnerAccessibilityPrefs.learnerId, access.learner.id))
      .limit(1);

    if (!row) return reply.status(200).send({ prefs: null });
    return reply.status(200).send({ prefs: row.prefs as AccessibilityProfile });
  });
}

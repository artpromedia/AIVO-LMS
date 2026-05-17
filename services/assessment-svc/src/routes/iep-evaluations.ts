import { FastifyInstance } from "fastify";
import { eq, and, or, desc, isNull } from "drizzle-orm";
import {
  iepEvaluations,
  learners,
  learnerTeachers,
  users,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { getIepEvaluationsLearnerByLearnerIdSchema, getIepEvaluationsByIdSchema, patchIepEvaluationsByIdSchema, iepEvaluationsByIdSuggestSchema, iepEvaluationsByIdSubmitSchema } from "./schemas.js";

const COMMS_URL = process.env.COMMS_SVC_URL || "http://localhost:3010";
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY
  || (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");
const APP_URL = process.env.APP_URL || "http://localhost:5000";

// Best-effort email dispatch — comms-svc failures must never block the
// state-machine transition, so any throw is swallowed and logged upstream.
async function bestEffortSendEmail(template: string, to: string, data: Record<string, unknown>) {
  try {
    await fetch(`${COMMS_URL}/api/comms/internal/iep-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({ template, to, data }),
    });
  } catch { /* swallow */ }
}

// Best-effort in-app notification (parent-only inbox). Mirrors the email
// fan-out so a parent who has the in-app channel enabled gets the badge.
async function bestEffortInAppNotify(payload: {
  parentId: string;
  learnerId: string;
  category: string;
  template: string;
  title: string;
  body?: string;
  link?: string;
}) {
  try {
    await fetch(`${COMMS_URL}/api/comms/internal/in-app-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify(payload),
    });
  } catch { /* swallow */ }
}

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`assessment-svc: ${name} must be set in production`);
  return devDefault;
}
const AI_SVC_URL = requireUrl("AI_SVC_URL", "http://localhost:3004");

interface AuthClaims {
  sub: string;
  tenantId: string;
  role: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

async function authenticate(req: any, reply: any): Promise<AuthClaims | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Authentication required" });
    return null;
  }
  try {
    return (await verifyJWT(auth.slice(7))) as AuthClaims;
  } catch {
    reply.code(401).send({ error: "Invalid token" });
    return null;
  }
}

async function isTeacherOf(db: any, userSub: string, learnerId: string): Promise<boolean> {
  if (!isUuid(userSub) || !isUuid(learnerId)) return false;
  const rows = await db.select().from(learnerTeachers).where(
    and(
      eq(learnerTeachers.learnerId, learnerId),
      eq(learnerTeachers.teacherUserId, userSub),
      eq(learnerTeachers.status, "ACCEPTED"),
    ),
  );
  return rows.length > 0;
}

async function isParentOf(db: any, userSub: string, learnerId: string): Promise<boolean> {
  if (!isUuid(userSub) || !isUuid(learnerId)) return false;
  const rows = await db.select().from(learners).where(
    and(eq(learners.id, learnerId), eq(learners.parentId, userSub)),
  );
  return rows.length > 0;
}

async function getLearner(db: any, learnerId: string) {
  if (!isUuid(learnerId)) return null;
  const [row] = await db.select().from(learners).where(eq(learners.id, learnerId));
  return row || null;
}

// SPED_LEAD: school-scoped IEP admin (sprint task #12). The role's
// authority is constrained to the school the user is assigned to via
// users.school_id — district-wide DISTRICT_ADMINs and platform admins
// retain broader access.
async function isSpedLeadForLearner(db: any, claims: AuthClaims, learner: any): Promise<boolean> {
  if (claims.role !== "SPED_LEAD") return false;
  if (claims.tenantId !== learner.tenantId) return false;
  // Must share the same school. If either side is missing the school_id,
  // we deny — SPED_LEAD without a school assignment is a misconfiguration
  // we won't paper over.
  if (!learner.schoolId) return false;
  const [u] = await db.select({ schoolId: users.schoolId })
    .from(users).where(eq(users.id, claims.sub));
  if (!u?.schoolId) return false;
  return u.schoolId === learner.schoolId;
}

async function canRead(db: any, claims: AuthClaims, learnerId: string): Promise<boolean> {
  const learner = await getLearner(db, learnerId);
  if (!learner) return false;
  if (claims.role === "PLATFORM_ADMIN") return true;
  if (claims.role === "DISTRICT_ADMIN" || claims.role === "THERAPIST") {
    return claims.tenantId === learner.tenantId;
  }
  if (await isSpedLeadForLearner(db, claims, learner)) return true;
  if (await isTeacherOf(db, claims.sub, learnerId)) return true;
  if (await isParentOf(db, claims.sub, learnerId)) return true;
  return false;
}

async function canWrite(db: any, claims: AuthClaims, learnerId: string): Promise<boolean> {
  const learner = await getLearner(db, learnerId);
  if (!learner) return false;
  if (claims.role === "PLATFORM_ADMIN") return true;
  if (claims.role === "DISTRICT_ADMIN" || claims.role === "THERAPIST") {
    return claims.tenantId === learner.tenantId;
  }
  if (await isSpedLeadForLearner(db, claims, learner)) return true;
  if (claims.role === "TEACHER" && await isTeacherOf(db, claims.sub, learnerId)) return true;
  return false;
}

// Strip internal fields from an evaluation row before returning to a parent.
// Parents only see submitted/decided records and only the team-shared summary.
function parentSummary(row: any) {
  return {
    id: row.id,
    learnerId: row.learnerId,
    status: row.status,
    eligibilityDecision: row.decisionEligible || null,
    decisionCategories: row.decisionCategories || [],
    decisionRationale: row.decisionRationale || null,
    submittedAt: row.submittedAt,
    decidedAt: row.decidedAt,
    createdAt: row.createdAt,
  };
}

const PARENT_VISIBLE_STATUSES = ["submitted", "eligibility_determined"] as const;

export async function registerIepEvaluationRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  // Create a draft evaluation
  app.post("/api/iep/evaluations", {
    schema: {
      tags: ["IEP-Evaluations"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["learnerId"],
        properties: {
          learnerId: { type: "string" },
          referralReason: { type: "string" },
          assessmentAreas: { type: "array" },
          observations: { type: "string" },
          parentInput: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const body = req.body as any;
    const learner = await getLearner(db, body.learnerId);
    if (!learner) return reply.code(404).send({ error: "Learner not found" });
    if (!await canWrite(db, claims, body.learnerId)) {
      return reply.code(403).send({ error: "Access denied" });
    }

    const [row] = await db.insert(iepEvaluations).values({
      learnerId: body.learnerId,
      tenantId: learner.tenantId,
      initiatedByUserId: claims.sub,
      status: "draft",
      referralReason: body.referralReason || null,
      assessmentAreas: body.assessmentAreas || [],
      observations: body.observations || null,
      parentInput: body.parentInput || null,
    }).returning();
    return row;
  });

  // List evaluations for a learner
  app.get("/api/iep/evaluations/learner/:learnerId", { schema: getIepEvaluationsLearnerByLearnerIdSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const { learnerId } = req.params as { learnerId: string };
    if (!await canRead(db, claims, learnerId)) {
      return reply.code(403).send({ error: "Access denied" });
    }
    const rows = await db.select().from(iepEvaluations)
      .where(eq(iepEvaluations.learnerId, learnerId))
      .orderBy(desc(iepEvaluations.createdAt));
    // Parents only see submitted/decided records, and only summary fields.
    if (claims.role === "PARENT") {
      return rows
        .filter((r: any) => (PARENT_VISIBLE_STATUSES as readonly string[]).includes(r.status))
        .map(parentSummary);
    }
    return rows;
  });

  // Get single evaluation
  app.get("/api/iep/evaluations/:id", { schema: getIepEvaluationsByIdSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [row] = await db.select().from(iepEvaluations).where(eq(iepEvaluations.id, id));
    if (!row) return reply.code(404).send({ error: "Evaluation not found" });
    if (!await canRead(db, claims, row.learnerId)) {
      return reply.code(403).send({ error: "Access denied" });
    }
    if (claims.role === "PARENT") {
      if (!(PARENT_VISIBLE_STATUSES as readonly string[]).includes(row.status)) {
        return reply.code(404).send({ error: "Evaluation not found" });
      }
      return parentSummary(row);
    }
    return row;
  });

  // Update a draft/submitted evaluation
  app.patch("/api/iep/evaluations/:id", { schema: patchIepEvaluationsByIdSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [existing] = await db.select().from(iepEvaluations).where(eq(iepEvaluations.id, id));
    if (!existing) return reply.code(404).send({ error: "Evaluation not found" });
    if (!await canWrite(db, claims, existing.learnerId)) {
      return reply.code(403).send({ error: "Access denied" });
    }
    if (existing.status === "eligibility_determined") {
      return reply.code(409).send({ error: "Decision already recorded; cannot edit" });
    }
    const body = req.body as any;
    const update: any = { updatedAt: new Date() };
    if (body.referralReason !== undefined) update.referralReason = body.referralReason;
    if (body.assessmentAreas !== undefined) update.assessmentAreas = body.assessmentAreas;
    if (body.observations !== undefined) update.observations = body.observations;
    if (body.parentInput !== undefined) update.parentInput = body.parentInput;
    // Status-guarded write so a concurrent decision call cannot be overwritten.
    const updated = await db.update(iepEvaluations).set(update).where(and(
      eq(iepEvaluations.id, id),
      or(eq(iepEvaluations.status, "draft"), eq(iepEvaluations.status, "submitted")),
    )).returning();
    if (updated.length === 0) {
      return reply.code(409).send({ error: "Evaluation status changed; please reload" });
    }
    return updated[0];
  });

  // Request AI eligibility suggestion
  app.post("/api/iep/evaluations/:id/suggest", { schema: iepEvaluationsByIdSuggestSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [evalRow] = await db.select().from(iepEvaluations).where(eq(iepEvaluations.id, id));
    if (!evalRow) return reply.code(404).send({ error: "Evaluation not found" });
    if (!await canWrite(db, claims, evalRow.learnerId)) {
      return reply.code(403).send({ error: "Access denied" });
    }

    let suggestion: any = null;
    try {
      const aiRes = await fetch(`${AI_SVC_URL}/api/ai/eligibility-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referral_reason: evalRow.referralReason || "",
          assessment_areas: evalRow.assessmentAreas || [],
          observations: evalRow.observations || "",
          parent_input: evalRow.parentInput || "",
        }),
      });
      if (aiRes.ok) suggestion = await aiRes.json();
    } catch (err) {
      req.log.error({ err }, "AI eligibility-suggest call failed");
    }
    if (!suggestion) {
      return reply.code(502).send({ error: "AI eligibility suggestion unavailable" });
    }
    const [row] = await db.update(iepEvaluations)
      .set({ aiSuggestion: suggestion, updatedAt: new Date() })
      .where(eq(iepEvaluations.id, id)).returning();
    return row;
  });

  // Submit (move from draft → submitted). Fires parent + district-admin
  // notifications exactly once per evaluation via the submit_notified_at
  // latch — a retried submit cannot duplicate the alert.
  app.post("/api/iep/evaluations/:id/submit", { schema: iepEvaluationsByIdSubmitSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [existing] = await db.select().from(iepEvaluations).where(eq(iepEvaluations.id, id));
    if (!existing) return reply.code(404).send({ error: "Evaluation not found" });
    if (!await canWrite(db, claims, existing.learnerId)) {
      return reply.code(403).send({ error: "Access denied" });
    }
    if (existing.status !== "draft") {
      return reply.code(409).send({ error: `Cannot submit from status '${existing.status}'` });
    }
    // Status-guarded UPDATE so concurrent submit retries elect a single
    // winner at the database — the read-then-write check above is a
    // TOCTOU and cannot be relied on alone.
    const [row] = await db.update(iepEvaluations)
      .set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(iepEvaluations.id, id), eq(iepEvaluations.status, "draft")))
      .returning();
    if (!row) {
      return reply.code(409).send({ error: "Evaluation status changed; please reload" });
    }
    // Idempotent notification dispatch: claim the latch atomically and
    // only fan out if the UPDATE wins. Concurrent submit retries see
    // `notified.length === 0` and skip dispatch entirely.
    void (async () => {
      try {
        const notified = await db.update(iepEvaluations)
          .set({ submitNotifiedAt: new Date() })
          .where(and(
            eq(iepEvaluations.id, id),
            isNull(iepEvaluations.submitNotifiedAt),
          ))
          .returning({ id: iepEvaluations.id });
        if (notified.length === 0) return;
        await dispatchSubmittedNotifications(db, row);
      } catch (err) {
        req.log.error({ err, evaluationId: id }, "evaluation-submit notify dispatch failed");
      }
    })();
    return row;
  });

  // Record team eligibility decision (eligible | not_eligible | needs_more_data).
  // The status moves to "eligibility_determined" regardless of which value the
  // team chose; the specific outcome lives in `decisionEligible`.
  app.post("/api/iep/evaluations/:id/decision", {
    schema: {
      tags: ["IEP-Evaluations"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        properties: {
          decision: { type: "string", enum: ["eligible", "not_eligible", "needs_more_data"] },
          eligible: { type: "boolean" },
          categories: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const { id } = req.params as { id: string };
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [existing] = await db.select().from(iepEvaluations).where(eq(iepEvaluations.id, id));
    if (!existing) return reply.code(404).send({ error: "Evaluation not found" });
    if (!await canWrite(db, claims, existing.learnerId)) {
      return reply.code(403).send({ error: "Access denied" });
    }
    if (existing.status !== "submitted") {
      return reply.code(409).send({ error: "Evaluation must be submitted before recording a decision" });
    }
    type Decision = "eligible" | "not_eligible" | "needs_more_data";
    const body = req.body as {
      decision?: Decision;
      eligible?: boolean;
      categories?: string[];
      rationale?: string;
    };
    let decision: Decision | null = null;
    if (body.decision === "eligible" || body.decision === "not_eligible" || body.decision === "needs_more_data") {
      decision = body.decision;
    } else if (body.eligible === true) {
      decision = "eligible";
    } else if (body.eligible === false) {
      decision = "not_eligible";
    }
    if (!decision) {
      return reply.code(400).send({ error: "decision is required" });
    }
    // Validate categories against the IDEA-13 enum so we don't persist arbitrary strings.
    const ALLOWED_CATEGORIES = new Set([
      "autism", "specific_learning_disability", "speech_language_impairment",
      "other_health_impairment", "emotional_disturbance", "intellectual_disability",
      "developmental_delay", "hearing_impairment", "visual_impairment",
      "orthopedic_impairment", "traumatic_brain_injury", "multiple_disabilities",
      "deaf_blindness", "deafness",
    ]);
    const cleanCategories = Array.isArray(body.categories)
      ? body.categories.filter((c) => typeof c === "string" && ALLOWED_CATEGORIES.has(c))
      : [];
    // Status-guarded update prevents races with concurrent PATCH/decision requests.
    const updated = await db.update(iepEvaluations).set({
      status: "eligibility_determined",
      decisionEligible: decision,
      decisionCategories: cleanCategories,
      decisionRationale: body.rationale || null,
      decidedAt: new Date(),
      decidedByUserId: claims.sub,
      updatedAt: new Date(),
    }).where(and(eq(iepEvaluations.id, id), eq(iepEvaluations.status, "submitted"))).returning();
    if (updated.length === 0) {
      return reply.code(409).send({ error: "Evaluation status changed; please reload" });
    }
    // Notify the parent that the eligibility decision has been recorded —
    // exactly once per evaluation via the decision_notified_at latch.
    void (async () => {
      try {
        const notified = await db.update(iepEvaluations)
          .set({ decisionNotifiedAt: new Date() })
          .where(and(
            eq(iepEvaluations.id, id),
            isNull(iepEvaluations.decisionNotifiedAt),
          ))
          .returning({ id: iepEvaluations.id });
        if (notified.length === 0) return;
        await dispatchDecidedNotifications(db, updated[0]);
      } catch (err) {
        req.log.error({ err, evaluationId: id }, "evaluation-decision notify dispatch failed");
      }
    })();
    return updated[0];
  });
}

// Fan out parent + district-admin notifications when an evaluation is
// submitted. Best-effort: any individual recipient failure is logged
// upstream and swallowed — comms-svc unavailability must never block a
// teacher's workflow.
async function dispatchSubmittedNotifications(db: any, evalRow: any) {
  const [learner] = await db.select().from(learners).where(eq(learners.id, evalRow.learnerId));
  if (!learner) return;
  const [parent] = await db.select({
    id: users.id, email: users.email, name: users.name,
  }).from(users).where(eq(users.id, learner.parentId));
  const learnerLink = `${APP_URL}/dashboard/parent/learner/${learner.id}`;
  if (parent?.email) {
    await bestEffortSendEmail("evaluation_submitted", parent.email, {
      learnerName: learner.name,
      submittedAt: evalRow.submittedAt,
      url: learnerLink,
    });
  }
  if (parent?.id) {
    await bestEffortInAppNotify({
      parentId: parent.id,
      learnerId: learner.id,
      category: "evaluations",
      template: "evaluation_submitted",
      title: `Evaluation submitted for ${learner.name}`,
      body: "The evaluation team has submitted the eligibility evaluation. You will be notified again when a decision is recorded.",
      link: learnerLink,
    });
  }
  // District admin email digest. The dashboard tile aggregates submitted
  // evaluations from /api/iep/evaluations/learner/:id; the email here is
  // a courtesy ping so admins don't have to refresh the tile to notice.
  const districtAdmins = await db.select({ email: users.email })
    .from(users)
    .where(and(eq(users.role, "DISTRICT_ADMIN"), eq(users.tenantId, evalRow.tenantId)));
  for (const admin of districtAdmins) {
    if (!admin.email) continue;
    await bestEffortSendEmail("evaluation_submitted_admin", admin.email, {
      learnerName: learner.name,
      submittedAt: evalRow.submittedAt,
      url: `${APP_URL}/dashboard/district`,
    });
  }
}

// Parent-only fan-out when the team records a decision. District admins
// don't get a per-decision email — they pull from the existing dashboard
// tile + can subscribe to /api/iep/evaluations/learner endpoints.
async function dispatchDecidedNotifications(db: any, evalRow: any) {
  const [learner] = await db.select().from(learners).where(eq(learners.id, evalRow.learnerId));
  if (!learner) return;
  const [parent] = await db.select({
    id: users.id, email: users.email, name: users.name,
  }).from(users).where(eq(users.id, learner.parentId));
  const learnerLink = `${APP_URL}/dashboard/parent/learner/${learner.id}`;
  const decision = evalRow.decisionEligible || "needs_more_data";
  if (parent?.email) {
    await bestEffortSendEmail("evaluation_decided", parent.email, {
      learnerName: learner.name,
      decision,
      decidedAt: evalRow.decidedAt,
      url: learnerLink,
    });
  }
  if (parent?.id) {
    await bestEffortInAppNotify({
      parentId: parent.id,
      learnerId: learner.id,
      category: "evaluations",
      template: "evaluation_decided",
      title: `Eligibility decision recorded for ${learner.name}`,
      body: `The team has recorded a decision: ${decision.replace(/_/g, " ")}.`,
      link: learnerLink,
    });
  }
}

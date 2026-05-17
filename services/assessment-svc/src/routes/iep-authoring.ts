import { FastifyInstance } from "fastify";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  iepProfiles,
  iepGoals,
  iepServices,
  iepPresentLevels,
  iepEvaluations,
  iepTeamMembers,
  iepRevisions,
  learners,
  learnerTeachers,
  learnerTherapists,
  users,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";

interface AuthClaims {
  sub: string;
  tenantId: string;
  role: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const PLOP_AREAS = ["academic", "functional", "social", "motor", "communication"] as const;
type LifecycleState = "draft" | "in_review" | "finalised" | "archived";
// Structural authoring is allowed only while the draft is `draft`. Once it
// moves to `in_review`, signatures are being collected and the bundle must
// freeze — only comments, revisions, and signatures may continue.
const EDITABLE_LIFECYCLE: LifecycleState[] = ["draft"];
// States from which a transition request is still legal (allows reverting
// in_review → draft for further edits).
const TRANSITIONABLE_LIFECYCLE: LifecycleState[] = ["draft", "in_review"];

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

// Therapist assignments are modeled in a separate table from teacher
// assignments, so we must check it explicitly when authorizing therapist
// authoring writes.
async function isTherapistOf(db: any, userSub: string, learnerId: string): Promise<boolean> {
  if (!isUuid(userSub) || !isUuid(learnerId)) return false;
  const rows = await db.select().from(learnerTherapists).where(
    and(
      eq(learnerTherapists.learnerId, learnerId),
      eq(learnerTherapists.therapistUserId, userSub),
      eq(learnerTherapists.status, "ACCEPTED"),
    ),
  );
  return rows.length > 0;
}

async function getLearner(db: any, learnerId: string) {
  if (!isUuid(learnerId)) return null;
  const [row] = await db.select().from(learners).where(eq(learners.id, learnerId));
  return row || null;
}

// SPED_LEAD: school-scoped admin (sprint task #12). Authority limited to
// users sharing the learner's school (via users.school_id).
async function isSpedLeadForLearner(db: any, claims: AuthClaims, learner: any): Promise<boolean> {
  if (claims.role !== "SPED_LEAD") return false;
  if (claims.tenantId !== learner.tenantId) return false;
  if (!learner.schoolId) return false;
  const [u] = await db.select({ schoolId: users.schoolId })
    .from(users).where(eq(users.id, claims.sub));
  if (!u?.schoolId) return false;
  return u.schoolId === learner.schoolId;
}

// Authoring team only — full draft contents must NOT be exposed to parents.
// Parents see the read-only "draft in progress" chip via the list-summary
// endpoint, which returns minimal metadata only.
async function canRead(db: any, claims: AuthClaims, learnerId: string): Promise<boolean> {
  const learner = await getLearner(db, learnerId);
  if (!learner) return false;
  if (claims.role === "PLATFORM_ADMIN") return true;
  if (claims.role === "DISTRICT_ADMIN") return claims.tenantId === learner.tenantId;
  if (await isSpedLeadForLearner(db, claims, learner)) return true;
  if (claims.role === "TEACHER" && await isTeacherOf(db, claims.sub, learnerId)) return true;
  if (claims.role === "THERAPIST" && await isTherapistOf(db, claims.sub, learnerId)) return true;
  return false;
}

// Parents are permitted minimal-metadata-only reads via the summary list
// endpoint (id, lifecycleState, timestamps); never the full draft body.
async function canReadSummary(db: any, claims: AuthClaims, learnerId: string): Promise<boolean> {
  if (await canRead(db, claims, learnerId)) return true;
  const learner = await getLearner(db, learnerId);
  if (!learner) return false;
  return learner.parentId === claims.sub;
}

// Author-only writes: every authoring mutation must be backed by an explicit
// teacher↔learner ACCEPTED link. TEACHER and THERAPIST are the authoring
// roles; admins do not bypass the per-learner assignment requirement.
async function canWrite(db: any, claims: AuthClaims, learnerId: string): Promise<boolean> {
  const learner = await getLearner(db, learnerId);
  if (!learner) return false;
  // SPED_LEAD inherits draft-write authority within their school so they
  // can shepherd drafts (assign case managers, edit before sign-off).
  if (await isSpedLeadForLearner(db, claims, learner)) return true;
  if (claims.role === "TEACHER" && await isTeacherOf(db, claims.sub, learnerId)) return true;
  if (claims.role === "THERAPIST" && await isTherapistOf(db, claims.sub, learnerId)) return true;
  return false;
}

async function loadDraftBundle(db: any, profileId: string) {
  const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, profileId));
  if (!profile) return null;
  const [plops, services, goals] = await Promise.all([
    db.select().from(iepPresentLevels).where(eq(iepPresentLevels.iepProfileId, profileId)),
    db.select().from(iepServices).where(eq(iepServices.iepProfileId, profileId)),
    db.select().from(iepGoals).where(eq(iepGoals.iepProfileId, profileId)),
  ]);
  return { profile, presentLevels: plops, services, goals };
}

// Capture a section snapshot after a structural mutation. Best-effort —
// revision-history failures must never break authoring writes. Snapshots
// are coarse-grained (the post-mutation state of the section) so the
// history view can show "who changed what and when" without needing diffs.
async function snapshotSection(
  db: any, profileId: string, section: string, snapshot: unknown, userId: string,
) {
  try {
    await db.insert(iepRevisions).values({
      iepProfileId: profileId, section, snapshot, authorId: userId,
    });
  } catch {
    /* swallow — history is non-critical */
  }
}

async function buildSectionSnapshot(db: any, profileId: string, section: string): Promise<unknown> {
  if (section === "goals") {
    return await db.select().from(iepGoals).where(eq(iepGoals.iepProfileId, profileId));
  }
  if (section === "services") {
    return await db.select().from(iepServices).where(eq(iepServices.iepProfileId, profileId));
  }
  if (section === "plop") {
    return await db.select().from(iepPresentLevels).where(eq(iepPresentLevels.iepProfileId, profileId));
  }
  if (section === "profile") {
    const [p] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, profileId));
    return p ? {
      accommodations: p.accommodations,
      assistiveTechnology: p.assistiveTechnology,
      communicationSystem: p.communicationSystem,
      gradeLevel: p.gradeLevel,
      placement: p.placement,
      reviewDate: p.reviewDate,
      disabilityCategories: p.disabilityCategories,
    } : null;
  }
  return null;
}

function isEditable(profile: any): boolean {
  return profile && EDITABLE_LIFECYCLE.includes(profile.lifecycleState as LifecycleState);
}

// Build present-levels narrative seeds from an eligibility evaluation. Each
// emitted line is prefixed with a label so the teacher can see at a glance
// what was carried over and what they still need to expand. The seeds are
// intentionally conservative — the evaluation rationale and observations are
// staging text, not the finished present-levels narrative.
function summarizeAssessmentAreas(areas: unknown): string {
  if (!Array.isArray(areas) || areas.length === 0) return "";
  const parts: string[] = [];
  for (const a of areas) {
    if (!a || typeof a !== "object") continue;
    const area = String((a as any).area || "").trim();
    if (!area) continue;
    const method = String((a as any).method || "").trim();
    const findings = String((a as any).findings || "").trim();
    const score = String((a as any).score || "").trim();
    const detail = [method, findings, score].filter(Boolean).join(" — ");
    parts.push(detail ? `${area}: ${detail}` : area);
  }
  return parts.join("\n");
}

function buildPresentLevelSeeds(evalRow: any): Array<{ area: string; narrative: string }> {
  const seeds: Array<{ area: string; narrative: string }> = [];
  const dateLabel = evalRow.decidedAt
    ? new Date(evalRow.decidedAt).toISOString().slice(0, 10)
    : new Date(evalRow.createdAt).toISOString().slice(0, 10);
  const header = `(Pre-filled from eligibility evaluation on ${dateLabel}.)`;
  // Academic narrative gets the team rationale, the original referral concern,
  // any teacher observations, and a flat dump of assessment-area findings.
  const academicChunks: string[] = [header];
  if (evalRow.decisionRationale) {
    academicChunks.push(`Eligibility rationale: ${evalRow.decisionRationale}`);
  }
  if (evalRow.referralReason) {
    academicChunks.push(`Referral concern: ${evalRow.referralReason}`);
  }
  if (evalRow.observations) {
    academicChunks.push(`Observations: ${evalRow.observations}`);
  }
  const areaSummary = summarizeAssessmentAreas(evalRow.assessmentAreas);
  if (areaSummary) {
    academicChunks.push(`Assessment areas reviewed:\n${areaSummary}`);
  }
  if (academicChunks.length > 1) {
    seeds.push({ area: "academic", narrative: academicChunks.join("\n\n") });
  }
  // Functional narrative carries the family voice when the evaluation captured
  // it — teachers most often expand this section with input from home.
  if (evalRow.parentInput) {
    seeds.push({
      area: "functional",
      narrative: `${header}\n\nParent input: ${evalRow.parentInput}`,
    });
  }
  return seeds;
}

export async function registerIepAuthoringRoutes(app: FastifyInstance) {
  // Create new authored draft (optionally seeded from an eligibility evaluation).
  app.post("/api/iep/drafts", {
    schema: {
      tags: ["IEP Authoring"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["learnerId"],
        properties: {
          learnerId: { type: "string" },
          fromEvaluationId: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const body = req.body as { learnerId: string; fromEvaluationId?: string };
    if (!isUuid(body.learnerId)) return reply.code(400).send({ error: "Invalid learnerId" });
    if (!await canWrite(db, claims, body.learnerId)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const learner = await getLearner(db, body.learnerId);
    let evalRow: any = null;
    if (body.fromEvaluationId) {
      if (!isUuid(body.fromEvaluationId)) return reply.code(400).send({ error: "Invalid fromEvaluationId" });
      const [row] = await db.select().from(iepEvaluations).where(eq(iepEvaluations.id, body.fromEvaluationId));
      if (!row || row.learnerId !== body.learnerId) {
        return reply.code(400).send({ error: "Evaluation not found for this learner" });
      }
      if (row.decisionEligible !== "eligible") {
        return reply.code(400).send({ error: "Can only seed draft from an eligible determination" });
      }
      evalRow = row;
    }
    const [profile] = await db.insert(iepProfiles).values({
      learnerId: body.learnerId,
      gradeLevel: learner?.gradeLevel,
      disabilityCategories: evalRow?.decisionCategories || [],
      source: "authored",
      lifecycleState: "draft",
      authoredByUserId: claims.sub,
      fromEvaluationId: evalRow?.id || null,
    }).returning();
    // Carry evaluation context into the present-levels stubs so the teacher
    // is editing seeded text instead of a blank textarea. Best-effort —
    // failing to seed must never block the draft itself, since the teacher
    // can always type the narrative manually.
    if (evalRow) {
      const seeds = buildPresentLevelSeeds(evalRow);
      if (seeds.length > 0) {
        try {
          await db.insert(iepPresentLevels).values(
            seeds.map((s) => ({
              iepProfileId: profile.id, area: s.area, narrative: s.narrative,
            })),
          );
        } catch (err) {
          req.log.error({ err }, "iep-draft: failed to seed present-levels from evaluation");
        }
      }
    }
    // Bootstrap the team: author becomes case_manager. Idempotent via unique
    // index — best-effort so any race never blocks draft creation.
    try {
      await db.insert(iepTeamMembers).values({
        iepProfileId: profile.id,
        userId: claims.sub,
        role: "case_manager",
        addedBy: claims.sub,
      });
    } catch (e: any) { if (String(e?.code) !== "23505") throw e; }
    return reply.code(201).send(profile);
  });

  // List authored drafts for a learner (most recent first).
  app.get("/api/iep/drafts/learner/:learnerId", {
    schema: { tags: ["IEP Authoring"], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { learnerId } = req.params as any;
    if (!isUuid(learnerId)) return reply.code(400).send({ error: "Invalid learnerId" });
    // Use canReadSummary so the linked parent receives the minimal-metadata
    // list needed to render the read-only "draft in progress" chip. Full
    // bundle access (/api/iep/drafts/:id) remains gated by canRead.
    if (!await canReadSummary(db, claims, learnerId)) return reply.code(403).send({ error: "Forbidden" });
    const rows = await db.select().from(iepProfiles)
      .where(and(eq(iepProfiles.learnerId, learnerId), eq(iepProfiles.source, "authored")))
      .orderBy(desc(iepProfiles.updatedAt));
    if (claims.role === "PARENT" || (await getLearner(db, learnerId))?.parentId === claims.sub) {
      // Parent: only expose lifecycle + minimal metadata, no content.
      return rows.map((r: any) => ({
        id: r.id,
        learnerId: r.learnerId,
        lifecycleState: r.lifecycleState,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
      }));
    }
    // For authoring-team viewers, decorate each draft with the current
    // case manager (sprint task #12 — surface it on draft cards). The
    // case manager is whichever team member holds role='case_manager';
    // expected to be exactly one row but we coalesce defensively.
    if (rows.length === 0) return rows;
    const profileIds = rows.map((r: any) => r.id);
    const caseManagers = await db.select({
      iepProfileId: iepTeamMembers.iepProfileId,
      userId: iepTeamMembers.userId,
      name: users.name,
      email: users.email,
    }).from(iepTeamMembers)
      .leftJoin(users, eq(users.id, iepTeamMembers.userId))
      .where(and(
        inArray(iepTeamMembers.iepProfileId, profileIds),
        eq(iepTeamMembers.role, "case_manager"),
      ));
    const cmByProfile = new Map<string, { userId: string; name: string | null; email: string | null }>();
    for (const cm of caseManagers) {
      if (!cmByProfile.has(cm.iepProfileId)) {
        cmByProfile.set(cm.iepProfileId, {
          userId: cm.userId, name: cm.name ?? null, email: cm.email ?? null,
        });
      }
    }
    return rows.map((r: any) => ({
      ...r,
      caseManager: cmByProfile.get(r.id) || null,
    }));
  });

  // Get full draft bundle (profile + plops + services + goals).
  app.get("/api/iep/drafts/:id", {
    schema: { tags: ["IEP Authoring"], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id } = req.params as any;
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canRead(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    const bundle = await loadDraftBundle(db, id);
    return bundle;
  });

  // PATCH top-level fields (auto-save). Last-write-wins for v1.
  app.patch("/api/iep/drafts/:id", {
    schema: {
      tags: ["IEP Authoring"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        properties: {
          accommodations: { type: "array" },
          assistiveTechnology: { type: "array" },
          communicationSystem: { type: "string" },
          gradeLevel: { type: "string" },
          placement: { type: "string" },
          reviewDate: { type: "string" },
          disabilityCategories: { type: "array" },
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id } = req.params as any;
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canWrite(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    if (!isEditable(profile)) return reply.code(409).send({ error: "Draft is not editable" });
    const body = req.body as any;
    const patch: any = { updatedAt: new Date() };
    for (const k of ["accommodations", "assistiveTechnology", "communicationSystem", "gradeLevel", "placement", "disabilityCategories"]) {
      if (k in body) patch[k] = body[k];
    }
    if ("reviewDate" in body && body.reviewDate) patch.reviewDate = new Date(body.reviewDate);
    const [updated] = await db.update(iepProfiles).set(patch)
      .where(and(eq(iepProfiles.id, id), inArray(iepProfiles.lifecycleState, EDITABLE_LIFECYCLE)))
      .returning();
    if (!updated) return reply.code(409).send({ error: "Draft is not editable" });
    void snapshotSection(db, id, "profile",
      await buildSectionSnapshot(db, id, "profile"), claims.sub);
    return updated;
  });

  // Delete a draft. Only allowed while still in draft/in_review lifecycle —
  // Finalised IEPs must be archived through a separate workflow, not deleted.
  app.delete("/api/iep/drafts/:id", {
    schema: { tags: ["IEP Authoring"], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id } = req.params as any;
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canWrite(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    if (!isEditable(profile)) return reply.code(409).send({ error: "Draft is not editable" });
    // present-levels, services, and goals cascade-delete via FK ON DELETE
    // CASCADE (migration 0013), so a single DELETE on the parent profile
    // sweeps the children atomically.
    await db.delete(iepProfiles).where(eq(iepProfiles.id, id));
    return reply.code(204).send();
  });

  // Upsert a present-levels narrative for a given area.
  app.put("/api/iep/drafts/:id/present-levels/:area", {
    schema: {
      tags: ["IEP Authoring"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["narrative"],
        properties: { narrative: { type: "string" } },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id, area } = req.params as any;
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    if (!(PLOP_AREAS as readonly string[]).includes(area)) {
      return reply.code(400).send({ error: "Invalid area" });
    }
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canWrite(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    if (!isEditable(profile)) return reply.code(409).send({ error: "Draft is not editable" });
    const { narrative } = req.body as { narrative: string };
    const existing = await db.select().from(iepPresentLevels).where(
      and(eq(iepPresentLevels.iepProfileId, id), eq(iepPresentLevels.area, area)),
    );
    if (existing.length > 0) {
      const [u] = await db.update(iepPresentLevels)
        .set({ narrative, updatedAt: new Date() })
        .where(eq(iepPresentLevels.id, existing[0].id)).returning();
      void snapshotSection(db, id, "plop",
        await buildSectionSnapshot(db, id, "plop"), claims.sub);
      return u;
    }
    const [u] = await db.insert(iepPresentLevels).values({
      iepProfileId: id, area, narrative,
    }).returning();
    void snapshotSection(db, id, "plop",
      await buildSectionSnapshot(db, id, "plop"), claims.sub);
    return reply.code(201).send(u);
  });

  // Goals CRUD (scoped to draft profile).
  app.post("/api/iep/drafts/:id/goals", {
    schema: {
      tags: ["IEP Authoring"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["goalText"],
        properties: {
          goalText: { type: "string" },
          domain: { type: "string" },
          baseline: { type: "string" },
          targetCriteria: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id } = req.params as any;
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canWrite(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    if (!isEditable(profile)) return reply.code(409).send({ error: "Draft is not editable" });
    const body = req.body as any;
    const [g] = await db.insert(iepGoals).values({
      learnerId: profile.learnerId,
      iepProfileId: id,
      goalText: body.goalText,
      domain: body.domain || null,
      baseline: body.baseline || null,
      targetCriteria: body.targetCriteria || null,
    }).returning();
    void snapshotSection(db, id, "goals",
      await buildSectionSnapshot(db, id, "goals"), claims.sub);
    return reply.code(201).send(g);
  });

  app.patch("/api/iep/drafts/:id/goals/:goalId", {
    schema: { tags: ["IEP Authoring"], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id, goalId } = req.params as any;
    if (!isUuid(id) || !isUuid(goalId)) return reply.code(400).send({ error: "Invalid id" });
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canWrite(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    if (!isEditable(profile)) return reply.code(409).send({ error: "Draft is not editable" });
    const body = req.body as any;
    const patch: any = { updatedAt: new Date() };
    for (const k of ["goalText", "domain", "baseline", "targetCriteria", "status"]) {
      if (k in body) patch[k] = body[k];
    }
    const [u] = await db.update(iepGoals).set(patch)
      .where(and(eq(iepGoals.id, goalId), eq(iepGoals.iepProfileId, id))).returning();
    if (!u) return reply.code(404).send({ error: "Goal not found" });
    void snapshotSection(db, id, "goals",
      await buildSectionSnapshot(db, id, "goals"), claims.sub);
    return u;
  });

  app.delete("/api/iep/drafts/:id/goals/:goalId", {
    schema: { tags: ["IEP Authoring"], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id, goalId } = req.params as any;
    if (!isUuid(id) || !isUuid(goalId)) return reply.code(400).send({ error: "Invalid id" });
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canWrite(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    if (!isEditable(profile)) return reply.code(409).send({ error: "Draft is not editable" });
    await db.delete(iepGoals)
      .where(and(eq(iepGoals.id, goalId), eq(iepGoals.iepProfileId, id)));
    void snapshotSection(db, id, "goals",
      await buildSectionSnapshot(db, id, "goals"), claims.sub);
    return reply.code(204).send();
  });

  // Services CRUD.
  app.post("/api/iep/drafts/:id/services", {
    schema: {
      tags: ["IEP Authoring"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["serviceType"],
        properties: {
          serviceType: { type: "string" },
          providerRole: { type: "string" },
          minutesPerWeek: { type: "integer" },
          frequency: { type: "string" },
          location: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id } = req.params as any;
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canWrite(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    if (!isEditable(profile)) return reply.code(409).send({ error: "Draft is not editable" });
    const body = req.body as any;
    const [s] = await db.insert(iepServices).values({
      iepProfileId: id,
      serviceType: body.serviceType,
      providerRole: body.providerRole || null,
      minutesPerWeek: typeof body.minutesPerWeek === "number" ? body.minutesPerWeek : null,
      frequency: body.frequency || null,
      location: body.location || null,
      notes: body.notes || null,
    }).returning();
    void snapshotSection(db, id, "services",
      await buildSectionSnapshot(db, id, "services"), claims.sub);
    return reply.code(201).send(s);
  });

  app.patch("/api/iep/drafts/:id/services/:serviceId", {
    schema: { tags: ["IEP Authoring"], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id, serviceId } = req.params as any;
    if (!isUuid(id) || !isUuid(serviceId)) return reply.code(400).send({ error: "Invalid id" });
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canWrite(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    if (!isEditable(profile)) return reply.code(409).send({ error: "Draft is not editable" });
    const body = req.body as any;
    const patch: any = { updatedAt: new Date() };
    for (const k of ["serviceType", "providerRole", "frequency", "location", "notes"]) {
      if (k in body) patch[k] = body[k];
    }
    if ("minutesPerWeek" in body) {
      patch.minutesPerWeek = typeof body.minutesPerWeek === "number" ? body.minutesPerWeek : null;
    }
    const [u] = await db.update(iepServices).set(patch)
      .where(and(eq(iepServices.id, serviceId), eq(iepServices.iepProfileId, id))).returning();
    if (!u) return reply.code(404).send({ error: "Service not found" });
    void snapshotSection(db, id, "services",
      await buildSectionSnapshot(db, id, "services"), claims.sub);
    return u;
  });

  app.delete("/api/iep/drafts/:id/services/:serviceId", {
    schema: { tags: ["IEP Authoring"], security: [{ bearerAuth: [] }] },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id, serviceId } = req.params as any;
    if (!isUuid(id) || !isUuid(serviceId)) return reply.code(400).send({ error: "Invalid id" });
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canWrite(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    if (!isEditable(profile)) return reply.code(409).send({ error: "Draft is not editable" });
    await db.delete(iepServices)
      .where(and(eq(iepServices.id, serviceId), eq(iepServices.iepProfileId, id)));
    void snapshotSection(db, id, "services",
      await buildSectionSnapshot(db, id, "services"), claims.sub);
    return reply.code(204).send();
  });

  // Lifecycle transition (draft → in_review). Finalisation lives in the
  // collaboration task (signatures), so we cap the transitions we accept here.
  app.post("/api/iep/drafts/:id/transition", {
    schema: {
      tags: ["IEP Authoring"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["to"],
        properties: { to: { type: "string", enum: ["draft", "in_review"] } },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { id } = req.params as any;
    if (!isUuid(id)) return reply.code(400).send({ error: "Invalid id" });
    const [profile] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.source !== "authored") return reply.code(404).send({ error: "Not an authored draft" });
    if (!await canWrite(db, claims, profile.learnerId)) return reply.code(403).send({ error: "Forbidden" });
    const { to } = req.body as { to: "draft" | "in_review" };
    if (!TRANSITIONABLE_LIFECYCLE.includes(profile.lifecycleState as LifecycleState)) {
      return reply.code(409).send({ error: "Cannot transition this draft" });
    }
    // Only the case manager (or original author bootstrapped as case_manager,
    // or platform admin) may shepherd lifecycle transitions.
    const isAuthor = profile.authoredByUserId === claims.sub;
    const cmRows = await db.select({ id: iepTeamMembers.id }).from(iepTeamMembers)
      .where(and(
        eq(iepTeamMembers.iepProfileId, id),
        eq(iepTeamMembers.userId, claims.sub),
        eq(iepTeamMembers.role, "case_manager"),
      ));
    const isCaseManager = cmRows.length > 0;
    if (!isAuthor && !isCaseManager && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Only the case manager can transition the draft" });
    }
    const [u] = await db.update(iepProfiles).set({ lifecycleState: to, updatedAt: new Date() })
      .where(and(eq(iepProfiles.id, id), inArray(iepProfiles.lifecycleState, TRANSITIONABLE_LIFECYCLE)))
      .returning();
    if (!u) return reply.code(409).send({ error: "Draft is not editable" });
    // When sending out for review, ensure the learner's parent is on the team
    // so they can read the bundle and sign. Idempotent via unique index.
    if (to === "in_review") {
      const [learner] = await db.select().from(learners).where(eq(learners.id, profile.learnerId));
      if (learner?.parentId) {
        try {
          await db.insert(iepTeamMembers).values({
            iepProfileId: id,
            userId: learner.parentId,
            role: "parent",
            addedBy: claims.sub,
          });
        } catch (e: any) { if (String(e?.code) !== "23505") throw e; }
      }
    }
    return u;
  });
}

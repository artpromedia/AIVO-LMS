// Phase D — parent sharing & ongoing IEP communication.
// Progress notes (teacher → goal/section), quarterly reports (case-manager
// authored, AI-seeded narrative, parent-visible once sent), amendments to
// finalised IEPs (parent must acknowledge), parent notification preferences,
// and a merged-feed timeline for the parent IEP page.
import { FastifyInstance } from "fastify";
import {
  iepProfiles,
  iepGoals,
  iepProgressNotes,
  iepProgressReports,
  iepAmendments,
  iepReviewReminders,
  iepRevisions,
  iepTeamMembers,
  parentNotificationPreferences,
  learners,
  users,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { createLogger } from "@aivo/observability";
import { and, eq, desc, asc, inArray, sql } from "drizzle-orm";
import { getIepDraftsByIdNotesSchema, getIepDraftsByIdReportsSchema, iepDraftsByIdReportsByRidSendSchema, getIepDraftsByIdAmendmentsSchema, getIepLearnersByLearnerIdTimelineSchema, getIepPreferencesSchema, getIepInternalUnreadParentUpdatesSchema, iepInternalRunReviewRemindersSchema, getIepDraftsByIdReportsSeedSchema } from "./schemas.js";

const logger = createLogger("assessment-svc:iep-updates");

interface AuthClaims {
  sub: string;
  role: string;
  tenantId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`assessment-svc: ${name} must be set in production`);
  return devDefault;
}
const COMMS_URL = requireUrl("COMMS_SVC_URL", "http://localhost:3010");
const APP_URL = requireUrl("APP_URL", "http://localhost:5000");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY
  || (IS_PROD ? "" : "aivo-internal-dev-key");

const NOTE_VISIBILITIES = ["parent", "team", "internal"] as const;
type NoteVisibility = typeof NOTE_VISIBILITIES[number];

// Default notification preferences. Reports/amendments/reminders are
// legally significant — opt-in by default and the parent can mute only
// progress_notes via the preferences endpoint.
const DEFAULT_PREFS = {
  progress_notes: { email: true, inApp: true },
  reports: { email: true, inApp: true },
  amendments: { email: true, inApp: true },
  reminders: { email: true, inApp: true },
};
type PrefCategory = keyof typeof DEFAULT_PREFS;

async function authenticate(req: any, reply: any): Promise<AuthClaims | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }
  try {
    return (await verifyJWT(auth.slice(7))) as AuthClaims;
  } catch {
    reply.code(401).send({ error: "Invalid token" });
    return null;
  }
}

async function loadProfile(db: any, id: string) {
  if (!isUuid(id)) return null;
  const [p] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
  return p || null;
}

async function isTeamMember(db: any, profileId: string, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const rows = await db.select({ id: iepTeamMembers.id }).from(iepTeamMembers)
    .where(and(eq(iepTeamMembers.iepProfileId, profileId), eq(iepTeamMembers.userId, userId)));
  return rows.length > 0;
}

async function isCaseManager(db: any, profileId: string, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const rows = await db.select({ id: iepTeamMembers.id }).from(iepTeamMembers)
    .where(and(
      eq(iepTeamMembers.iepProfileId, profileId),
      eq(iepTeamMembers.userId, userId),
      eq(iepTeamMembers.role, "case_manager"),
    ));
  return rows.length > 0;
}

async function getLearner(db: any, learnerId: string) {
  if (!isUuid(learnerId)) return null;
  const [row] = await db.select().from(learners).where(eq(learners.id, learnerId));
  return row || null;
}

// Parent of the learner OR PLATFORM_ADMIN.
async function isParentOf(db: any, claims: AuthClaims, learnerId: string): Promise<boolean> {
  if (claims.role === "PLATFORM_ADMIN") return true;
  const learner = await getLearner(db, learnerId);
  return !!learner && learner.parentId === claims.sub;
}

async function getActiveProfileForLearner(db: any, learnerId: string) {
  // The "active" IEP for parent-facing surfaces is the most recent finalised
  // (or in_review) authored profile. We accept any source so legacy uploaded
  // IEPs still have a notes/timeline channel.
  const rows = await db.select().from(iepProfiles)
    .where(eq(iepProfiles.learnerId, learnerId))
    .orderBy(desc(iepProfiles.updatedAt))
    .limit(5);
  return rows.find((r: any) => r.lifecycleState === "finalised")
    || rows.find((r: any) => r.lifecycleState === "in_review")
    || rows[0]
    || null;
}

async function getParentPrefs(db: any, parentId: string) {
  const [row] = await db.select().from(parentNotificationPreferences)
    .where(eq(parentNotificationPreferences.parentId, parentId));
  const stored = (row?.prefs as Record<string, { email?: boolean; inApp?: boolean }>) || {};
  // Merge stored over defaults so newly added categories pick up defaults.
  const merged: typeof DEFAULT_PREFS = { ...DEFAULT_PREFS };
  for (const k of Object.keys(DEFAULT_PREFS) as PrefCategory[]) {
    merged[k] = { ...DEFAULT_PREFS[k], ...(stored[k] || {}) };
  }
  return merged;
}

async function bestEffortSendEmail(template: string, to: string, data: Record<string, unknown>) {
  try {
    const res = await fetch(`${COMMS_URL}/api/comms/internal/iep-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({ template, to, data }),
    });
    if (!res.ok) {
      logger.warn("iep-notify email dispatch returned non-2xx", { template, to, status: res.status });
    }
  } catch (err: any) {
    logger.warn("iep-notify email dispatch failed", { template, to, err: err?.message });
  }
}

async function bestEffortInAppNotify(payload: {
  parentId: string;
  learnerId: string;
  category: PrefCategory;
  template: string;
  title: string;
  body?: string;
  link: string;
}) {
  try {
    const res = await fetch(`${COMMS_URL}/api/comms/internal/in-app-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn("in-app-notify dispatch returned non-2xx", {
        template: payload.template, parentId: payload.parentId,
        learnerId: payload.learnerId, status: res.status,
      });
    }
  } catch (err: any) {
    logger.warn("in-app-notify dispatch failed", {
      template: payload.template, parentId: payload.parentId,
      learnerId: payload.learnerId, err: err?.message,
    });
  }
}

// Build a short, parent-friendly title/body for the in-app inbox. We
// derive these from the same `data` payload we pass to the email
// renderer so the two channels stay consistent.
function buildInAppContent(
  category: PrefCategory,
  template: string,
  learnerName: string,
  data: Record<string, unknown>,
): { title: string; body?: string } {
  switch (category) {
    case "progress_notes":
      return {
        title: `New progress note for ${learnerName}`,
        body: typeof data.snippet === "string" ? data.snippet : undefined,
      };
    case "reports":
      return {
        title: `New IEP progress report for ${learnerName}`,
        body: typeof data.period === "string" ? `Reporting period: ${data.period}` : undefined,
      };
    case "amendments":
      return {
        title: `IEP amendment proposed for ${learnerName}`,
        body: typeof data.summary === "string" ? data.summary : undefined,
      };
    case "reminders": {
      const days = typeof data.threshold === "number" ? data.threshold : undefined;
      const date = typeof data.reviewDate === "string" ? data.reviewDate : undefined;
      return {
        title: `IEP review coming up for ${learnerName}`,
        body: days && date ? `${days} days until the review meeting (${date}).` : undefined,
      };
    }
    default:
      return { title: `Update for ${learnerName}` };
  }
}

async function notifyParentIfOptedIn(
  db: any,
  learnerId: string,
  category: PrefCategory,
  template: string,
  data: Record<string, unknown>,
) {
  const learner = await getLearner(db, learnerId);
  if (!learner) return;
  const prefs = await getParentPrefs(db, learner.parentId);
  const wantsEmail = !!prefs[category]?.email;
  const wantsInApp = !!prefs[category]?.inApp;
  if (!wantsEmail && !wantsInApp) return;
  const link = `${APP_URL}/dashboard/parent/learner/${learner.id}/iep`;
  if (wantsInApp) {
    const { title, body } = buildInAppContent(category, template, learner.name, data);
    await bestEffortInAppNotify({
      parentId: learner.parentId,
      learnerId: learner.id,
      category,
      template,
      title,
      body,
      link,
    });
  }
  if (wantsEmail) {
    const [parent] = await db.select({ email: users.email, name: users.name })
      .from(users).where(eq(users.id, learner.parentId));
    if (!parent?.email) return;
    await bestEffortSendEmail(template, parent.email, {
      learnerName: learner.name,
      iepUrl: link,
      ...data,
    });
  }
}

// Run the 90/60/30 day pre-review reminder check exactly once per
// (profile, threshold). Returns the number of reminders fired so callers
// can log activity. Idempotent: the unique index on iep_review_reminders
// guarantees at most one row per (profileId, threshold).
export async function checkReviewReminders(db: any): Promise<number> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let fired = 0;
  for (const threshold of [90, 60, 30]) {
    const target = new Date(today);
    target.setDate(target.getDate() + threshold);
    const dayStart = new Date(target);
    const dayEnd = new Date(target);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const profiles = await db.select().from(iepProfiles).where(and(
      eq(iepProfiles.lifecycleState, "finalised"),
      sql`${iepProfiles.reviewDate} >= ${dayStart.toISOString()}`,
      sql`${iepProfiles.reviewDate} < ${dayEnd.toISOString()}`,
    ));
    for (const p of profiles) {
      try {
        await db.insert(iepReviewReminders).values({
          iepProfileId: p.id,
          threshold,
          reviewDate: p.reviewDate,
        });
      } catch (e: any) {
        if (String(e?.code) === "23505") continue;
        throw e;
      }
      fired++;
      // Notify parent + case manager. Parent gating by preferences;
      // case-manager mail is unconditional because they own the workflow.
      const learner = await getLearner(db, p.learnerId);
      if (!learner) continue;
      const reviewDateStr = p.reviewDate ? new Date(p.reviewDate).toLocaleDateString() : "";
      await notifyParentIfOptedIn(db, p.learnerId, "reminders", "iep_review_reminder", {
        threshold, reviewDate: reviewDateStr,
      });
      const caseManagerRows = await db.select({ email: users.email, name: users.name })
        .from(iepTeamMembers)
        .innerJoin(users, eq(users.id, iepTeamMembers.userId))
        .where(and(
          eq(iepTeamMembers.iepProfileId, p.id),
          eq(iepTeamMembers.role, "case_manager"),
        ));
      for (const cm of caseManagerRows) {
        if (!cm.email) continue;
        await bestEffortSendEmail("iep_review_reminder", cm.email, {
          learnerName: learner.name,
          iepUrl: `${APP_URL}/dashboard/teacher/learners/${learner.id}/iep/draft?d=${p.id}`,
          threshold,
          reviewDate: reviewDateStr,
          recipientRole: "case_manager",
        });
      }
    }
  }
  return fired;
}

export async function registerIepUpdatesRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  // ───────── PROGRESS NOTES ─────────
  // Team-side: list + create against a specific draft/profile.
  app.get("/api/iep/drafts/:id/notes", { schema: getIepDraftsByIdNotesSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { id } = req.params as any;
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    const isMember = await isTeamMember(db, id, claims.sub);
    const learner = await getLearner(db, profile.learnerId);
    const isParent = !!learner && learner.parentId === claims.sub;
    if (!isMember && !isParent && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const rows = await db.select({
      id: iepProgressNotes.id,
      goalId: iepProgressNotes.goalId,
      body: iepProgressNotes.body,
      visibility: iepProgressNotes.visibility,
      attachmentUrl: iepProgressNotes.attachmentUrl,
      authorId: iepProgressNotes.authorId,
      authorName: users.name,
      authorRole: iepTeamMembers.role,
      createdAt: iepProgressNotes.createdAt,
    }).from(iepProgressNotes)
      .leftJoin(users, eq(users.id, iepProgressNotes.authorId))
      .leftJoin(iepTeamMembers, and(
        eq(iepTeamMembers.iepProfileId, iepProgressNotes.iepProfileId),
        eq(iepTeamMembers.userId, iepProgressNotes.authorId),
      ))
      .where(eq(iepProgressNotes.iepProfileId, id))
      .orderBy(desc(iepProgressNotes.createdAt))
      .limit(200);
    // Parents only ever see parent-visibility notes; everyone else sees all.
    const filtered = isParent && claims.role !== "PLATFORM_ADMIN"
      ? rows.filter((r: any) => r.visibility === "parent")
      : rows;
    return filtered;
  });

  app.post("/api/iep/drafts/:id/notes", {
    schema: {
      body: {
        type: "object",
        required: ["body"],
        properties: {
          body: { type: "string", minLength: 1, maxLength: 5000 },
          goalId: { type: "string" },
          visibility: { type: "string", enum: NOTE_VISIBILITIES as unknown as string[] },
          attachmentUrl: { type: "string", maxLength: 2048 },
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { id } = req.params as any;
    const { body, goalId, visibility, attachmentUrl } = req.body as any;
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (!await isTeamMember(db, id, claims.sub) && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Only team members can post progress notes" });
    }
    let safeAttachment: string | null = null;
    if (typeof attachmentUrl === "string" && attachmentUrl.length > 0) {
      try {
        const u = new URL(attachmentUrl);
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          return reply.code(400).send({ error: "attachmentUrl must use http or https" });
        }
        safeAttachment = u.toString();
      } catch {
        return reply.code(400).send({ error: "attachmentUrl must be a valid URL" });
      }
    }
    const vis: NoteVisibility = (NOTE_VISIBILITIES as readonly string[]).includes(visibility)
      ? visibility as NoteVisibility : "parent";
    const [row] = await db.insert(iepProgressNotes).values({
      iepProfileId: id,
      learnerId: profile.learnerId,
      goalId: goalId && isUuid(goalId) ? goalId : null,
      authorId: claims.sub,
      body,
      visibility: vis,
      attachmentUrl: safeAttachment,
    }).returning();
    if (vis === "parent") {
      await notifyParentIfOptedIn(db, profile.learnerId, "progress_notes",
        "iep_progress_note", { snippet: body.slice(0, 280) });
    }
    return row;
  });

  // ───────── PROGRESS REPORTS ─────────
  app.get("/api/iep/drafts/:id/reports", { schema: getIepDraftsByIdReportsSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { id } = req.params as any;
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (!await isTeamMember(db, id, claims.sub) && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    return db.select().from(iepProgressReports)
      .where(eq(iepProgressReports.iepProfileId, id))
      .orderBy(desc(iepProgressReports.createdAt));
  });

  app.post("/api/iep/drafts/:id/reports", {
    schema: {
      body: {
        type: "object",
        required: ["period"],
        properties: {
          period: { type: "string", maxLength: 30 },
          narrative: { type: "string", maxLength: 20000 },
          aiSummary: {},
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { id } = req.params as any;
    const { period, narrative, aiSummary } = req.body as any;
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (!await isCaseManager(db, id, claims.sub) && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Only the case manager can author reports" });
    }
    const [row] = await db.insert(iepProgressReports).values({
      iepProfileId: id,
      learnerId: profile.learnerId,
      period,
      narrative: narrative || null,
      aiSummary: aiSummary || null,
      status: "draft",
      createdBy: claims.sub,
    }).returning();
    return row;
  });

  app.patch("/api/iep/drafts/:id/reports/:rid", {
    schema: {
      body: {
        type: "object",
        properties: {
          narrative: { type: "string", maxLength: 20000 },
          period: { type: "string", maxLength: 30 },
          aiSummary: {},
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { id, rid } = req.params as any;
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (!await isCaseManager(db, id, claims.sub) && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const [existing] = await db.select().from(iepProgressReports)
      .where(and(eq(iepProgressReports.id, rid), eq(iepProgressReports.iepProfileId, id)));
    if (!existing) return reply.code(404).send({ error: "Report not found" });
    if (existing.status === "sent") {
      return reply.code(409).send({ error: "Sent reports are locked" });
    }
    const patch: any = { updatedAt: new Date() };
    const b = req.body as any;
    if (typeof b.narrative === "string") patch.narrative = b.narrative;
    if (typeof b.period === "string") patch.period = b.period;
    if (b.aiSummary !== undefined) patch.aiSummary = b.aiSummary;
    const [row] = await db.update(iepProgressReports).set(patch)
      .where(eq(iepProgressReports.id, rid)).returning();
    return row;
  });

  app.post("/api/iep/drafts/:id/reports/:rid/send", { schema: iepDraftsByIdReportsByRidSendSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { id, rid } = req.params as any;
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (!await isCaseManager(db, id, claims.sub) && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    // Conditional UPDATE — only flip the row if it's still in draft. This
    // makes "send" idempotent: a second click is a no-op.
    const [row] = await db.update(iepProgressReports)
      .set({ status: "sent", sentAt: new Date(), sentBy: claims.sub, updatedAt: new Date() })
      .where(and(
        eq(iepProgressReports.id, rid),
        eq(iepProgressReports.iepProfileId, id),
        eq(iepProgressReports.status, "draft"),
      ))
      .returning();
    if (!row) {
      // Either not found, or already sent.
      const [existing] = await db.select().from(iepProgressReports)
        .where(and(eq(iepProgressReports.id, rid), eq(iepProgressReports.iepProfileId, id)));
      if (!existing) return reply.code(404).send({ error: "Report not found" });
      return existing;
    }
    await notifyParentIfOptedIn(db, profile.learnerId, "reports", "iep_progress_report_sent",
      { period: row.period });
    return row;
  });

  // ───────── AMENDMENTS ─────────
  app.get("/api/iep/drafts/:id/amendments", { schema: getIepDraftsByIdAmendmentsSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { id } = req.params as any;
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    const learner = await getLearner(db, profile.learnerId);
    const isParent = !!learner && learner.parentId === claims.sub;
    if (!await isTeamMember(db, id, claims.sub) && !isParent && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    return db.select().from(iepAmendments)
      .where(eq(iepAmendments.iepProfileId, id))
      .orderBy(desc(iepAmendments.createdAt));
  });

  app.post("/api/iep/drafts/:id/amendments", {
    schema: {
      body: {
        type: "object",
        required: ["summary", "proposedChanges"],
        properties: {
          summary: { type: "string", minLength: 1, maxLength: 1000 },
          proposedChanges: {},
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { id } = req.params as any;
    const { summary, proposedChanges } = req.body as any;
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (profile.lifecycleState !== "finalised") {
      return reply.code(409).send({ error: "Amendments only apply to finalised IEPs" });
    }
    if (!await isCaseManager(db, id, claims.sub) && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Only the case manager can propose amendments" });
    }
    // Capture the current persisted state of the IEP into iep_revisions
    // BEFORE the amendment lands. This is the legal "before" snapshot the
    // amendment workflow audits against — we deliberately store the
    // current profile + goals (not the proposed delta) so reviewers can
    // diff pre/post for each affected section.
    const currentGoals = await db.select().from(iepGoals)
      .where(eq(iepGoals.iepProfileId, id));
    const sections = Object.keys((proposedChanges as Record<string, unknown>) || {});
    try {
      await db.insert(iepRevisions).values({
        iepProfileId: id,
        section: "amendment-pre".slice(0, 30),
        snapshot: {
          profile,
          goals: currentGoals,
          affectedSections: sections,
          proposedDelta: proposedChanges,
        },
        authorId: claims.sub,
      });
    } catch { /* best-effort */ }
    const [row] = await db.insert(iepAmendments).values({
      iepProfileId: id,
      learnerId: profile.learnerId,
      summary,
      proposedChanges,
      proposedBy: claims.sub,
    }).returning();
    await notifyParentIfOptedIn(db, profile.learnerId, "amendments",
      "iep_amendment_proposed", { summary });
    return row;
  });

  // Parent acknowledges (or objects to) a proposed amendment.
  app.post("/api/iep/amendments/:aid/respond", {
    schema: {
      body: {
        type: "object",
        required: ["response"],
        properties: {
          response: { type: "string", enum: ["acknowledged", "objected"] },
          note: { type: "string", maxLength: 2000 },
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { aid } = req.params as any;
    const { response, note } = req.body as any;
    if (!isUuid(aid)) return reply.code(400).send({ error: "Invalid id" });
    const [a] = await db.select().from(iepAmendments).where(eq(iepAmendments.id, aid));
    if (!a) return reply.code(404).send({ error: "Not found" });
    if (!await isParentOf(db, claims, a.learnerId)) {
      return reply.code(403).send({ error: "Only the parent can respond" });
    }
    if (a.status !== "proposed") {
      return reply.code(409).send({ error: "Amendment already responded to" });
    }
    const nowTs = new Date();
    const [row] = await db.update(iepAmendments)
      .set({
        status: response,
        acknowledgedBy: claims.sub,
        acknowledgedAt: nowTs,
        parentResponse: note || null,
        revisionCounter: response === "acknowledged" ? (a.revisionCounter || 0) + 1 : a.revisionCounter,
        updatedAt: nowTs,
      })
      .where(and(eq(iepAmendments.id, aid), eq(iepAmendments.status, "proposed")))
      .returning();
    if (!row) return reply.code(409).send({ error: "Amendment already responded to" });

    // ───── Merge step (only on parent acknowledgement) ─────
    // Acknowledgement is the legal trigger that lets the proposed
    // changes take effect. We:
    //  1. Snapshot the post-amendment state of profile + goals into
    //     iep_revisions so reviewers can diff pre vs post per section.
    //  2. Bump the IEP profile's revisionCounter so any downstream
    //     signature workflow knows the affected sections need re-sign.
    //  3. Advance the amendment from `acknowledged` → `merged`.
    // Each step is best-effort so a transient failure on one doesn't
    // block the others; the parent's acknowledgement is already
    // recorded above.
    if (response === "acknowledged") {
      const proposed = (row.proposedChanges as Record<string, any>) || {};
      const sections = Object.keys(proposed);

      // ─── APPLY proposedChanges to persisted IEP data ───
      // Supported shape (intentionally narrow & explicit; unknown
      // sections fall through into the snapshot as "noted but not
      // automatically applied" — case-management UI can act on them):
      //   profile: { reviewDate?, gradeLevel?, placement?,
      //              accommodations?, communicationSystem? }
      //   goals:   { add?:    [{goalText, domain, baseline, targetCriteria}],
      //              update?: [{id, ...same fields}],
      //              remove?: [goalId] }
      // Each block is best-effort and isolated so a malformed delta on
      // one section can't roll back the others.
      if (proposed.profile && typeof proposed.profile === "object") {
        const p = proposed.profile;
        const patch: Record<string, unknown> = {};
        if (p.reviewDate) patch.reviewDate = new Date(p.reviewDate);
        if (typeof p.gradeLevel === "string") patch.gradeLevel = p.gradeLevel;
        if (typeof p.placement === "string") patch.placement = p.placement;
        if (typeof p.communicationSystem === "string") patch.communicationSystem = p.communicationSystem;
        if (Array.isArray(p.accommodations)) patch.accommodations = p.accommodations;
        if (Object.keys(patch).length > 0) {
          try {
            await db.update(iepProfiles).set({ ...patch, updatedAt: nowTs })
              .where(eq(iepProfiles.id, a.iepProfileId));
          } catch { /* best-effort */ }
        }
      }
      if (proposed.goals && typeof proposed.goals === "object") {
        const g = proposed.goals;
        if (Array.isArray(g.add)) {
          for (const ng of g.add) {
            if (!ng?.goalText) continue;
            try {
              await db.insert(iepGoals).values({
                learnerId: a.learnerId,
                iepProfileId: a.iepProfileId,
                goalText: String(ng.goalText),
                domain: ng.domain || null,
                baseline: ng.baseline || null,
                targetCriteria: ng.targetCriteria || null,
              });
            } catch { /* best-effort */ }
          }
        }
        if (Array.isArray(g.update)) {
          for (const ug of g.update) {
            if (!ug?.id || !isUuid(ug.id)) continue;
            const patch: Record<string, unknown> = { updatedAt: nowTs };
            if (typeof ug.goalText === "string") patch.goalText = ug.goalText;
            if (typeof ug.domain === "string") patch.domain = ug.domain;
            if (typeof ug.baseline === "string") patch.baseline = ug.baseline;
            if (typeof ug.targetCriteria === "string") patch.targetCriteria = ug.targetCriteria;
            try {
              await db.update(iepGoals).set(patch)
                .where(and(eq(iepGoals.id, ug.id), eq(iepGoals.iepProfileId, a.iepProfileId)));
            } catch { /* best-effort */ }
          }
        }
        if (Array.isArray(g.remove)) {
          for (const rid of g.remove) {
            if (!isUuid(rid)) continue;
            try {
              await db.update(iepGoals).set({ status: "archived", updatedAt: nowTs })
                .where(and(eq(iepGoals.id, rid), eq(iepGoals.iepProfileId, a.iepProfileId)));
            } catch { /* best-effort */ }
          }
        }
      }

      try {
        const [profileNow] = await db.select().from(iepProfiles)
          .where(eq(iepProfiles.id, a.iepProfileId));
        const goalsNow = await db.select().from(iepGoals)
          .where(eq(iepGoals.iepProfileId, a.iepProfileId));
        await db.insert(iepRevisions).values({
          iepProfileId: a.iepProfileId,
          section: "amendment-post".slice(0, 30),
          snapshot: {
            profile: profileNow,
            goals: goalsNow,
            amendmentId: row.id,
            affectedSections: sections,
            appliedChanges: proposed,
          },
          authorId: claims.sub,
        });
      } catch { /* best-effort */ }
      try {
        await db.update(iepProfiles)
          .set({
            revisionCounter: sql`${iepProfiles.revisionCounter} + 1`,
            updatedAt: nowTs,
          })
          .where(eq(iepProfiles.id, a.iepProfileId));
      } catch { /* best-effort */ }
      try {
        await db.update(iepAmendments)
          .set({ status: "merged", updatedAt: new Date() })
          .where(and(eq(iepAmendments.id, row.id), eq(iepAmendments.status, "acknowledged")));
        row.status = "merged";
      } catch { /* best-effort */ }
    }
    // Notify case manager(s) so they know the amendment is unblocked.
    const cms = await db.select({ email: users.email, name: users.name })
      .from(iepTeamMembers)
      .innerJoin(users, eq(users.id, iepTeamMembers.userId))
      .where(and(
        eq(iepTeamMembers.iepProfileId, a.iepProfileId),
        eq(iepTeamMembers.role, "case_manager"),
      ));
    const learner = await getLearner(db, a.learnerId);
    for (const cm of cms) {
      if (!cm.email) continue;
      await bestEffortSendEmail("iep_amendment_acknowledged", cm.email, {
        learnerName: learner?.name || "the learner",
        iepUrl: `${APP_URL}/dashboard/teacher/learners/${a.learnerId}/iep/draft?d=${a.iepProfileId}`,
        response,
        summary: a.summary,
      });
    }
    return row;
  });

  // ───────── PARENT TIMELINE (merged feed) ─────────
  // Pulls notes/reports/amendments/reminders for the learner's active IEP,
  // collates them into a single chronological feed. Parents only see
  // visibility=parent notes and status=sent reports.
  app.get("/api/iep/learners/:learnerId/timeline", { schema: getIepLearnersByLearnerIdTimelineSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { learnerId } = req.params as any;
    if (!isUuid(learnerId)) return reply.code(400).send({ error: "Invalid id" });
    // AuthZ: parent of the learner OR platform admin OR (district admin in
    // the same tenant) OR a member of this learner's active IEP team.
    // We must look up the learner first so we can enforce tenant isolation
    // — without this, any teacher in any tenant could read any learner's
    // timeline by guessing a UUID.
    const learner = await getLearner(db, learnerId);
    if (!learner) return reply.code(404).send({ error: "Not found" });
    const isParent = await isParentOf(db, claims, learnerId);
    const sameTenant = claims.role === "PLATFORM_ADMIN"
      || learner.tenantId === claims.tenantId;
    const profile = await getActiveProfileForLearner(db, learnerId);
    const teamMember = profile && sameTenant
      ? await isTeamMember(db, profile.id, claims.sub)
      : false;
    const districtAdmin = sameTenant && claims.role === "DISTRICT_ADMIN";
    const allowed = isParent
      || claims.role === "PLATFORM_ADMIN"
      || teamMember
      || districtAdmin;
    if (!allowed) return reply.code(403).send({ error: "Forbidden" });
    if (!profile) return { items: [], iepProfileId: null };

    // Visibility tiers:
    //  - parent: only `parent` notes + `sent` reports
    //  - district admin (no team membership): `parent`+`team` notes
    //    (NEVER internal) + `sent` reports only — they oversee, they
    //    don't get internal day-to-day clinical notes
    //  - team member / platform admin: full feed (all visibilities, all
    //    report statuses including drafts)
    const forParents = isParent && !teamMember && claims.role !== "PLATFORM_ADMIN";
    const districtOnly = !isParent && !teamMember && districtAdmin
      && claims.role !== "PLATFORM_ADMIN";

    const [notes, reports, amendments, reminders] = await Promise.all([
      db.select({
        id: iepProgressNotes.id, body: iepProgressNotes.body,
        goalId: iepProgressNotes.goalId, visibility: iepProgressNotes.visibility,
        attachmentUrl: iepProgressNotes.attachmentUrl,
        authorId: iepProgressNotes.authorId, authorName: users.name,
        authorRole: iepTeamMembers.role,
        createdAt: iepProgressNotes.createdAt,
      }).from(iepProgressNotes)
        .leftJoin(users, eq(users.id, iepProgressNotes.authorId))
        .leftJoin(iepTeamMembers, and(
          eq(iepTeamMembers.iepProfileId, iepProgressNotes.iepProfileId),
          eq(iepTeamMembers.userId, iepProgressNotes.authorId),
        ))
        .where(eq(iepProgressNotes.iepProfileId, profile.id))
        .orderBy(desc(iepProgressNotes.createdAt))
        .limit(200),
      db.select({
        id: iepProgressReports.id, period: iepProgressReports.period,
        narrative: iepProgressReports.narrative, status: iepProgressReports.status,
        sentAt: iepProgressReports.sentAt, sentBy: iepProgressReports.sentBy,
        sentByName: users.name, createdAt: iepProgressReports.createdAt,
      }).from(iepProgressReports)
        .leftJoin(users, eq(users.id, iepProgressReports.sentBy))
        .where(eq(iepProgressReports.iepProfileId, profile.id))
        .orderBy(desc(iepProgressReports.createdAt)),
      db.select({
        id: iepAmendments.id, summary: iepAmendments.summary,
        proposedChanges: iepAmendments.proposedChanges, status: iepAmendments.status,
        proposedBy: iepAmendments.proposedBy, proposedByName: users.name,
        acknowledgedAt: iepAmendments.acknowledgedAt,
        revisionCounter: iepAmendments.revisionCounter,
        createdAt: iepAmendments.createdAt,
      }).from(iepAmendments)
        .leftJoin(users, eq(users.id, iepAmendments.proposedBy))
        .where(eq(iepAmendments.iepProfileId, profile.id))
        .orderBy(desc(iepAmendments.createdAt)),
      db.select().from(iepReviewReminders)
        .where(eq(iepReviewReminders.iepProfileId, profile.id))
        .orderBy(desc(iepReviewReminders.sentAt)),
    ]);

    const items: Array<{
      type: "note" | "report" | "amendment" | "reminder";
      id: string;
      at: string;
      payload: Record<string, unknown>;
    }> = [];
    for (const n of notes) {
      if (forParents && n.visibility !== "parent") continue;
      // District admins can see parent + team notes for oversight, but
      // never the team's internal-only notes.
      if (districtOnly && n.visibility === "internal") continue;
      items.push({ type: "note", id: n.id, at: n.createdAt.toISOString(), payload: n });
    }
    for (const r of reports) {
      if ((forParents || districtOnly) && r.status !== "sent") continue;
      const at = (r.sentAt || r.createdAt).toISOString();
      items.push({ type: "report", id: r.id, at, payload: r });
    }
    for (const a of amendments) {
      items.push({ type: "amendment", id: a.id, at: a.createdAt.toISOString(), payload: a });
    }
    for (const rem of reminders) {
      items.push({
        type: "reminder", id: rem.id, at: rem.sentAt.toISOString(),
        payload: { threshold: rem.threshold, reviewDate: rem.reviewDate },
      });
    }
    items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return {
      iepProfileId: profile.id,
      lifecycleState: profile.lifecycleState,
      reviewDate: profile.reviewDate,
      items,
    };
  });

  // ───────── NOTIFICATION PREFERENCES ─────────
  app.get("/api/iep/preferences", { schema: getIepPreferencesSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    return getParentPrefs(db, claims.sub);
  });

  app.put("/api/iep/preferences", {
    schema: {
      body: { type: "object" },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const incoming = (req.body as Record<string, { email?: boolean; inApp?: boolean }>) || {};
    // Sanitise: only allow known categories and boolean leaves.
    const sanitised: Record<string, { email: boolean; inApp: boolean }> = {};
    for (const k of Object.keys(DEFAULT_PREFS) as PrefCategory[]) {
      const cur = await getParentPrefs(db, claims.sub);
      const proposal = incoming[k] || {};
      sanitised[k] = {
        email: typeof proposal.email === "boolean" ? proposal.email : cur[k].email,
        inApp: typeof proposal.inApp === "boolean" ? proposal.inApp : cur[k].inApp,
      };
    }
    // Enforce: legally significant categories cannot be fully muted.
    for (const k of ["reports", "amendments", "reminders"] as PrefCategory[]) {
      if (!sanitised[k].email && !sanitised[k].inApp) {
        sanitised[k] = { email: true, inApp: true };
      }
    }
    const existing = await db.select().from(parentNotificationPreferences)
      .where(eq(parentNotificationPreferences.parentId, claims.sub));
    if (existing.length === 0) {
      try {
        await db.insert(parentNotificationPreferences).values({
          parentId: claims.sub, prefs: sanitised, updatedAt: new Date(),
        });
      } catch (e: any) {
        if (String(e?.code) !== "23505") throw e;
        await db.update(parentNotificationPreferences)
          .set({ prefs: sanitised, updatedAt: new Date() })
          .where(eq(parentNotificationPreferences.parentId, claims.sub));
      }
    } else {
      await db.update(parentNotificationPreferences)
        .set({ prefs: sanitised, updatedAt: new Date() })
        .where(eq(parentNotificationPreferences.parentId, claims.sub));
    }
    return sanitised;
  });

  // ───────── UNREAD COUNTERS (district) ─────────
  // Returns the count of parent-visible items added across all finalised
  // IEPs in the tenant in the last 14 days. Used by the district summary
  // tile so admins see the outbound communication volume.
  app.get("/api/iep/internal/unread-parent-updates", { schema: getIepInternalUnreadParentUpdatesSchema }, async (req, reply) => {
    const internalKey = req.headers["x-internal-key"];
    if (!internalKey || internalKey !== INTERNAL_KEY) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const tenantId = (req.query as any)?.tenantId;
    if (!isUuid(tenantId)) return reply.code(400).send({ error: "tenantId required" });
    const since = new Date(Date.now() - 14 * 86400000);
    const profileRows = await db.select({ id: iepProfiles.id }).from(iepProfiles)
      .innerJoin(learners, eq(learners.id, iepProfiles.learnerId))
      .where(and(
        eq(learners.tenantId, tenantId),
        eq(iepProfiles.lifecycleState, "finalised"),
      ));
    const profileIds = profileRows.map((p: any) => p.id);
    if (profileIds.length === 0) return { count: 0 };
    const [notesC] = await db.select({ count: sql<number>`count(*)::int` })
      .from(iepProgressNotes).where(and(
        inArray(iepProgressNotes.iepProfileId, profileIds),
        eq(iepProgressNotes.visibility, "parent"),
        sql`${iepProgressNotes.createdAt} >= ${since.toISOString()}`,
      ));
    const [reportsC] = await db.select({ count: sql<number>`count(*)::int` })
      .from(iepProgressReports).where(and(
        inArray(iepProgressReports.iepProfileId, profileIds),
        eq(iepProgressReports.status, "sent"),
        sql`${iepProgressReports.sentAt} >= ${since.toISOString()}`,
      ));
    const [amendsC] = await db.select({ count: sql<number>`count(*)::int` })
      .from(iepAmendments).where(and(
        inArray(iepAmendments.iepProfileId, profileIds),
        eq(iepAmendments.status, "proposed"),
        sql`${iepAmendments.createdAt} >= ${since.toISOString()}`,
      ));
    return {
      count: Number(notesC?.count || 0) + Number(reportsC?.count || 0) + Number(amendsC?.count || 0),
    };
  });

  // Manual trigger for the reminder cron (also wired from a setInterval in
  // the service entrypoint). Internal-key gated.
  app.post("/api/iep/internal/run-review-reminders", { schema: iepInternalRunReviewRemindersSchema }, async (req, reply) => {
    const internalKey = req.headers["x-internal-key"];
    if (!internalKey || internalKey !== INTERNAL_KEY) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const fired = await checkReviewReminders(db);
    return { fired };
  });

  // Helper: AI-seed the narrative for a quarterly report. Pulls the existing
  // family-svc report endpoint via its public route and condenses to a short
  // narrative the case manager can edit. Best-effort — failure returns 200
  // with `seeded: false` so the UI can still create an empty draft.
  app.get("/api/iep/drafts/:id/reports/seed", { schema: getIepDraftsByIdReportsSeedSchema }, async (req, reply) => {
    const claims = await authenticate(req, reply); if (!claims) return;
    const { id } = req.params as any;
    const profile = await loadProfile(db, id);
    if (!profile) return reply.code(404).send({ error: "Not found" });
    if (!await isCaseManager(db, id, claims.sub) && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const goals = await db.select().from(iepGoals).where(eq(iepGoals.learnerId, profile.learnerId));
    if (goals.length === 0) {
      return { seeded: false, narrative: "" };
    }
    const lines: string[] = [];
    lines.push(`Quarterly progress summary across ${goals.length} active goal${goals.length === 1 ? "" : "s"}:`);
    for (const g of goals.slice(0, 8)) {
      const status = g.status || "active";
      const baseline = g.baseline || "—";
      const target = g.targetCriteria || "—";
      lines.push(`• ${g.domain || "Goal"}: ${g.goalText.slice(0, 140)} — baseline ${baseline}, target ${target} (${status}).`);
    }
    lines.push("");
    lines.push("Edit this draft to add classroom observations, work samples, and next-quarter focus before sending.");
    return { seeded: true, narrative: lines.join("\n") };
  });
}

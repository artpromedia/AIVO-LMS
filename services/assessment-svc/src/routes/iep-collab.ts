// Phase C — IEP team collaboration & e-signatures.
// Adds team membership CRUD, threaded comments with @-mentions, revision
// history snapshots, and typed-name e-signatures that finalise the IEP
// once all required signers per district policy have signed.
import { FastifyInstance } from "fastify";
import {
  iepProfiles,
  iepTeamMembers,
  iepComments,
  iepRevisions,
  iepSignatures,
  learners,
  users,
  districtSettings,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { and, eq, desc, asc, isNull } from "drizzle-orm";
import crypto from "crypto";
import {
  getIepDraftsByIdTeamSchema,
  deleteIepDraftsByIdTeamByMemberIdSchema,
  getIepDraftsByIdCommentsSchema,
  getIepDraftsByIdRevisionsSchema,
  getIepDraftsByIdSignaturesSchema,
  iepDraftsByIdNotifyInReviewSchema,
} from "./schemas.js";

interface AuthClaims {
  sub: string;
  role: string;
  tenantId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const TEAM_ROLES = [
  "case_manager",
  "gen_ed_teacher",
  "sped_teacher",
  "therapist",
  "parent",
  "learner",
  "admin",
] as const;
type TeamRole = (typeof TEAM_ROLES)[number];

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`assessment-svc: ${name} must be set in production`);
  return devDefault;
}
const COMMS_URL = requireUrl("COMMS_SVC_URL", "http://localhost:3010");
const APP_URL = requireUrl("APP_URL", "http://localhost:5000");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");

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

async function loadDraft(db: any, id: string) {
  if (!isUuid(id)) return null;
  const [p] = await db.select().from(iepProfiles).where(eq(iepProfiles.id, id));
  if (!p || p.source !== "authored") return null;
  return p;
}

async function isTeamMember(db: any, profileId: string, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const rows = await db
    .select({ id: iepTeamMembers.id })
    .from(iepTeamMembers)
    .where(and(eq(iepTeamMembers.iepProfileId, profileId), eq(iepTeamMembers.userId, userId)));
  return rows.length > 0;
}

async function isCaseManager(db: any, profileId: string, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const rows = await db
    .select({ id: iepTeamMembers.id })
    .from(iepTeamMembers)
    .where(
      and(
        eq(iepTeamMembers.iepProfileId, profileId),
        eq(iepTeamMembers.userId, userId),
        eq(iepTeamMembers.role, "case_manager"),
      ),
    );
  return rows.length > 0;
}

// canRead: team member, author, parent of learner, or tenant district admin.
async function canRead(db: any, claims: AuthClaims, profile: any): Promise<boolean> {
  if (claims.role === "PLATFORM_ADMIN") return true;
  if (await isTeamMember(db, profile.id, claims.sub)) return true;
  if (profile.authoredByUserId === claims.sub) return true;
  const [learner] = await db.select().from(learners).where(eq(learners.id, profile.learnerId));
  if (!learner) return false;
  if (learner.parentId === claims.sub) return true;
  if (claims.role === "DISTRICT_ADMIN" && learner.tenantId === claims.tenantId) return true;
  return false;
}

// canWriteCollab: stricter than canRead — only direct participants (team
// members, author, parent of learner) may post comments/revisions/notify.
// District admins are intentionally excluded so generic admins cannot spam
// the thread or trigger parent emails.
async function canWriteCollab(db: any, claims: AuthClaims, profile: any): Promise<boolean> {
  if (await isTeamMember(db, profile.id, claims.sub)) return true;
  if (profile.authoredByUserId === claims.sub) return true;
  const [learner] = await db.select().from(learners).where(eq(learners.id, profile.learnerId));
  if (learner?.parentId === claims.sub) return true;
  return false;
}

async function getDistrictRequiredSignerRoles(db: any, tenantId: string): Promise<TeamRole[]> {
  const [row] = await db
    .select({ roles: districtSettings.iepRequiredSignerRoles })
    .from(districtSettings)
    .where(eq(districtSettings.tenantId, tenantId));
  const roles = (row?.roles as string[] | undefined) || [
    "case_manager",
    "parent",
    "gen_ed_teacher",
  ];
  return roles.filter((r): r is TeamRole => (TEAM_ROLES as readonly string[]).includes(r));
}

function extractMentions(body: string): string[] {
  // Matches @user-handles formed of [a-zA-Z0-9._-]+ following an @.
  const out = new Set<string>();
  for (const m of body.matchAll(/(?:^|\s)@([a-zA-Z0-9._-]+)/g)) {
    out.add(m[1].toLowerCase());
  }
  return Array.from(out);
}

async function bestEffortSendEmail(template: string, to: string, data: Record<string, unknown>) {
  // Email failures must not block IEP workflow — log + swallow.
  try {
    await fetch(`${COMMS_URL}/api/comms/internal/iep-notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({ template, to, data }),
    });
  } catch {
    /* best-effort */
  }
}

async function notifyTeamOnEvent(
  db: any,
  profile: any,
  template: string,
  extra: Record<string, unknown>,
) {
  // Parent recipient(s).
  const [learner] = await db.select().from(learners).where(eq(learners.id, profile.learnerId));
  if (!learner) return;
  const [parent] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, learner.parentId));
  if (parent?.email) {
    await bestEffortSendEmail(template, parent.email, {
      learnerName: learner.name,
      iepUrl: `${APP_URL}/dashboard/parent/learner/${learner.id}/iep`,
      ...extra,
    });
  }
}

export async function registerIepCollabRoutes(app: FastifyInstance) {
  // ───────── TEAM MEMBERSHIP ─────────
  app.get(
    "/api/iep/drafts/:id/team",
    { schema: getIepDraftsByIdTeamSchema },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id } = req.params as any;
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      if (!(await canRead(db, claims, profile)))
        return reply.code(403).send({ error: "Forbidden" });
      const rows = await db
        .select({
          id: iepTeamMembers.id,
          userId: iepTeamMembers.userId,
          role: iepTeamMembers.role,
          addedAt: iepTeamMembers.addedAt,
          name: users.name,
          email: users.email,
        })
        .from(iepTeamMembers)
        .leftJoin(users, eq(users.id, iepTeamMembers.userId))
        .where(eq(iepTeamMembers.iepProfileId, id))
        .orderBy(asc(iepTeamMembers.addedAt));
      return rows;
    },
  );

  app.post(
    "/api/iep/drafts/:id/team",
    {
      schema: {
        body: {
          type: "object",
          required: ["userId", "role"],
          properties: {
            userId: { type: "string" },
            role: { type: "string", enum: TEAM_ROLES as unknown as string[] },
          },
        },
      },
    },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id } = req.params as any;
      const { userId, role } = req.body as { userId: string; role: TeamRole };
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      // Only the case manager (or the original author bootstrapping the team) can add members.
      const isAuthor = profile.authoredByUserId === claims.sub;
      if (!isAuthor && !(await isCaseManager(db, id, claims.sub))) {
        return reply.code(403).send({ error: "Only the case manager can manage the team" });
      }
      if (!isUuid(userId)) return reply.code(400).send({ error: "Invalid userId" });
      const [u] = await db.select().from(users).where(eq(users.id, userId));
      if (!u) return reply.code(404).send({ error: "User not found" });
      // Tenant guard: target must belong to the same tenant as the learner.
      const [learner] = await db.select().from(learners).where(eq(learners.id, profile.learnerId));
      if (!learner) return reply.code(404).send({ error: "Learner not found" });
      const isLearnerParent = role === "parent" && learner.parentId === userId;
      if (!isLearnerParent && u.tenantId !== learner.tenantId) {
        return reply.code(403).send({ error: "User does not belong to this district" });
      }
      // De-dupe (same user+role) — backed by unique index too.
      const existing = await db
        .select()
        .from(iepTeamMembers)
        .where(
          and(
            eq(iepTeamMembers.iepProfileId, id),
            eq(iepTeamMembers.userId, userId),
            eq(iepTeamMembers.role, role),
          ),
        );
      if (existing.length > 0) return existing[0];
      try {
        const [row] = await db
          .insert(iepTeamMembers)
          .values({
            iepProfileId: id,
            userId,
            role,
            addedBy: claims.sub,
          })
          .returning();
        return row;
      } catch (e: any) {
        if (String(e?.code) === "23505") {
          const [row] = await db
            .select()
            .from(iepTeamMembers)
            .where(
              and(
                eq(iepTeamMembers.iepProfileId, id),
                eq(iepTeamMembers.userId, userId),
                eq(iepTeamMembers.role, role),
              ),
            );
          return row;
        }
        throw e;
      }
    },
  );

  app.delete(
    "/api/iep/drafts/:id/team/:memberId",
    { schema: deleteIepDraftsByIdTeamByMemberIdSchema },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id, memberId } = req.params as any;
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      const isAuthor = profile.authoredByUserId === claims.sub;
      if (!isAuthor && !(await isCaseManager(db, id, claims.sub))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      await db
        .delete(iepTeamMembers)
        .where(and(eq(iepTeamMembers.id, memberId), eq(iepTeamMembers.iepProfileId, id)));
      return { ok: true };
    },
  );

  // ───────── COMMENTS ─────────
  app.get(
    "/api/iep/drafts/:id/comments",
    { schema: getIepDraftsByIdCommentsSchema },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id } = req.params as any;
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      if (!(await canRead(db, claims, profile)))
        return reply.code(403).send({ error: "Forbidden" });
      const rows = await db
        .select({
          id: iepComments.id,
          section: iepComments.section,
          goalId: iepComments.goalId,
          body: iepComments.body,
          mentions: iepComments.mentions,
          parentCommentId: iepComments.parentCommentId,
          createdAt: iepComments.createdAt,
          resolvedAt: iepComments.resolvedAt,
          authorId: iepComments.authorId,
          authorName: users.name,
        })
        .from(iepComments)
        .leftJoin(users, eq(users.id, iepComments.authorId))
        .where(eq(iepComments.iepProfileId, id))
        .orderBy(asc(iepComments.createdAt));
      return rows;
    },
  );

  app.post(
    "/api/iep/drafts/:id/comments",
    {
      schema: {
        body: {
          type: "object",
          required: ["section", "body"],
          properties: {
            section: { type: "string", maxLength: 30 },
            goalId: { type: "string" },
            body: { type: "string", minLength: 1, maxLength: 5000 },
            parentCommentId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id } = req.params as any;
      const { section, goalId, body, parentCommentId } = req.body as any;
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      if (!(await canWriteCollab(db, claims, profile))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      const handles = extractMentions(body);
      // Resolve @-handles strictly within this IEP's team. We never scan the
      // wider tenant — that would leak comment snippets to unrelated users.
      const mentioned: { userId: string; email: string; name: string }[] = [];
      if (handles.length > 0) {
        const rows = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
          })
          .from(iepTeamMembers)
          .innerJoin(users, eq(users.id, iepTeamMembers.userId))
          .where(eq(iepTeamMembers.iepProfileId, id));
        const seen = new Set<string>();
        for (const r of rows) {
          if (seen.has(r.id)) continue;
          const local = (r.email || "").split("@")[0].toLowerCase();
          const nameSlug = (r.name || "").toLowerCase().replace(/\s+/g, ".");
          if (handles.includes(local) || handles.includes(nameSlug)) {
            seen.add(r.id);
            mentioned.push({ userId: r.id, email: r.email, name: r.name });
          }
        }
      }
      const [row] = await db
        .insert(iepComments)
        .values({
          iepProfileId: id,
          section,
          goalId: goalId && isUuid(goalId) ? goalId : null,
          authorId: claims.sub,
          body,
          mentions: mentioned.map((m) => m.userId),
          parentCommentId: parentCommentId && isUuid(parentCommentId) ? parentCommentId : null,
        })
        .returning();
      // Fire @-mention emails (best-effort).
      for (const m of mentioned) {
        void bestEffortSendEmail("iep_comment_mention", m.email, {
          name: m.name || "team member",
          section,
          snippet: body.slice(0, 280),
          iepUrl: `${APP_URL}/dashboard/teacher/learners/${profile.learnerId}/iep/draft?d=${id}`,
        });
      }
      return row;
    },
  );

  app.patch(
    "/api/iep/drafts/:id/comments/:cid",
    {
      schema: {
        body: {
          type: "object",
          properties: { resolved: { type: "boolean" } },
        },
      },
    },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id, cid } = req.params as any;
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      if (!(await canWriteCollab(db, claims, profile))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      const { resolved } = req.body as { resolved?: boolean };
      const patch: any = {};
      if (resolved === true) patch.resolvedAt = new Date();
      if (resolved === false) patch.resolvedAt = null;
      if (Object.keys(patch).length === 0)
        return reply.code(400).send({ error: "Nothing to update" });
      const [u] = await db
        .update(iepComments)
        .set(patch)
        .where(and(eq(iepComments.id, cid), eq(iepComments.iepProfileId, id)))
        .returning();
      if (!u) return reply.code(404).send({ error: "Comment not found" });
      return u;
    },
  );

  // ───────── REVISIONS ─────────
  app.get(
    "/api/iep/drafts/:id/revisions",
    { schema: getIepDraftsByIdRevisionsSchema },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id } = req.params as any;
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      if (!(await canRead(db, claims, profile)))
        return reply.code(403).send({ error: "Forbidden" });
      const rows = await db
        .select({
          id: iepRevisions.id,
          section: iepRevisions.section,
          snapshot: iepRevisions.snapshot,
          authorId: iepRevisions.authorId,
          authorName: users.name,
          createdAt: iepRevisions.createdAt,
        })
        .from(iepRevisions)
        .leftJoin(users, eq(users.id, iepRevisions.authorId))
        .where(eq(iepRevisions.iepProfileId, id))
        .orderBy(desc(iepRevisions.createdAt))
        .limit(200);
      return rows;
    },
  );

  app.post(
    "/api/iep/drafts/:id/revisions",
    {
      schema: {
        body: {
          type: "object",
          required: ["section", "snapshot"],
          properties: {
            section: { type: "string", maxLength: 30 },
            snapshot: {},
          },
        },
      },
    },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id } = req.params as any;
      const { section, snapshot } = req.body as any;
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      if (!(await canWriteCollab(db, claims, profile))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      const [row] = await db
        .insert(iepRevisions)
        .values({
          iepProfileId: id,
          section,
          snapshot,
          authorId: claims.sub,
        })
        .returning();
      return row;
    },
  );

  // ───────── SIGNATURES ─────────
  app.get(
    "/api/iep/drafts/:id/signatures",
    { schema: getIepDraftsByIdSignaturesSchema },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id } = req.params as any;
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      if (!(await canRead(db, claims, profile)))
        return reply.code(403).send({ error: "Forbidden" });
      const [learner] = await db.select().from(learners).where(eq(learners.id, profile.learnerId));
      const required = await getDistrictRequiredSignerRoles(db, learner.tenantId);
      const sigs = await db
        .select({
          id: iepSignatures.id,
          signerUserId: iepSignatures.signerUserId,
          signerRole: iepSignatures.signerRole,
          typedName: iepSignatures.typedName,
          signedAt: iepSignatures.signedAt,
          status: iepSignatures.status,
        })
        .from(iepSignatures)
        .where(eq(iepSignatures.iepProfileId, id))
        .orderBy(asc(iepSignatures.signedAt));
      const signedRoles = new Set(
        sigs
          .filter((s: { status: string }) => s.status === "signed")
          .map((s: { signerRole: string }) => s.signerRole),
      );
      const missing = required.filter((r) => !signedRoles.has(r));
      return { required, signatures: sigs, missingRoles: missing, complete: missing.length === 0 };
    },
  );

  app.post(
    "/api/iep/drafts/:id/signatures",
    {
      schema: {
        body: {
          type: "object",
          required: ["typedName"],
          properties: {
            typedName: { type: "string", minLength: 1, maxLength: 255 },
            signerRole: { type: "string", enum: TEAM_ROLES as unknown as string[] },
          },
        },
      },
    },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id } = req.params as any;
      const { typedName, signerRole } = req.body as { typedName: string; signerRole?: TeamRole };
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      if (profile.lifecycleState !== "in_review") {
        return reply.code(409).send({ error: "Signatures only accepted while in review" });
      }
      // Resolve signer's role for this IEP. If not specified, find from team.
      let role: TeamRole | null = signerRole || null;
      if (!role) {
        const memberships = await db
          .select({ role: iepTeamMembers.role })
          .from(iepTeamMembers)
          .where(and(eq(iepTeamMembers.iepProfileId, id), eq(iepTeamMembers.userId, claims.sub)));
        if (memberships.length === 0) {
          return reply.code(403).send({ error: "Not a member of this IEP team" });
        }
        role = memberships[0].role as TeamRole;
      } else {
        // Verify they actually hold that role.
        const ok = await db
          .select({ id: iepTeamMembers.id })
          .from(iepTeamMembers)
          .where(
            and(
              eq(iepTeamMembers.iepProfileId, id),
              eq(iepTeamMembers.userId, claims.sub),
              eq(iepTeamMembers.role, role),
            ),
          );
        if (ok.length === 0)
          return reply.code(403).send({ error: "You do not hold that team role" });
      }
      const ipHash = crypto
        .createHash("sha256")
        .update(String(req.headers["x-forwarded-for"] || (req as any).ip || ""))
        .digest("hex")
        .slice(0, 64);
      let sig: any;
      try {
        [sig] = await db
          .insert(iepSignatures)
          .values({
            iepProfileId: id,
            signerUserId: claims.sub,
            signerRole: role,
            typedName,
            ipHash,
            status: "signed",
          })
          .returning();
      } catch (e: any) {
        if (String(e?.code) === "23505") {
          return reply.code(409).send({ error: "Already signed in this role" });
        }
        throw e;
      }

      // Re-evaluate completion → if done, transition to finalised + notify
      // parent. The conditional UPDATE (where lifecycleState='in_review') means
      // only one racing finaliser can flip the state and trigger the email.
      const [learner] = await db.select().from(learners).where(eq(learners.id, profile.learnerId));
      const required = await getDistrictRequiredSignerRoles(db, learner.tenantId);
      const sigs = await db
        .select({ signerRole: iepSignatures.signerRole, status: iepSignatures.status })
        .from(iepSignatures)
        .where(eq(iepSignatures.iepProfileId, id));
      const signed = new Set(
        sigs
          .filter((s: { status: string }) => s.status === "signed")
          .map((s: { signerRole: string }) => s.signerRole),
      );
      const allSigned = required.every((r) => signed.has(r));
      if (allSigned) {
        const updated = await db
          .update(iepProfiles)
          .set({ lifecycleState: "finalised", updatedAt: new Date() })
          .where(and(eq(iepProfiles.id, id), eq(iepProfiles.lifecycleState, "in_review")))
          .returning({ id: iepProfiles.id });
        if (updated.length > 0) {
          await notifyTeamOnEvent(db, profile, "iep_finalised_parent", {});
        }
      }
      return { signature: sig, complete: allSigned };
    },
  );

  // ───────── REVIEW TRANSITION HOOK ─────────
  // The base draft→in_review transition lives in iep-authoring. We expose
  // a parent-notification trigger here so the editor can ping us after a
  // successful transition without weaving comms-svc through that route.
  app.post(
    "/api/iep/drafts/:id/notify-in-review",
    { schema: iepDraftsByIdNotifyInReviewSchema },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { id } = req.params as any;
      const profile = await loadDraft(db, id);
      if (!profile) return reply.code(404).send({ error: "Not found" });
      if (profile.lifecycleState !== "in_review") {
        return reply.code(409).send({ error: "Not in review" });
      }
      if (!(await canWriteCollab(db, claims, profile))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      // Idempotent: only the first notify-in-review for a given draft fires the
      // parent email, so repeated calls (e.g. tab refreshes, retries) cannot
      // spam the family. We claim the slot atomically with a single UPDATE
      // gated on in_review_notified_at IS NULL — under concurrent calls only
      // one row will be returned and only that caller dispatches the email.
      const claimed = await db
        .update(iepProfiles)
        .set({ inReviewNotifiedAt: new Date() })
        .where(
          and(
            eq(iepProfiles.id, id),
            eq(iepProfiles.lifecycleState, "in_review"),
            isNull(iepProfiles.inReviewNotifiedAt),
          ),
        )
        .returning({ id: iepProfiles.id });
      if (claimed.length === 1) {
        await notifyTeamOnEvent(db, profile, "iep_in_review_parent", {});
        return { ok: true, sent: true };
      }
      return { ok: true, sent: false };
    },
  );
}

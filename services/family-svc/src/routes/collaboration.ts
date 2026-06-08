import { FastifyInstance } from "fastify";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import crypto from "node:crypto";
import {
  learnerTeachers,
  learnerCaregivers,
  learnerTherapists,
  teacherParentInvites,
  learners,
  users,
  brainInsights,
  brainStates,
  iepGoals,
  therapyGoals,
  classrooms,
  classroomEnrollments,
  schools,
} from "@aivo/db";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import {
  getCollaborationByLearnerIdMembersSchema,
  collaborationByLearnerIdInviteTeacherSchema,
  collaborationByLearnerIdInviteCaregiverSchema,
  collaborationByLearnerIdInviteTherapistSchema,
  deleteCollaborationByLearnerIdMemberByMemberIdSchema,
  collaborationByLearnerIdInsightSchema,
  getCollaborationByLearnerIdBrainTeacherSchema,
  getCollaborationByLearnerIdBrainCaregiverSchema,
  getCollaborationByLearnerIdBrainTherapistSchema,
  getCollaborationConnectedLearnersSchema,
  collaborationAcceptInviteSchema,
  getCollaborationPendingInvitesSchema,
  collaborationInviteParentSchema,
  collaborationInviteParentResendSchema,
  collaborationInviteParentRevokeSchema,
  getCollaborationInviteParentByTeacherSchema,
  getTeacherRosterSchema,
  collaborationInviteResendSchema,
  collaborationInviteRevokeSchema,
} from "./schemas.js";

const INVITE_TTL_HOURS = 72;

function hashInviteToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Sprint 5 (invite-flows): per-user invite rate limiting. Protects against
// invite spam (e.g. a compromised account blasting addresses). Tracks two
// rolling windows per inviter: 10 invites/hour and 50 invites/day. Counts
// every successful create across all 4 invite kinds (teacher, caregiver,
// therapist, teacher_parent). In-memory is sufficient for our single-pod
// dev/staging setup; a future iteration can promote to Postgres if we run
// multi-replica.
const INVITE_RATE_HOUR_LIMIT = 10;
const INVITE_RATE_DAY_LIMIT = 50;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
interface RateBucket {
  hourStart: number;
  hourCount: number;
  dayStart: number;
  dayCount: number;
}
const inviteRateBuckets = new Map<string, RateBucket>();

export function checkInviteRateLimit(
  inviterId: string,
  now = Date.now(),
): { ok: true } | { ok: false; window: "hour" | "day"; retryAfterMs: number } {
  let b = inviteRateBuckets.get(inviterId);
  if (!b) {
    b = { hourStart: now, hourCount: 0, dayStart: now, dayCount: 0 };
    inviteRateBuckets.set(inviterId, b);
  }
  if (now - b.hourStart >= HOUR_MS) {
    b.hourStart = now;
    b.hourCount = 0;
  }
  if (now - b.dayStart >= DAY_MS) {
    b.dayStart = now;
    b.dayCount = 0;
  }
  if (b.hourCount >= INVITE_RATE_HOUR_LIMIT) {
    return { ok: false, window: "hour", retryAfterMs: HOUR_MS - (now - b.hourStart) };
  }
  if (b.dayCount >= INVITE_RATE_DAY_LIMIT) {
    return { ok: false, window: "day", retryAfterMs: DAY_MS - (now - b.dayStart) };
  }
  b.hourCount += 1;
  b.dayCount += 1;
  return { ok: true };
}

// Exposed for tests.
export function resetInviteRateLimitsForTest() {
  inviteRateBuckets.clear();
}

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`family-svc: ${name} must be set in production`);
  return devDefault;
}
const COMMS_URL = requireUrl("COMMS_SVC_URL", "http://localhost:3010");
const APP_URL = requireUrl("APP_URL", "http://localhost:5000");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || (IS_PROD ? "" : "aivo-internal-dev-key");

// Best-effort dispatch of a "you're invited" email when a parent adds a
// caregiver / co-parent / teacher / therapist. Failures are logged but
// never block the invite write — the invitee can still self-discover the
// invite by signing up with the same email.
async function sendTeamInviteEmail(
  app: FastifyInstance,
  payload: { to: string; inviterName: string; learnerName: string; role: string },
) {
  try {
    const acceptUrl = `${APP_URL}/accept-invite?email=${encodeURIComponent(payload.to)}`;
    const res = await fetch(`${COMMS_URL}/api/comms/internal/team-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({ ...payload, acceptUrl }),
    });
    if (!res.ok) {
      app.log.warn(
        { to: payload.to, role: payload.role, status: res.status },
        "team-invite email dispatch returned non-2xx",
      );
    }
  } catch (err: any) {
    app.log.warn({ to: payload.to, err: err?.message }, "team-invite email dispatch failed");
  }
}

// Sprint 3 (invite-flows): dispatch a teacher→parent invite email via
// comms-svc. Best-effort; the invite row is already persisted so the
// teacher can resend if delivery fails.
async function sendTeacherParentInviteEmail(
  app: FastifyInstance,
  payload: {
    to: string;
    teacherName: string;
    schoolName: string;
    childName: string;
    notes?: string | null;
    token: string;
  },
) {
  try {
    const acceptUrl = `${APP_URL}/accept-invite?token=${encodeURIComponent(payload.token)}&email=${encodeURIComponent(payload.to)}`;
    const res = await fetch(`${COMMS_URL}/api/comms/internal/teacher-invite-parent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": INTERNAL_KEY },
      body: JSON.stringify({
        to: payload.to,
        teacherName: payload.teacherName,
        schoolName: payload.schoolName,
        childName: payload.childName,
        notes: payload.notes ?? undefined,
        acceptUrl,
      }),
    });
    if (!res.ok) {
      app.log.warn(
        { to: payload.to, status: res.status },
        "teacher-invite-parent email dispatch returned non-2xx",
      );
    }
  } catch (err: any) {
    app.log.warn(
      { to: payload.to, err: err?.message },
      "teacher-invite-parent email dispatch failed",
    );
  }
}

// Look up the inviter's name and the learner's name so the invite email
// can be personalised. Returns sane fallbacks if either lookup misses.
async function loadInviteContext(
  db: ReturnType<typeof import("@aivo/db").createDb>,
  inviterId: string,
  learnerId: string,
): Promise<{ inviterName: string; learnerName: string }> {
  try {
    const [inviter] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, inviterId))
      .limit(1);
    const [learner] = await db
      .select({ name: learners.name })
      .from(learners)
      .where(eq(learners.id, learnerId))
      .limit(1);
    return {
      inviterName: inviter?.name || "A parent",
      learnerName: learner?.name || "their child",
    };
  } catch {
    return { inviterName: "A parent", learnerName: "their child" };
  }
}

// If the invitee already has a registered account we can link the invite
// to their user id and mark it ACCEPTED immediately, so the learner shows
// up in their dashboard without an extra accept-invite hop. Returns
// null when no matching user exists (the normal pending-invite path).
async function findExistingUser(
  db: ReturnType<typeof import("@aivo/db").createDb>,
  emailLower: string,
): Promise<{ id: string } | null> {
  try {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailLower))
      .limit(1);
    return u ?? null;
  } catch {
    return null;
  }
}

interface LearnerId {
  learnerId: string;
}

interface MemberParams extends LearnerId {
  memberId: string;
}

interface MemberTypeQuery {
  memberType?: string;
}

interface InviteTeacherBody {
  email: string;
  name?: string;
}

interface InviteCaregiverBody {
  email: string;
  relationship?: string;
}

interface InviteTherapistBody {
  email: string;
  specialty?: string;
  credentials?: string;
}

interface InsightBody {
  insightText: string;
  domain?: string;
  source?: string;
}

export async function registerCollaborationRoutes(app: FastifyInstance) {
  const db = (app as unknown as { db: ReturnType<typeof import("@aivo/db").createDb> }).db;

  app.get(
    "/api/family/collaboration/:learnerId/members",
    { schema: getCollaborationByLearnerIdMembersSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as LearnerId;
      const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
      if (!isParent && claims.role !== "PLATFORM_ADMIN") {
        return reply.code(403).send({ error: "Access denied" });
      }

      const teachers = await db
        .select()
        .from(learnerTeachers)
        .where(eq(learnerTeachers.learnerId, learnerId));
      const caregivers = await db
        .select()
        .from(learnerCaregivers)
        .where(eq(learnerCaregivers.learnerId, learnerId));
      const therapists = await db
        .select()
        .from(learnerTherapists)
        .where(eq(learnerTherapists.learnerId, learnerId));

      return {
        teachers: teachers.map((t) => ({ ...t, memberType: "teacher" })),
        caregivers: caregivers.map((c) => ({ ...c, memberType: "caregiver" })),
        therapists: therapists.map((t) => ({ ...t, memberType: "therapist" })),
        seats: {
          teacher: { used: teachers.length, max: 1 },
          caregiver: { used: caregivers.length, max: 2 },
          therapist: { used: therapists.length, max: 1 },
        },
      };
    },
  );

  app.post(
    "/api/family/collaboration/:learnerId/invite/teacher",
    { schema: collaborationByLearnerIdInviteTeacherSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as LearnerId;
      const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
      if (!isParent) return reply.code(403).send({ error: "Only parents can invite team members" });

      const rl = checkInviteRateLimit(claims.sub);
      if (!rl.ok) {
        return reply
          .code(429)
          .header("Retry-After", Math.ceil(rl.retryAfterMs / 1000))
          .send({
            error: `Invite rate limit exceeded (${rl.window}). Try again later.`,
          });
      }

      const body = request.body as InviteTeacherBody;
      if (!body.email) return reply.code(400).send({ error: "Email is required" });
      const normalizedEmail = body.email.trim().toLowerCase();

      const existing = await db
        .select()
        .from(learnerTeachers)
        .where(
          and(
            eq(learnerTeachers.learnerId, learnerId),
            eq(learnerTeachers.teacherEmail, normalizedEmail),
          ),
        );
      if (existing.length > 0) return reply.code(409).send({ error: "Teacher already invited" });

      const existingCount = await db
        .select()
        .from(learnerTeachers)
        .where(eq(learnerTeachers.learnerId, learnerId));
      if (existingCount.length >= 1) {
        return reply.code(400).send({ error: "B2C plan allows 1 teacher slot. Upgrade for more." });
      }

      const learnerRows = await db.select().from(learners).where(eq(learners.id, learnerId));
      if (learnerRows.length === 0) return reply.code(404).send({ error: "Learner not found" });
      const tenantId = learnerRows[0].tenantId;

      const existingUser = await findExistingUser(db, normalizedEmail);
      const autoAccept = !!existingUser;

      const [record] = await db
        .insert(learnerTeachers)
        .values({
          tenantId,
          learnerId,
          teacherEmail: normalizedEmail,
          teacherUserId: existingUser?.id ?? null,
          invitedBy: claims.sub,
          status: autoAccept ? "ACCEPTED" : "PENDING",
          acceptedAt: autoAccept ? new Date() : null,
        })
        .returning();

      const ctx = await loadInviteContext(db, claims.sub, learnerId);
      void sendTeamInviteEmail(app, { to: normalizedEmail, role: "teacher", ...ctx });

      return reply.code(201).send(record);
    },
  );

  app.post(
    "/api/family/collaboration/:learnerId/invite/caregiver",
    { schema: collaborationByLearnerIdInviteCaregiverSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as LearnerId;
      const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
      if (!isParent) return reply.code(403).send({ error: "Only parents can invite team members" });

      const rl = checkInviteRateLimit(claims.sub);
      if (!rl.ok) {
        return reply
          .code(429)
          .header("Retry-After", Math.ceil(rl.retryAfterMs / 1000))
          .send({
            error: `Invite rate limit exceeded (${rl.window}). Try again later.`,
          });
      }

      const body = request.body as InviteCaregiverBody;
      if (!body.email) return reply.code(400).send({ error: "Email is required" });
      const normalizedEmail = body.email.trim().toLowerCase();

      const existing = await db
        .select()
        .from(learnerCaregivers)
        .where(
          and(
            eq(learnerCaregivers.learnerId, learnerId),
            eq(learnerCaregivers.caregiverEmail, normalizedEmail),
          ),
        );
      if (existing.length > 0) return reply.code(409).send({ error: "Caregiver already invited" });

      const existingCount = await db
        .select()
        .from(learnerCaregivers)
        .where(eq(learnerCaregivers.learnerId, learnerId));
      if (existingCount.length >= 2) {
        return reply.code(400).send({ error: "Maximum 2 caregivers allowed" });
      }

      const learnerRows = await db.select().from(learners).where(eq(learners.id, learnerId));
      if (learnerRows.length === 0) return reply.code(404).send({ error: "Learner not found" });
      const tenantId = learnerRows[0].tenantId;

      const existingUser = await findExistingUser(db, normalizedEmail);
      const autoAccept = !!existingUser;

      const [record] = await db
        .insert(learnerCaregivers)
        .values({
          tenantId,
          learnerId,
          caregiverEmail: normalizedEmail,
          caregiverUserId: existingUser?.id ?? null,
          invitedBy: claims.sub,
          relationship: body.relationship || null,
          status: autoAccept ? "ACCEPTED" : "PENDING",
          acceptedAt: autoAccept ? new Date() : null,
        })
        .returning();

      const ctx = await loadInviteContext(db, claims.sub, learnerId);
      void sendTeamInviteEmail(app, {
        to: normalizedEmail,
        role: body.relationship || "co-parent / caregiver",
        ...ctx,
      });

      return reply.code(201).send(record);
    },
  );

  app.post(
    "/api/family/collaboration/:learnerId/invite/therapist",
    { schema: collaborationByLearnerIdInviteTherapistSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as LearnerId;
      const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
      if (!isParent) return reply.code(403).send({ error: "Only parents can invite team members" });

      const rl = checkInviteRateLimit(claims.sub);
      if (!rl.ok) {
        return reply
          .code(429)
          .header("Retry-After", Math.ceil(rl.retryAfterMs / 1000))
          .send({
            error: `Invite rate limit exceeded (${rl.window}). Try again later.`,
          });
      }

      const body = request.body as InviteTherapistBody;
      if (!body.email) return reply.code(400).send({ error: "Email is required" });
      const normalizedEmail = body.email.trim().toLowerCase();

      const existing = await db
        .select()
        .from(learnerTherapists)
        .where(
          and(
            eq(learnerTherapists.learnerId, learnerId),
            eq(learnerTherapists.therapistEmail, normalizedEmail),
          ),
        );
      if (existing.length > 0) return reply.code(409).send({ error: "Therapist already invited" });

      const existingCount = await db
        .select()
        .from(learnerTherapists)
        .where(eq(learnerTherapists.learnerId, learnerId));
      if (existingCount.length >= 1) {
        return reply.code(400).send({ error: "Maximum 1 therapist allowed per learner" });
      }

      const learnerRows = await db.select().from(learners).where(eq(learners.id, learnerId));
      if (learnerRows.length === 0) return reply.code(404).send({ error: "Learner not found" });
      const tenantId = learnerRows[0].tenantId;

      const existingUser = await findExistingUser(db, normalizedEmail);
      const autoAccept = !!existingUser;

      const [record] = await db
        .insert(learnerTherapists)
        .values({
          tenantId,
          learnerId,
          therapistEmail: normalizedEmail,
          therapistUserId: existingUser?.id ?? null,
          invitedBy: claims.sub,
          specialty: body.specialty || null,
          credentials: body.credentials || null,
          status: autoAccept ? "ACCEPTED" : "PENDING",
          acceptedAt: autoAccept ? new Date() : null,
        })
        .returning();

      const ctx = await loadInviteContext(db, claims.sub, learnerId);
      void sendTeamInviteEmail(app, {
        to: normalizedEmail,
        role: body.specialty || "therapist",
        ...ctx,
      });

      return reply.code(201).send(record);
    },
  );

  app.delete(
    "/api/family/collaboration/:learnerId/member/:memberId",
    { schema: deleteCollaborationByLearnerIdMemberByMemberIdSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId, memberId } = request.params as MemberParams;
      const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
      if (!isParent) return reply.code(403).send({ error: "Only parents can remove team members" });

      const { memberType } = request.query as MemberTypeQuery;

      if (memberType === "teacher") {
        await db
          .delete(learnerTeachers)
          .where(and(eq(learnerTeachers.id, memberId), eq(learnerTeachers.learnerId, learnerId)));
      } else if (memberType === "caregiver") {
        await db
          .delete(learnerCaregivers)
          .where(
            and(eq(learnerCaregivers.id, memberId), eq(learnerCaregivers.learnerId, learnerId)),
          );
      } else if (memberType === "therapist") {
        await db
          .delete(learnerTherapists)
          .where(
            and(eq(learnerTherapists.id, memberId), eq(learnerTherapists.learnerId, learnerId)),
          );
      } else {
        return reply
          .code(400)
          .send({ error: "memberType query param required (teacher|caregiver|therapist)" });
      }

      return { status: "removed" };
    },
  );

  app.post(
    "/api/family/collaboration/:learnerId/insight",
    { schema: collaborationByLearnerIdInsightSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as LearnerId;

      // Track which relationship authorized the insight so the brain
      // builder (Sprint 4) can weight a perspective by its author's role.
      let authorRole = "parent";
      const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
      if (!isParent) {
        const teacherMatch = await db
          .select()
          .from(learnerTeachers)
          .where(
            and(
              eq(learnerTeachers.learnerId, learnerId),
              eq(learnerTeachers.teacherUserId, claims.sub),
              eq(learnerTeachers.status, "ACCEPTED"),
            ),
          );
        const caregiverMatch = await db
          .select()
          .from(learnerCaregivers)
          .where(
            and(
              eq(learnerCaregivers.learnerId, learnerId),
              eq(learnerCaregivers.caregiverUserId, claims.sub),
              eq(learnerCaregivers.status, "ACCEPTED"),
            ),
          );
        const therapistMatch = await db
          .select()
          .from(learnerTherapists)
          .where(
            and(
              eq(learnerTherapists.learnerId, learnerId),
              eq(learnerTherapists.therapistUserId, claims.sub),
              eq(learnerTherapists.status, "ACCEPTED"),
            ),
          );

        if (
          teacherMatch.length === 0 &&
          caregiverMatch.length === 0 &&
          therapistMatch.length === 0 &&
          claims.role !== "PLATFORM_ADMIN"
        ) {
          return reply
            .code(403)
            .send({ error: "You must be a parent or accepted team member to submit insights" });
        }
        authorRole =
          teacherMatch.length > 0
            ? "teacher"
            : caregiverMatch.length > 0
              ? "caregiver"
              : therapistMatch.length > 0
                ? "therapist"
                : (claims.role?.toLowerCase() ?? "collaborator");
      }

      const body = request.body as InsightBody;
      if (!body.insightText) return reply.code(400).send({ error: "insightText is required" });

      // Stamp the tenant from the learner row so the insight is tenant-scoped
      // (Sprint 2) — the learner already passed the ownership/member check.
      const [learnerRow] = await db
        .select({ tenantId: learners.tenantId })
        .from(learners)
        .where(eq(learners.id, learnerId))
        .limit(1);

      const [record] = await db
        .insert(brainInsights)
        .values({
          learnerId,
          tenantId: learnerRow?.tenantId ?? null,
          source: body.source || authorRole,
          sourceUserId: claims.sub,
          authorRole,
          insightText: body.insightText,
          domain: body.domain || null,
        })
        .returning();

      return reply.code(201).send(record);
    },
  );

  app.get(
    "/api/family/collaboration/:learnerId/brain/teacher",
    { schema: getCollaborationByLearnerIdBrainTeacherSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as LearnerId;

      const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
      const teacherMatch = await db
        .select()
        .from(learnerTeachers)
        .where(
          and(
            eq(learnerTeachers.learnerId, learnerId),
            eq(learnerTeachers.teacherUserId, claims.sub),
            eq(learnerTeachers.status, "ACCEPTED"),
          ),
        );

      if (!isParent && teacherMatch.length === 0 && claims.role !== "PLATFORM_ADMIN") {
        return reply.code(403).send({ error: "Access denied — teacher or parent role required" });
      }

      const brain = await db.select().from(brainStates).where(eq(brainStates.learnerId, learnerId));
      if (brain.length === 0) return { brainState: null };

      const state = brain[0];
      return {
        brainState: {
          masteryLevels: state.masteryLevels,
          activeAccommodations: state.activeAccommodations,
          curriculumAlignment: state.curriculumAlignment,
          activeTutors: state.activeTutors,
          version: state.version,
        },
        readOnly: true,
      };
    },
  );

  app.get(
    "/api/family/collaboration/:learnerId/brain/caregiver",
    { schema: getCollaborationByLearnerIdBrainCaregiverSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as LearnerId;

      const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
      const caregiverMatch = await db
        .select()
        .from(learnerCaregivers)
        .where(
          and(
            eq(learnerCaregivers.learnerId, learnerId),
            eq(learnerCaregivers.caregiverUserId, claims.sub),
            eq(learnerCaregivers.status, "ACCEPTED"),
          ),
        );

      if (!isParent && caregiverMatch.length === 0 && claims.role !== "PLATFORM_ADMIN") {
        return reply.code(403).send({ error: "Access denied — caregiver or parent role required" });
      }

      const brain = await db.select().from(brainStates).where(eq(brainStates.learnerId, learnerId));
      if (brain.length === 0) return { summary: null };

      const state = brain[0];
      const mastery = (state.masteryLevels as Record<string, unknown>) || {};
      const subjects = Object.keys(mastery);
      const avgMastery =
        subjects.length > 0
          ? Math.round(
              subjects.reduce((sum, s) => {
                const val = mastery[s];
                return sum + (typeof val === "number" ? val : 0);
              }, 0) / subjects.length,
            )
          : 0;

      return {
        summary: {
          overallMastery: avgMastery,
          subjectCount: subjects.length,
          activeAccommodationCount: ((state.activeAccommodations as unknown[]) || []).length,
          activeTutorCount: ((state.activeTutors as unknown[]) || []).length,
        },
        readOnly: true,
      };
    },
  );

  app.get(
    "/api/family/collaboration/:learnerId/brain/therapist",
    { schema: getCollaborationByLearnerIdBrainTherapistSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as LearnerId;

      const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
      const therapistMatch = await db
        .select()
        .from(learnerTherapists)
        .where(
          and(
            eq(learnerTherapists.learnerId, learnerId),
            eq(learnerTherapists.therapistUserId, claims.sub),
            eq(learnerTherapists.status, "ACCEPTED"),
          ),
        );

      if (!isParent && therapistMatch.length === 0 && claims.role !== "PLATFORM_ADMIN") {
        return reply.code(403).send({ error: "Access denied — therapist or parent role required" });
      }

      const brain = await db.select().from(brainStates).where(eq(brainStates.learnerId, learnerId));
      const goals = await db.select().from(iepGoals).where(eq(iepGoals.learnerId, learnerId));
      const tGoals = await db
        .select()
        .from(therapyGoals)
        .where(eq(therapyGoals.learnerId, learnerId));

      const state = brain[0] || null;

      return {
        brainState: state
          ? {
              functioningLevelProfile: state.functioningLevelProfile,
              iepProfile: state.iepProfile,
              sensoryProfile: state.sensoryProfile,
              activeAccommodations: state.activeAccommodations,
              disabilitySignals: state.disabilitySignals,
              version: state.version,
            }
          : null,
        iepGoals: goals,
        therapyGoals: tGoals,
        hipaaScoped: true,
        readOnly: true,
      };
    },
  );

  app.get(
    "/api/family/collaboration/connected-learners",
    { schema: getCollaborationConnectedLearnersSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const userId = claims.sub;

      const teacherRows = await db
        .select({
          learnerId: learnerTeachers.learnerId,
        })
        .from(learnerTeachers)
        .where(
          and(eq(learnerTeachers.status, "ACCEPTED"), eq(learnerTeachers.teacherUserId, userId)),
        );

      const caregiverRows = await db
        .select({
          learnerId: learnerCaregivers.learnerId,
        })
        .from(learnerCaregivers)
        .where(
          and(
            eq(learnerCaregivers.status, "ACCEPTED"),
            eq(learnerCaregivers.caregiverUserId, userId),
          ),
        );

      const therapistRows = await db
        .select({
          learnerId: learnerTherapists.learnerId,
        })
        .from(learnerTherapists)
        .where(
          and(
            eq(learnerTherapists.status, "ACCEPTED"),
            eq(learnerTherapists.therapistUserId, userId),
          ),
        );

      const learnerIds = new Set<string>();
      for (const r of [...teacherRows, ...caregiverRows, ...therapistRows]) {
        learnerIds.add(r.learnerId);
      }

      if (learnerIds.size === 0) return [];

      interface ConnectedLearnerDto {
        id: string;
        name: string;
        functioningLevel: string | null;
        gradeLevel: string | null;
      }

      const results: ConnectedLearnerDto[] = [];
      for (const lid of learnerIds) {
        const [learner] = await db.select().from(learners).where(eq(learners.id, lid));
        if (learner) {
          results.push({
            id: learner.id,
            name: learner.name,
            functioningLevel: learner.functioningLevel,
            gradeLevel: learner.gradeLevel,
          });
        }
      }

      return results;
    },
  );

  app.post(
    "/api/family/collaboration/accept-invite",
    { schema: collaborationAcceptInviteSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const userEmail = (claims.email || "").trim().toLowerCase();
      if (!userEmail) return reply.code(400).send({ error: "User email not found in token" });

      const accepted: { role: string; learnerId: string }[] = [];
      const now = new Date();

      const pendingTeacher = await db
        .select()
        .from(learnerTeachers)
        .where(
          and(eq(learnerTeachers.teacherEmail, userEmail), eq(learnerTeachers.status, "PENDING")),
        );
      for (const row of pendingTeacher) {
        await db
          .update(learnerTeachers)
          .set({
            teacherUserId: claims.sub,
            status: "ACCEPTED",
            acceptedAt: now,
          })
          .where(eq(learnerTeachers.id, row.id));
        accepted.push({ role: "teacher", learnerId: row.learnerId });
      }

      const pendingCaregiver = await db
        .select()
        .from(learnerCaregivers)
        .where(
          and(
            eq(learnerCaregivers.caregiverEmail, userEmail),
            eq(learnerCaregivers.status, "PENDING"),
          ),
        );
      for (const row of pendingCaregiver) {
        await db
          .update(learnerCaregivers)
          .set({
            caregiverUserId: claims.sub,
            status: "ACCEPTED",
            acceptedAt: now,
          })
          .where(eq(learnerCaregivers.id, row.id));
        accepted.push({ role: "caregiver", learnerId: row.learnerId });
      }

      const pendingTherapist = await db
        .select()
        .from(learnerTherapists)
        .where(
          and(
            eq(learnerTherapists.therapistEmail, userEmail),
            eq(learnerTherapists.status, "PENDING"),
          ),
        );
      for (const row of pendingTherapist) {
        await db
          .update(learnerTherapists)
          .set({
            therapistUserId: claims.sub,
            status: "ACCEPTED",
            acceptedAt: now,
          })
          .where(eq(learnerTherapists.id, row.id));
        accepted.push({ role: "therapist", learnerId: row.learnerId });
      }

      // Sprint 3 (invite-flows): teacher → parent invites. We only accept
      // when the signed-in user is actually the parent on the learner row
      // — the teacher cannot reassign a learner to a different parent.
      // When the invite matches, we also create the inverse learner_teachers
      // ACCEPTED row so the teacher's roster picks the learner up. Sprint 4
      // sets classroom_id when the teacher also runs a classroom the
      // learner is enrolled in.
      const pendingTeacherParent = await db
        .select()
        .from(teacherParentInvites)
        .where(
          and(
            eq(teacherParentInvites.parentEmail, userEmail),
            eq(teacherParentInvites.status, "PENDING"),
          ),
        );
      for (const row of pendingTeacherParent) {
        if (row.expiresAt && row.expiresAt < now) {
          await db
            .update(teacherParentInvites)
            .set({ status: "EXPIRED" })
            .where(eq(teacherParentInvites.id, row.id));
          continue;
        }
        const [learnerRow] = await db
          .select({
            id: learners.id,
            parentId: learners.parentId,
            tenantId: learners.tenantId,
          })
          .from(learners)
          .where(eq(learners.id, row.learnerId))
          .limit(1);
        if (!learnerRow) {
          await db
            .update(teacherParentInvites)
            .set({ status: "REVOKED", revokedAt: now })
            .where(eq(teacherParentInvites.id, row.id));
          continue;
        }
        if (learnerRow.parentId !== claims.sub) {
          // Signed-in user is not the learner's parent — skip silently,
          // leave the invite PENDING so the right parent can still accept.
          continue;
        }

        // Sprint 4: if this teacher runs a classroom that has the learner
        // enrolled, record the classroom on the new learner_teachers row.
        let classroomId: string | null = row.classroomId ?? null;
        if (!classroomId) {
          const [match] = await db
            .select({ id: classrooms.id })
            .from(classrooms)
            .innerJoin(
              classroomEnrollments,
              and(
                eq(classroomEnrollments.classroomId, classrooms.id),
                eq(classroomEnrollments.learnerId, row.learnerId),
                isNull(classroomEnrollments.removedAt),
              ),
            )
            .where(eq(classrooms.teacherId, row.teacherUserId))
            .limit(1);
          classroomId = match?.id ?? null;
        }

        // Look up the teacher's email to seed learner_teachers.
        const [teacherUser] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, row.teacherUserId))
          .limit(1);

        const [existingLink] = await db
          .select({ id: learnerTeachers.id, status: learnerTeachers.status })
          .from(learnerTeachers)
          .where(
            and(
              eq(learnerTeachers.learnerId, row.learnerId),
              eq(learnerTeachers.teacherUserId, row.teacherUserId),
            ),
          )
          .limit(1);
        if (existingLink) {
          await db
            .update(learnerTeachers)
            .set({
              status: "ACCEPTED",
              acceptedAt: now,
              classroomId,
              updatedAt: now,
            })
            .where(eq(learnerTeachers.id, existingLink.id));
        } else {
          await db.insert(learnerTeachers).values({
            tenantId: learnerRow.tenantId,
            learnerId: row.learnerId,
            teacherEmail: (teacherUser?.email || "").toLowerCase() || "unknown@aivo.local",
            teacherUserId: row.teacherUserId,
            invitedBy: row.teacherUserId,
            status: "ACCEPTED",
            classroomId,
            acceptedAt: now,
          } as any);
        }

        await db
          .update(teacherParentInvites)
          .set({ status: "ACCEPTED", acceptedAt: now, acceptedUserId: claims.sub })
          .where(eq(teacherParentInvites.id, row.id));
        accepted.push({ role: "teacher_parent", learnerId: row.learnerId });
      }

      return { accepted, count: accepted.length };
    },
  );

  app.get(
    "/api/family/collaboration/pending-invites",
    { schema: getCollaborationPendingInvitesSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const userEmail = claims.email;
      if (!userEmail) return reply.code(400).send({ error: "User email not found in token" });

      const teachers = await db
        .select()
        .from(learnerTeachers)
        .where(
          and(eq(learnerTeachers.teacherEmail, userEmail), eq(learnerTeachers.status, "PENDING")),
        );
      const caregivers = await db
        .select()
        .from(learnerCaregivers)
        .where(
          and(
            eq(learnerCaregivers.caregiverEmail, userEmail),
            eq(learnerCaregivers.status, "PENDING"),
          ),
        );
      const therapists = await db
        .select()
        .from(learnerTherapists)
        .where(
          and(
            eq(learnerTherapists.therapistEmail, userEmail),
            eq(learnerTherapists.status, "PENDING"),
          ),
        );

      const pendingInvites = [
        ...teachers.map((t) => ({
          role: "teacher",
          learnerId: t.learnerId,
          invitedAt: t.createdAt,
        })),
        ...caregivers.map((c) => ({
          role: "caregiver",
          learnerId: c.learnerId,
          invitedAt: c.createdAt,
        })),
        ...therapists.map((t) => ({
          role: "therapist",
          learnerId: t.learnerId,
          invitedAt: t.createdAt,
        })),
      ];

      return { invites: pendingInvites };
    },
  );

  // ─── Sprint 5 (invite-flows): unified resend / revoke ───────────────
  //
  // The dedicated invite-parent/:id/{resend,revoke} endpoints from Sprint 3
  // remain for backwards compatibility, but these generic endpoints work
  // across all four kinds so the UI doesn't have to pick a URL based on
  // the invite type.
  app.post(
    "/api/family/collaboration/invites/:kind/:id/resend",
    { schema: collaborationInviteResendSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;
      const { kind, id } = request.params as { kind: string; id: string };

      const rl = checkInviteRateLimit(claims.sub);
      if (!rl.ok) {
        return reply
          .code(429)
          .header("Retry-After", Math.ceil(rl.retryAfterMs / 1000))
          .send({
            error: `Invite rate limit exceeded (${rl.window}). Try again later.`,
          });
      }

      if (kind === "teacher" || kind === "caregiver" || kind === "therapist") {
        const table =
          kind === "teacher"
            ? learnerTeachers
            : kind === "caregiver"
              ? learnerCaregivers
              : learnerTherapists;

        const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
        if (!row) return reply.code(404).send({ error: "Invite not found" });

        const isParent = await verifyParentOwnership(db, claims.sub, row.learnerId);
        if (!isParent && claims.role !== "PLATFORM_ADMIN") {
          return reply.code(403).send({ error: "Not authorized to resend this invite" });
        }
        if (row.status === "ACCEPTED")
          return reply.code(400).send({ error: "Invite already accepted" });
        if (row.status === "REVOKED") return reply.code(400).send({ error: "Invite was revoked" });

        await db
          .update(table)
          .set({ status: "PENDING", invitedAt: new Date(), updatedAt: new Date() } as any)
          .where(eq(table.id, id));

        const inviteEmail =
          kind === "teacher"
            ? (row as any).teacherEmail
            : kind === "caregiver"
              ? (row as any).caregiverEmail
              : (row as any).therapistEmail;
        const ctx = await loadInviteContext(db, claims.sub, row.learnerId);
        void sendTeamInviteEmail(app, {
          to: inviteEmail,
          role: kind,
          ...ctx,
        });
        return { success: true };
      }

      if (kind === "teacher_parent") {
        const [row] = await db
          .select()
          .from(teacherParentInvites)
          .where(eq(teacherParentInvites.id, id))
          .limit(1);
        if (!row) return reply.code(404).send({ error: "Invite not found" });
        if (
          row.teacherUserId !== claims.sub &&
          !["SCHOOL_ADMIN", "DISTRICT_ADMIN", "PLATFORM_ADMIN"].includes(claims.role)
        ) {
          return reply.code(403).send({ error: "Not authorized to resend this invite" });
        }
        if (row.status === "ACCEPTED")
          return reply.code(400).send({ error: "Invite already accepted" });
        if (row.status === "REVOKED") return reply.code(400).send({ error: "Invite was revoked" });

        const rawToken = crypto.randomBytes(32).toString("base64url");
        const tokenHash = hashInviteToken(rawToken);
        const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);
        await db
          .update(teacherParentInvites)
          .set({ tokenHash, expiresAt, status: "PENDING" })
          .where(eq(teacherParentInvites.id, id));

        const [learner] = await db
          .select({ name: learners.name, schoolId: learners.schoolId })
          .from(learners)
          .where(eq(learners.id, row.learnerId))
          .limit(1);
        const [teacher] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, row.teacherUserId))
          .limit(1);
        let schoolName: string | undefined;
        if (learner?.schoolId) {
          const [s] = await db
            .select({ name: schools.name })
            .from(schools)
            .where(eq(schools.id, learner.schoolId))
            .limit(1);
          schoolName = s?.name;
        }
        void sendTeacherParentInviteEmail(app, {
          to: row.parentEmail,
          teacherName: teacher?.name || "Your child's teacher",
          schoolName: schoolName || "the school",
          childName: learner?.name || "your child",
          notes: row.notes,
          token: rawToken,
        });
        return { success: true, expiresAt };
      }

      return reply
        .code(400)
        .send({ error: "kind must be teacher | caregiver | therapist | teacher_parent" });
    },
  );

  app.delete(
    "/api/family/collaboration/invites/:kind/:id",
    { schema: collaborationInviteRevokeSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;
      const { kind, id } = request.params as { kind: string; id: string };

      if (kind === "teacher" || kind === "caregiver" || kind === "therapist") {
        const table =
          kind === "teacher"
            ? learnerTeachers
            : kind === "caregiver"
              ? learnerCaregivers
              : learnerTherapists;
        const [row] = await db.select().from(table).where(eq(table.id, id)).limit(1);
        if (!row) return reply.code(404).send({ error: "Invite not found" });
        const isParent = await verifyParentOwnership(db, claims.sub, row.learnerId);
        if (!isParent && claims.role !== "PLATFORM_ADMIN") {
          return reply.code(403).send({ error: "Not authorized to revoke this invite" });
        }
        if (row.status === "ACCEPTED")
          return reply.code(400).send({ error: "Cannot revoke an accepted invite" });
        await db
          .update(table)
          .set({ status: "REVOKED", updatedAt: new Date() } as any)
          .where(eq(table.id, id));
        return { success: true };
      }

      if (kind === "teacher_parent") {
        const [row] = await db
          .select()
          .from(teacherParentInvites)
          .where(eq(teacherParentInvites.id, id))
          .limit(1);
        if (!row) return reply.code(404).send({ error: "Invite not found" });
        if (
          row.teacherUserId !== claims.sub &&
          !["SCHOOL_ADMIN", "DISTRICT_ADMIN", "PLATFORM_ADMIN"].includes(claims.role)
        ) {
          return reply.code(403).send({ error: "Not authorized to revoke this invite" });
        }
        if (row.status === "ACCEPTED")
          return reply.code(400).send({ error: "Cannot revoke an accepted invite" });
        await db
          .update(teacherParentInvites)
          .set({ status: "REVOKED", revokedAt: new Date() })
          .where(eq(teacherParentInvites.id, id));
        return { success: true };
      }

      return reply
        .code(400)
        .send({ error: "kind must be teacher | caregiver | therapist | teacher_parent" });
    },
  );

  // ─── Sprint 3 (invite-flows): teacher → parent invites ──────────────

  // POST /api/family/collaboration/invite-parent
  // Auth: TEACHER (the teacher inviting their student's parent). The
  // teacher must run a classroom that has the learner enrolled OR
  // already have a learner_teachers link to that learner. SCHOOL_ADMIN
  // and DISTRICT_ADMIN can also issue invites on behalf of staff in
  // their scope.
  app.post(
    "/api/family/collaboration/invite-parent",
    { schema: collaborationInviteParentSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const role = claims.role;
      const isStaff = role === "TEACHER" || role === "SCHOOL_ADMIN" || role === "DISTRICT_ADMIN";
      if (!isStaff && role !== "PLATFORM_ADMIN") {
        return reply.code(403).send({ error: "Only teachers and school staff can invite parents" });
      }

      const body = (request.body || {}) as {
        learnerId?: string;
        parentEmail?: string;
        notes?: string;
        teacherUserId?: string;
      };
      if (!body.learnerId || !body.parentEmail) {
        return reply.code(400).send({ error: "learnerId and parentEmail are required" });
      }
      const parentEmail = body.parentEmail.trim().toLowerCase();
      const learnerId = body.learnerId;

      // When an admin invites on behalf of a teacher they must pass the
      // teacher's user id; for a teacher caller it's their own sub.
      const teacherUserId = role === "TEACHER" ? claims.sub : body.teacherUserId || claims.sub;
      if (!teacherUserId) {
        return reply.code(400).send({ error: "teacherUserId required" });
      }

      const rl = checkInviteRateLimit(claims.sub);
      if (!rl.ok) {
        return reply
          .code(429)
          .header("Retry-After", Math.ceil(rl.retryAfterMs / 1000))
          .send({
            error: `Invite rate limit exceeded (${rl.window}). Try again later.`,
          });
      }

      const [learner] = await db
        .select({
          id: learners.id,
          name: learners.name,
          tenantId: learners.tenantId,
          parentId: learners.parentId,
          schoolId: learners.schoolId,
        })
        .from(learners)
        .where(eq(learners.id, learnerId))
        .limit(1);
      if (!learner) return reply.code(404).send({ error: "Learner not found" });

      // Authorize. TEACHER must be linked to the learner via a classroom
      // they teach OR an accepted learner_teachers row (checked below).
      // SCHOOL_ADMIN / DISTRICT_ADMIN are scoped to their own tenant: they
      // may act on any learner in that tenant but never across tenants.
      // PLATFORM_ADMIN is global and bypasses the scope check.
      if (role === "SCHOOL_ADMIN" || role === "DISTRICT_ADMIN") {
        if (!claims.tenantId || learner.tenantId !== claims.tenantId) {
          return reply.code(403).send({ error: "Learner is outside your administrative scope" });
        }
      }

      let classroomId: string | null = null;
      if (role === "TEACHER") {
        const [enrolledClassroom] = await db
          .select({ id: classrooms.id })
          .from(classrooms)
          .innerJoin(
            classroomEnrollments,
            and(
              eq(classroomEnrollments.classroomId, classrooms.id),
              eq(classroomEnrollments.learnerId, learnerId),
              isNull(classroomEnrollments.removedAt),
            ),
          )
          .where(eq(classrooms.teacherId, teacherUserId))
          .limit(1);
        if (enrolledClassroom) {
          classroomId = enrolledClassroom.id;
        } else {
          const [link] = await db
            .select({ id: learnerTeachers.id })
            .from(learnerTeachers)
            .where(
              and(
                eq(learnerTeachers.learnerId, learnerId),
                eq(learnerTeachers.teacherUserId, teacherUserId),
                eq(learnerTeachers.status, "ACCEPTED"),
              ),
            )
            .limit(1);
          if (!link) {
            return reply.code(403).send({ error: "Teacher is not assigned to this learner" });
          }
        }
      }

      // Reject duplicates: outstanding invite or the parent already owns
      // the learner.
      const [openInvite] = await db
        .select({ id: teacherParentInvites.id })
        .from(teacherParentInvites)
        .where(
          and(
            eq(teacherParentInvites.learnerId, learnerId),
            eq(teacherParentInvites.parentEmail, parentEmail),
            eq(teacherParentInvites.status, "PENDING"),
          ),
        )
        .limit(1);
      if (openInvite) {
        return reply
          .code(409)
          .send({ error: "An invite is already pending for this parent and learner" });
      }

      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashInviteToken(rawToken);
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);

      // Best-effort child name split for the email body.
      const parts = (learner.name || "").trim().split(/\s+/);
      const childFirstName = parts[0] || learner.name || null;
      const childLastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

      const [invite] = await db
        .insert(teacherParentInvites)
        .values({
          tenantId: learner.tenantId,
          teacherUserId,
          classroomId,
          learnerId,
          parentEmail,
          childFirstName,
          childLastName,
          notes: body.notes ?? null,
          tokenHash,
          expiresAt,
        } as any)
        .returning();

      // Resolve teacher + school names for the email.
      const [teacher] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, teacherUserId))
        .limit(1);
      let schoolName: string | undefined;
      if (learner.schoolId) {
        const [school] = await db
          .select({ name: schools.name })
          .from(schools)
          .where(eq(schools.id, learner.schoolId))
          .limit(1);
        schoolName = school?.name;
      }

      void sendTeacherParentInviteEmail(app, {
        to: parentEmail,
        teacherName: teacher?.name || "Your child's teacher",
        schoolName: schoolName || "the school",
        childName: learner.name || "your child",
        notes: body.notes ?? null,
        token: rawToken,
      });

      return reply.code(201).send({
        invite: {
          id: invite.id,
          learnerId: invite.learnerId,
          parentEmail: invite.parentEmail,
          status: invite.status,
          expiresAt: invite.expiresAt,
          classroomId: invite.classroomId,
        },
      });
    },
  );

  // POST /api/family/collaboration/invite-parent/:id/resend
  // Rotates the token and resends the email. Returns 400 if accepted or
  // revoked.
  app.post(
    "/api/family/collaboration/invite-parent/:id/resend",
    { schema: collaborationInviteParentResendSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;
      const { id } = request.params as { id: string };

      const [invite] = await db
        .select()
        .from(teacherParentInvites)
        .where(eq(teacherParentInvites.id, id))
        .limit(1);
      if (!invite) return reply.code(404).send({ error: "Invite not found" });

      // Only the inviting teacher (or an admin) can resend.
      if (
        invite.teacherUserId !== claims.sub &&
        !["SCHOOL_ADMIN", "DISTRICT_ADMIN", "PLATFORM_ADMIN"].includes(claims.role)
      ) {
        return reply.code(403).send({ error: "Not authorized to resend this invite" });
      }
      if (invite.status === "ACCEPTED")
        return reply.code(400).send({ error: "Invite already accepted" });
      if (invite.status === "REVOKED") return reply.code(400).send({ error: "Invite was revoked" });

      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashInviteToken(rawToken);
      const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000);
      await db
        .update(teacherParentInvites)
        .set({ tokenHash, expiresAt, status: "PENDING" })
        .where(eq(teacherParentInvites.id, id));

      const [learner] = await db
        .select({ name: learners.name, schoolId: learners.schoolId })
        .from(learners)
        .where(eq(learners.id, invite.learnerId))
        .limit(1);
      const [teacher] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, invite.teacherUserId))
        .limit(1);
      let schoolName: string | undefined;
      if (learner?.schoolId) {
        const [s] = await db
          .select({ name: schools.name })
          .from(schools)
          .where(eq(schools.id, learner.schoolId))
          .limit(1);
        schoolName = s?.name;
      }

      void sendTeacherParentInviteEmail(app, {
        to: invite.parentEmail,
        teacherName: teacher?.name || "Your child's teacher",
        schoolName: schoolName || "the school",
        childName: learner?.name || "your child",
        notes: invite.notes,
        token: rawToken,
      });

      return { success: true, expiresAt };
    },
  );

  // DELETE /api/family/collaboration/invite-parent/:id  — revoke.
  app.delete(
    "/api/family/collaboration/invite-parent/:id",
    { schema: collaborationInviteParentRevokeSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;
      const { id } = request.params as { id: string };

      const [invite] = await db
        .select()
        .from(teacherParentInvites)
        .where(eq(teacherParentInvites.id, id))
        .limit(1);
      if (!invite) return reply.code(404).send({ error: "Invite not found" });
      if (
        invite.teacherUserId !== claims.sub &&
        !["SCHOOL_ADMIN", "DISTRICT_ADMIN", "PLATFORM_ADMIN"].includes(claims.role)
      ) {
        return reply.code(403).send({ error: "Not authorized to revoke this invite" });
      }
      if (invite.status === "ACCEPTED")
        return reply.code(400).send({ error: "Cannot revoke an accepted invite" });

      await db
        .update(teacherParentInvites)
        .set({ status: "REVOKED", revokedAt: new Date() })
        .where(eq(teacherParentInvites.id, id));
      return { success: true };
    },
  );

  // GET /api/family/collaboration/invite-parent — list the calling
  // teacher's outgoing invites (PENDING + ACCEPTED + REVOKED).
  app.get(
    "/api/family/collaboration/invite-parent",
    { schema: getCollaborationInviteParentByTeacherSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;
      if (claims.role !== "TEACHER" && claims.role !== "PLATFORM_ADMIN") {
        return reply.code(403).send({ error: "Teacher access required" });
      }
      const rows = await db
        .select({
          id: teacherParentInvites.id,
          learnerId: teacherParentInvites.learnerId,
          parentEmail: teacherParentInvites.parentEmail,
          status: teacherParentInvites.status,
          expiresAt: teacherParentInvites.expiresAt,
          createdAt: teacherParentInvites.createdAt,
          acceptedAt: teacherParentInvites.acceptedAt,
          classroomId: teacherParentInvites.classroomId,
        })
        .from(teacherParentInvites)
        .where(eq(teacherParentInvites.teacherUserId, claims.sub))
        .orderBy(sql`${teacherParentInvites.createdAt} desc`);
      return { invites: rows };
    },
  );

  // ─── Sprint 4 (invite-flows): unified teacher roster ────────────────

  // GET /api/teacher/roster
  // Merges the two paths a teacher reaches a learner through:
  //   1. classroom_enrollments (district roster)
  //   2. learner_teachers ACCEPTED rows (parent invite path)
  // Deduplicated by learnerId. When a learner appears in both, source is
  // "both" and the classroom_name + classroom_id are surfaced.
  app.get("/api/teacher/roster", { schema: getTeacherRosterSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;
    if (claims.role !== "TEACHER" && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Teacher access required" });
    }
    const teacherUserId = claims.sub;

    // Classroom path.
    const classroomRows = await db
      .select({
        learnerId: classroomEnrollments.learnerId,
        classroomId: classrooms.id,
        classroomName: classrooms.name,
        gradeLevel: classrooms.gradeLevel,
        subject: classrooms.subject,
        schoolId: classrooms.schoolId,
      })
      .from(classroomEnrollments)
      .innerJoin(classrooms, eq(classroomEnrollments.classroomId, classrooms.id))
      .where(and(eq(classrooms.teacherId, teacherUserId), isNull(classroomEnrollments.removedAt)));

    // Parent-invite path.
    const inviteRows = await db
      .select({
        learnerId: learnerTeachers.learnerId,
        classroomId: learnerTeachers.classroomId,
      })
      .from(learnerTeachers)
      .where(
        and(
          eq(learnerTeachers.teacherUserId, teacherUserId),
          eq(learnerTeachers.status, "ACCEPTED"),
        ),
      );

    const merged = new Map<
      string,
      {
        learnerId: string;
        source: "classroom" | "parent_invite" | "both";
        classroomId: string | null;
        classroomName: string | null;
      }
    >();
    for (const r of classroomRows) {
      merged.set(r.learnerId, {
        learnerId: r.learnerId,
        source: "classroom",
        classroomId: r.classroomId,
        classroomName: r.classroomName,
      });
    }
    for (const r of inviteRows) {
      const existing = merged.get(r.learnerId);
      if (existing) {
        existing.source = "both";
        if (!existing.classroomId && r.classroomId) {
          existing.classroomId = r.classroomId;
        }
      } else {
        merged.set(r.learnerId, {
          learnerId: r.learnerId,
          source: "parent_invite",
          classroomId: r.classroomId,
          classroomName: null,
        });
      }
    }

    if (merged.size === 0) return [];

    // Hydrate learner + parent display info in one query.
    const learnerIds = Array.from(merged.keys());
    const learnerRows = await db
      .select({
        id: learners.id,
        name: learners.name,
        gradeLevel: learners.gradeLevel,
        functioningLevel: learners.functioningLevel,
        parentId: learners.parentId,
      })
      .from(learners)
      .where(inArray(learners.id, learnerIds));
    const parentIds = Array.from(new Set(learnerRows.map((l) => l.parentId).filter(Boolean)));
    const parentRows =
      parentIds.length > 0
        ? await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, parentIds as string[]))
        : [];
    const parentById = new Map(parentRows.map((p) => [p.id, p]));

    return learnerRows.map((l) => {
      const m = merged.get(l.id)!;
      const parent = parentById.get(l.parentId);
      return {
        learnerId: l.id,
        learnerName: l.name,
        gradeLevel: l.gradeLevel,
        functioningLevel: l.functioningLevel,
        source: m.source,
        classroomId: m.classroomId,
        classroomName: m.classroomName,
        parentName: parent?.name ?? null,
        parentEmail: parent?.email ?? null,
      };
    });
  });
}

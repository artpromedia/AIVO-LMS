import { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  learnerTeachers,
  learnerCaregivers,
  learnerTherapists,
  learners,
  users,
  brainInsights,
  brainStates,
  iepGoals,
  therapyGoals,
} from "@aivo/db";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import { getCollaborationByLearnerIdMembersSchema, collaborationByLearnerIdInviteTeacherSchema, collaborationByLearnerIdInviteCaregiverSchema, collaborationByLearnerIdInviteTherapistSchema, deleteCollaborationByLearnerIdMemberByMemberIdSchema, collaborationByLearnerIdInsightSchema, getCollaborationByLearnerIdBrainTeacherSchema, getCollaborationByLearnerIdBrainCaregiverSchema, getCollaborationByLearnerIdBrainTherapistSchema, getCollaborationConnectedLearnersSchema, collaborationAcceptInviteSchema, getCollaborationPendingInvitesSchema } from "./schemas.js";

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`family-svc: ${name} must be set in production`);
  return devDefault;
}
const COMMS_URL = requireUrl("COMMS_SVC_URL", "http://localhost:3010");
const APP_URL = requireUrl("APP_URL", "http://localhost:5000");
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY
  || (IS_PROD ? "" : "aivo-internal-dev-key");

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
      app.log.warn({ to: payload.to, role: payload.role, status: res.status },
        "team-invite email dispatch returned non-2xx");
    }
  } catch (err: any) {
    app.log.warn({ to: payload.to, err: err?.message },
      "team-invite email dispatch failed");
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
    const [inviter] = await db.select({ name: users.name })
      .from(users).where(eq(users.id, inviterId)).limit(1);
    const [learner] = await db.select({ name: learners.name })
      .from(learners).where(eq(learners.id, learnerId)).limit(1);
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
    const [u] = await db.select({ id: users.id })
      .from(users).where(eq(users.email, emailLower)).limit(1);
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

  app.get("/api/family/collaboration/:learnerId/members", { schema: getCollaborationByLearnerIdMembersSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as LearnerId;
    const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
    if (!isParent && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Access denied" });
    }

    const teachers = await db.select().from(learnerTeachers).where(eq(learnerTeachers.learnerId, learnerId));
    const caregivers = await db.select().from(learnerCaregivers).where(eq(learnerCaregivers.learnerId, learnerId));
    const therapists = await db.select().from(learnerTherapists).where(eq(learnerTherapists.learnerId, learnerId));

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
  });

  app.post("/api/family/collaboration/:learnerId/invite/teacher", { schema: collaborationByLearnerIdInviteTeacherSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as LearnerId;
    const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
    if (!isParent) return reply.code(403).send({ error: "Only parents can invite team members" });

    const body = request.body as InviteTeacherBody;
    if (!body.email) return reply.code(400).send({ error: "Email is required" });
    const normalizedEmail = body.email.trim().toLowerCase();

    const existing = await db.select().from(learnerTeachers).where(
      and(eq(learnerTeachers.learnerId, learnerId), eq(learnerTeachers.teacherEmail, normalizedEmail))
    );
    if (existing.length > 0) return reply.code(409).send({ error: "Teacher already invited" });

    const existingCount = await db.select().from(learnerTeachers).where(eq(learnerTeachers.learnerId, learnerId));
    if (existingCount.length >= 1) {
      return reply.code(400).send({ error: "B2C plan allows 1 teacher slot. Upgrade for more." });
    }

    const learnerRows = await db.select().from(learners).where(eq(learners.id, learnerId));
    if (learnerRows.length === 0) return reply.code(404).send({ error: "Learner not found" });
    const tenantId = learnerRows[0].tenantId;

    const existingUser = await findExistingUser(db, normalizedEmail);
    const autoAccept = !!existingUser;

    const [record] = await db.insert(learnerTeachers).values({
      tenantId,
      learnerId,
      teacherEmail: normalizedEmail,
      teacherUserId: existingUser?.id ?? null,
      invitedBy: claims.sub,
      status: autoAccept ? "ACCEPTED" : "PENDING",
      acceptedAt: autoAccept ? new Date() : null,
    }).returning();

    const ctx = await loadInviteContext(db, claims.sub, learnerId);
    void sendTeamInviteEmail(app, { to: normalizedEmail, role: "teacher", ...ctx });

    return reply.code(201).send(record);
  });

  app.post("/api/family/collaboration/:learnerId/invite/caregiver", { schema: collaborationByLearnerIdInviteCaregiverSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as LearnerId;
    const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
    if (!isParent) return reply.code(403).send({ error: "Only parents can invite team members" });

    const body = request.body as InviteCaregiverBody;
    if (!body.email) return reply.code(400).send({ error: "Email is required" });
    const normalizedEmail = body.email.trim().toLowerCase();

    const existing = await db.select().from(learnerCaregivers).where(
      and(eq(learnerCaregivers.learnerId, learnerId), eq(learnerCaregivers.caregiverEmail, normalizedEmail))
    );
    if (existing.length > 0) return reply.code(409).send({ error: "Caregiver already invited" });

    const existingCount = await db.select().from(learnerCaregivers).where(eq(learnerCaregivers.learnerId, learnerId));
    if (existingCount.length >= 2) {
      return reply.code(400).send({ error: "Maximum 2 caregivers allowed" });
    }

    const learnerRows = await db.select().from(learners).where(eq(learners.id, learnerId));
    if (learnerRows.length === 0) return reply.code(404).send({ error: "Learner not found" });
    const tenantId = learnerRows[0].tenantId;

    const existingUser = await findExistingUser(db, normalizedEmail);
    const autoAccept = !!existingUser;

    const [record] = await db.insert(learnerCaregivers).values({
      tenantId,
      learnerId,
      caregiverEmail: normalizedEmail,
      caregiverUserId: existingUser?.id ?? null,
      invitedBy: claims.sub,
      relationship: body.relationship || null,
      status: autoAccept ? "ACCEPTED" : "PENDING",
      acceptedAt: autoAccept ? new Date() : null,
    }).returning();

    const ctx = await loadInviteContext(db, claims.sub, learnerId);
    void sendTeamInviteEmail(app, {
      to: normalizedEmail,
      role: body.relationship || "co-parent / caregiver",
      ...ctx,
    });

    return reply.code(201).send(record);
  });

  app.post("/api/family/collaboration/:learnerId/invite/therapist", { schema: collaborationByLearnerIdInviteTherapistSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as LearnerId;
    const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
    if (!isParent) return reply.code(403).send({ error: "Only parents can invite team members" });

    const body = request.body as InviteTherapistBody;
    if (!body.email) return reply.code(400).send({ error: "Email is required" });
    const normalizedEmail = body.email.trim().toLowerCase();

    const existing = await db.select().from(learnerTherapists).where(
      and(eq(learnerTherapists.learnerId, learnerId), eq(learnerTherapists.therapistEmail, normalizedEmail))
    );
    if (existing.length > 0) return reply.code(409).send({ error: "Therapist already invited" });

    const existingCount = await db.select().from(learnerTherapists).where(eq(learnerTherapists.learnerId, learnerId));
    if (existingCount.length >= 1) {
      return reply.code(400).send({ error: "Maximum 1 therapist allowed per learner" });
    }

    const learnerRows = await db.select().from(learners).where(eq(learners.id, learnerId));
    if (learnerRows.length === 0) return reply.code(404).send({ error: "Learner not found" });
    const tenantId = learnerRows[0].tenantId;

    const existingUser = await findExistingUser(db, normalizedEmail);
    const autoAccept = !!existingUser;

    const [record] = await db.insert(learnerTherapists).values({
      tenantId,
      learnerId,
      therapistEmail: normalizedEmail,
      therapistUserId: existingUser?.id ?? null,
      invitedBy: claims.sub,
      specialty: body.specialty || null,
      credentials: body.credentials || null,
      status: autoAccept ? "ACCEPTED" : "PENDING",
      acceptedAt: autoAccept ? new Date() : null,
    }).returning();

    const ctx = await loadInviteContext(db, claims.sub, learnerId);
    void sendTeamInviteEmail(app, {
      to: normalizedEmail,
      role: body.specialty || "therapist",
      ...ctx,
    });

    return reply.code(201).send(record);
  });

  app.delete("/api/family/collaboration/:learnerId/member/:memberId", { schema: deleteCollaborationByLearnerIdMemberByMemberIdSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId, memberId } = request.params as MemberParams;
    const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
    if (!isParent) return reply.code(403).send({ error: "Only parents can remove team members" });

    const { memberType } = request.query as MemberTypeQuery;

    if (memberType === "teacher") {
      await db.delete(learnerTeachers).where(and(eq(learnerTeachers.id, memberId), eq(learnerTeachers.learnerId, learnerId)));
    } else if (memberType === "caregiver") {
      await db.delete(learnerCaregivers).where(and(eq(learnerCaregivers.id, memberId), eq(learnerCaregivers.learnerId, learnerId)));
    } else if (memberType === "therapist") {
      await db.delete(learnerTherapists).where(and(eq(learnerTherapists.id, memberId), eq(learnerTherapists.learnerId, learnerId)));
    } else {
      return reply.code(400).send({ error: "memberType query param required (teacher|caregiver|therapist)" });
    }

    return { status: "removed" };
  });

  app.post("/api/family/collaboration/:learnerId/insight", { schema: collaborationByLearnerIdInsightSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as LearnerId;

    const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
    if (!isParent) {
      const teacherMatch = await db.select().from(learnerTeachers).where(
        and(eq(learnerTeachers.learnerId, learnerId), eq(learnerTeachers.teacherUserId, claims.sub), eq(learnerTeachers.status, "ACCEPTED"))
      );
      const caregiverMatch = await db.select().from(learnerCaregivers).where(
        and(eq(learnerCaregivers.learnerId, learnerId), eq(learnerCaregivers.caregiverUserId, claims.sub), eq(learnerCaregivers.status, "ACCEPTED"))
      );
      const therapistMatch = await db.select().from(learnerTherapists).where(
        and(eq(learnerTherapists.learnerId, learnerId), eq(learnerTherapists.therapistUserId, claims.sub), eq(learnerTherapists.status, "ACCEPTED"))
      );

      if (teacherMatch.length === 0 && caregiverMatch.length === 0 && therapistMatch.length === 0 && claims.role !== "PLATFORM_ADMIN") {
        return reply.code(403).send({ error: "You must be a parent or accepted team member to submit insights" });
      }
    }

    const body = request.body as InsightBody;
    if (!body.insightText) return reply.code(400).send({ error: "insightText is required" });

    const [record] = await db.insert(brainInsights).values({
      learnerId,
      source: body.source || claims.role?.toLowerCase() || "collaborator",
      sourceUserId: claims.sub,
      insightText: body.insightText,
      domain: body.domain || null,
    }).returning();

    return reply.code(201).send(record);
  });

  app.get("/api/family/collaboration/:learnerId/brain/teacher", { schema: getCollaborationByLearnerIdBrainTeacherSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as LearnerId;

    const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
    const teacherMatch = await db.select().from(learnerTeachers).where(
      and(eq(learnerTeachers.learnerId, learnerId), eq(learnerTeachers.teacherUserId, claims.sub), eq(learnerTeachers.status, "ACCEPTED"))
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
  });

  app.get("/api/family/collaboration/:learnerId/brain/caregiver", { schema: getCollaborationByLearnerIdBrainCaregiverSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as LearnerId;

    const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
    const caregiverMatch = await db.select().from(learnerCaregivers).where(
      and(eq(learnerCaregivers.learnerId, learnerId), eq(learnerCaregivers.caregiverUserId, claims.sub), eq(learnerCaregivers.status, "ACCEPTED"))
    );

    if (!isParent && caregiverMatch.length === 0 && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Access denied — caregiver or parent role required" });
    }

    const brain = await db.select().from(brainStates).where(eq(brainStates.learnerId, learnerId));
    if (brain.length === 0) return { summary: null };

    const state = brain[0];
    const mastery = state.masteryLevels as Record<string, unknown> || {};
    const subjects = Object.keys(mastery);
    const avgMastery = subjects.length > 0
      ? Math.round(subjects.reduce((sum, s) => {
          const val = mastery[s];
          return sum + (typeof val === "number" ? val : 0);
        }, 0) / subjects.length)
      : 0;

    return {
      summary: {
        overallMastery: avgMastery,
        subjectCount: subjects.length,
        activeAccommodationCount: (state.activeAccommodations as unknown[] || []).length,
        activeTutorCount: (state.activeTutors as unknown[] || []).length,
      },
      readOnly: true,
    };
  });

  app.get("/api/family/collaboration/:learnerId/brain/therapist", { schema: getCollaborationByLearnerIdBrainTherapistSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as LearnerId;

    const isParent = await verifyParentOwnership(db, claims.sub, learnerId);
    const therapistMatch = await db.select().from(learnerTherapists).where(
      and(eq(learnerTherapists.learnerId, learnerId), eq(learnerTherapists.therapistUserId, claims.sub), eq(learnerTherapists.status, "ACCEPTED"))
    );

    if (!isParent && therapistMatch.length === 0 && claims.role !== "PLATFORM_ADMIN") {
      return reply.code(403).send({ error: "Access denied — therapist or parent role required" });
    }

    const brain = await db.select().from(brainStates).where(eq(brainStates.learnerId, learnerId));
    const goals = await db.select().from(iepGoals).where(eq(iepGoals.learnerId, learnerId));
    const tGoals = await db.select().from(therapyGoals).where(eq(therapyGoals.learnerId, learnerId));

    const state = brain[0] || null;

    return {
      brainState: state ? {
        functioningLevelProfile: state.functioningLevelProfile,
        iepProfile: state.iepProfile,
        sensoryProfile: state.sensoryProfile,
        activeAccommodations: state.activeAccommodations,
        disabilitySignals: state.disabilitySignals,
        version: state.version,
      } : null,
      iepGoals: goals,
      therapyGoals: tGoals,
      hipaaScoped: true,
      readOnly: true,
    };
  });

  app.get("/api/family/collaboration/connected-learners", { schema: getCollaborationConnectedLearnersSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const userId = claims.sub;

    const teacherRows = await db.select({
      learnerId: learnerTeachers.learnerId,
    }).from(learnerTeachers).where(
      and(
        eq(learnerTeachers.status, "ACCEPTED"),
        eq(learnerTeachers.teacherUserId, userId)
      )
    );

    const caregiverRows = await db.select({
      learnerId: learnerCaregivers.learnerId,
    }).from(learnerCaregivers).where(
      and(
        eq(learnerCaregivers.status, "ACCEPTED"),
        eq(learnerCaregivers.caregiverUserId, userId)
      )
    );

    const therapistRows = await db.select({
      learnerId: learnerTherapists.learnerId,
    }).from(learnerTherapists).where(
      and(
        eq(learnerTherapists.status, "ACCEPTED"),
        eq(learnerTherapists.therapistUserId, userId)
      )
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
  });

  app.post("/api/family/collaboration/accept-invite", { schema: collaborationAcceptInviteSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const userEmail = (claims.email || "").trim().toLowerCase();
    if (!userEmail) return reply.code(400).send({ error: "User email not found in token" });

    const accepted: { role: string; learnerId: string }[] = [];
    const now = new Date();

    const pendingTeacher = await db.select().from(learnerTeachers).where(
      and(eq(learnerTeachers.teacherEmail, userEmail), eq(learnerTeachers.status, "PENDING"))
    );
    for (const row of pendingTeacher) {
      await db.update(learnerTeachers).set({
        teacherUserId: claims.sub,
        status: "ACCEPTED",
        acceptedAt: now,
      }).where(eq(learnerTeachers.id, row.id));
      accepted.push({ role: "teacher", learnerId: row.learnerId });
    }

    const pendingCaregiver = await db.select().from(learnerCaregivers).where(
      and(eq(learnerCaregivers.caregiverEmail, userEmail), eq(learnerCaregivers.status, "PENDING"))
    );
    for (const row of pendingCaregiver) {
      await db.update(learnerCaregivers).set({
        caregiverUserId: claims.sub,
        status: "ACCEPTED",
        acceptedAt: now,
      }).where(eq(learnerCaregivers.id, row.id));
      accepted.push({ role: "caregiver", learnerId: row.learnerId });
    }

    const pendingTherapist = await db.select().from(learnerTherapists).where(
      and(eq(learnerTherapists.therapistEmail, userEmail), eq(learnerTherapists.status, "PENDING"))
    );
    for (const row of pendingTherapist) {
      await db.update(learnerTherapists).set({
        therapistUserId: claims.sub,
        status: "ACCEPTED",
        acceptedAt: now,
      }).where(eq(learnerTherapists.id, row.id));
      accepted.push({ role: "therapist", learnerId: row.learnerId });
    }

    return { accepted, count: accepted.length };
  });

  app.get("/api/family/collaboration/pending-invites", { schema: getCollaborationPendingInvitesSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const userEmail = claims.email;
    if (!userEmail) return reply.code(400).send({ error: "User email not found in token" });

    const teachers = await db.select().from(learnerTeachers).where(
      and(eq(learnerTeachers.teacherEmail, userEmail), eq(learnerTeachers.status, "PENDING"))
    );
    const caregivers = await db.select().from(learnerCaregivers).where(
      and(eq(learnerCaregivers.caregiverEmail, userEmail), eq(learnerCaregivers.status, "PENDING"))
    );
    const therapists = await db.select().from(learnerTherapists).where(
      and(eq(learnerTherapists.therapistEmail, userEmail), eq(learnerTherapists.status, "PENDING"))
    );

    const pendingInvites = [
      ...teachers.map(t => ({ role: "teacher", learnerId: t.learnerId, invitedAt: t.createdAt })),
      ...caregivers.map(c => ({ role: "caregiver", learnerId: c.learnerId, invitedAt: c.createdAt })),
      ...therapists.map(t => ({ role: "therapist", learnerId: t.learnerId, invitedAt: t.createdAt })),
    ];

    return { invites: pendingInvites };
  });
}

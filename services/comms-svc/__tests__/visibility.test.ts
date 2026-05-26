/**
 * Sprint 13 — exhaustive boundary tests for the messaging visibility policy.
 *
 * These tests stub family-svc / identity-svc / consent loader so we can
 * exercise the policy as pure logic. Each case maps to a row in the
 * boundary matrix at docs/comms/boundaries.md.
 */
import { test } from "node:test";
import assert from "node:assert";
import {
  canViewThread,
  canPostToThread,
  canCreateThread,
  type MessageThreadRow,
  type PolicyContext,
  type PolicyActor,
} from "../src/policy/visibility.js";
import type { FamilyClient, FamilyRelationships } from "../src/clients/family-client.js";
import type { IdentityClient } from "../src/clients/identity-client.js";

const TENANT = "tenant-1";
const LEARNER_A = "learner-a";
const LEARNER_B = "learner-b";
const LESSON_1 = "lesson-1";

const PARENT_A: PolicyActor = { userId: "u-parent-a", tenantId: TENANT, role: "parent" };
const PARENT_B: PolicyActor = { userId: "u-parent-b", tenantId: TENANT, role: "parent" };
const CAREGIVER_A: PolicyActor = { userId: "u-cg-a", tenantId: TENANT, role: "caregiver" };
const TEACHER_A: PolicyActor = { userId: "u-teach-a", tenantId: TENANT, role: "teacher" };
const THERAPIST: PolicyActor = { userId: "u-thera", tenantId: TENANT, role: "therapist" };
const LEARNER: PolicyActor = { userId: "u-learner-a", tenantId: TENANT, role: "learner" };

function makeCtx(opts: {
  relationships?: Record<string, Partial<FamilyRelationships>>;
  consent?: Record<string, Array<{ channel: any; optedIn: boolean }>>;
  lessonActive?: boolean;
}): PolicyContext {
  const rels: Record<string, FamilyRelationships> = {};
  for (const [k, v] of Object.entries(opts.relationships ?? {})) {
    rels[k] = {
      parentLearnerIds: v.parentLearnerIds ?? [],
      caregiverLearnerIds: v.caregiverLearnerIds ?? [],
      teacherLearnerIds: v.teacherLearnerIds ?? [],
      therapistLearnerIds: v.therapistLearnerIds ?? [],
    };
  }
  const family: FamilyClient = {
    async getRelationships(uid) {
      return (
        rels[uid] ?? {
          parentLearnerIds: [],
          caregiverLearnerIds: [],
          teacherLearnerIds: [],
          therapistLearnerIds: [],
        }
      );
    },
    async isLessonActiveForPair() {
      return opts.lessonActive ?? false;
    },
  };
  const identity: IdentityClient = {
    async fetchUser() {
      return null;
    },
    async lookupUserByPhone() {
      return null;
    },
  };
  return {
    family,
    identity,
    loadConsent: async (uid) => {
      const rows = opts.consent?.[uid] ?? [];
      return rows.map((r) => ({ userId: uid, channel: r.channel, optedIn: r.optedIn }));
    },
  };
}

function parentTeacherThread(learnerId: string): MessageThreadRow {
  return {
    id: "thread-1",
    kind: "parent_teacher",
    tenantId: TENANT,
    learnerId,
    lessonId: null,
    createdBy: TEACHER_A.userId,
    archivedAt: null,
  };
}

function lessonThread(learnerId: string, lessonId: string): MessageThreadRow {
  return {
    id: "thread-l",
    kind: "learner_teacher_lesson",
    tenantId: TENANT,
    learnerId,
    lessonId,
    createdBy: TEACHER_A.userId,
    archivedAt: null,
  };
}

function therapistThread(learnerId: string): MessageThreadRow {
  return {
    id: "thread-t",
    kind: "therapist_family",
    tenantId: TENANT,
    learnerId,
    lessonId: null,
    createdBy: THERAPIST.userId,
    archivedAt: null,
  };
}

// 1. parent-of-A → thread about learner A: allowed view + post
test("parent of learner A can VIEW and POST on parent_teacher thread about A", async () => {
  const ctx = makeCtx({
    relationships: { [PARENT_A.userId]: { parentLearnerIds: [LEARNER_A] } },
  });
  const t = parentTeacherThread(LEARNER_A);
  assert.deepEqual(await canViewThread(PARENT_A, t, ctx), { allowed: true });
  assert.deepEqual(await canPostToThread(PARENT_A, t, ctx), { allowed: true });
});

// 2. parent-of-A → thread about learner B: DENIED view (must return 403, not empty 200)
test("parent of learner A is DENIED view of any thread about learner B", async () => {
  const ctx = makeCtx({
    relationships: { [PARENT_A.userId]: { parentLearnerIds: [LEARNER_A] } },
  });
  const t = parentTeacherThread(LEARNER_B);
  const decision = await canViewThread(PARENT_A, t, ctx);
  assert.equal(decision.allowed, false, "must deny");
  assert.equal(
    (decision as any).reason,
    "not_related_to_learner",
    "reason must indicate relationship gap (NOT a generic 404)",
  );
});

// 3. caregiver-of-A → parent↔teacher thread about A: read OK, post DENIED
test("caregiver of learner A can VIEW but CANNOT POST on parent_teacher thread for A", async () => {
  const ctx = makeCtx({
    relationships: { [CAREGIVER_A.userId]: { caregiverLearnerIds: [LEARNER_A] } },
  });
  const t = parentTeacherThread(LEARNER_A);
  assert.deepEqual(await canViewThread(CAREGIVER_A, t, ctx), { allowed: true });
  const post = await canPostToThread(CAREGIVER_A, t, ctx);
  assert.equal(post.allowed, false);
  assert.equal((post as any).reason, "caregiver_read_only");
});

// 4. therapist → family thread with NO consent row: DENIED
test("therapist with NO consent row is denied therapist_family view AND post", async () => {
  const ctx = makeCtx({
    relationships: { [THERAPIST.userId]: { therapistLearnerIds: [LEARNER_A] } },
    consent: {},
  });
  const t = therapistThread(LEARNER_A);
  const view = await canViewThread(THERAPIST, t, ctx);
  assert.equal(view.allowed, false);
  assert.equal((view as any).reason, "therapist_consent_missing");
  const post = await canPostToThread(THERAPIST, t, ctx);
  assert.equal(post.allowed, false);
  assert.equal((post as any).reason, "therapist_consent_missing");
});

// 5. therapist → family thread WITH consent row: allowed
test("therapist with explicit consent row is allowed therapist_family view AND post", async () => {
  const ctx = makeCtx({
    relationships: { [THERAPIST.userId]: { therapistLearnerIds: [LEARNER_A] } },
    consent: { [THERAPIST.userId]: [{ channel: "in_app", optedIn: true }] },
  });
  const t = therapistThread(LEARNER_A);
  assert.deepEqual(await canViewThread(THERAPIST, t, ctx), { allowed: true });
  assert.deepEqual(await canPostToThread(THERAPIST, t, ctx), { allowed: true });
});

// 6. Unrelated parent ↔ unrelated parent DM: refused at create time
test("two unrelated parents cannot create a thread (refused at create time)", async () => {
  const ctx = makeCtx({
    relationships: {
      [PARENT_A.userId]: { parentLearnerIds: [LEARNER_A] },
      [PARENT_B.userId]: { parentLearnerIds: [LEARNER_B] },
    },
  });
  // Parent A trying to open a parent_teacher thread about Parent B's learner.
  const decision = await canCreateThread(PARENT_A, "parent_teacher", LEARNER_B, null, ctx);
  assert.equal(decision.allowed, false);
  assert.equal((decision as any).reason, "no_relationship_to_learner");
});

// 7. learner ↔ teacher OUTSIDE lesson context: DENIED
test("learner ↔ teacher channel is denied when no lesson is active", async () => {
  const ctx = makeCtx({
    relationships: { [TEACHER_A.userId]: { teacherLearnerIds: [LEARNER_A] } },
    lessonActive: false,
  });
  const t = lessonThread(LEARNER_A, LESSON_1);
  const decision = await canPostToThread(TEACHER_A, t, ctx);
  assert.equal(decision.allowed, false);
  assert.equal((decision as any).reason, "lesson_not_active");

  const create = await canCreateThread(
    TEACHER_A,
    "learner_teacher_lesson",
    LEARNER_A,
    LESSON_1,
    ctx,
  );
  assert.equal(create.allowed, false);
  assert.equal((create as any).reason, "lesson_not_active");
});

// 8. learner ↔ teacher INSIDE lesson context: allowed (for lesson duration)
test("learner ↔ teacher channel is allowed while lesson is active", async () => {
  const ctx = makeCtx({
    relationships: { [TEACHER_A.userId]: { teacherLearnerIds: [LEARNER_A] } },
    lessonActive: true,
  });
  const t = lessonThread(LEARNER_A, LESSON_1);
  assert.deepEqual(await canPostToThread(TEACHER_A, t, ctx), { allowed: true });

  // The learner side – role=learner – can also post during an active lesson.
  const learnerCtx = makeCtx({
    relationships: {},
    lessonActive: true,
  });
  assert.deepEqual(await canPostToThread(LEARNER, t, learnerCtx), { allowed: true });
});

// Additional: cross-tenant access is always denied (defence in depth).
test("cross-tenant access is denied regardless of role", async () => {
  const ctx = makeCtx({
    relationships: { [PARENT_A.userId]: { parentLearnerIds: [LEARNER_A] } },
  });
  const t: MessageThreadRow = { ...parentTeacherThread(LEARNER_A), tenantId: "other-tenant" };
  const view = await canViewThread(PARENT_A, t, ctx);
  assert.equal(view.allowed, false);
  assert.equal((view as any).reason, "cross_tenant");
});

// Additional: archived threads can be viewed but not posted to.
test("archived threads block POST but not VIEW", async () => {
  const ctx = makeCtx({
    relationships: { [PARENT_A.userId]: { parentLearnerIds: [LEARNER_A] } },
  });
  const t: MessageThreadRow = { ...parentTeacherThread(LEARNER_A), archivedAt: new Date() };
  assert.deepEqual(await canViewThread(PARENT_A, t, ctx), { allowed: true });
  const post = await canPostToThread(PARENT_A, t, ctx);
  assert.equal(post.allowed, false);
  assert.equal((post as any).reason, "thread_archived");
});

// Additional: district announcement is read-only for non-admins.
test("district_announcement is read-only for non-admins", async () => {
  const ctx = makeCtx({ relationships: {} });
  const t: MessageThreadRow = {
    id: "ann",
    kind: "district_announcement",
    tenantId: TENANT,
    learnerId: null,
    lessonId: null,
    createdBy: "admin",
    archivedAt: null,
  };
  assert.deepEqual(await canViewThread(PARENT_A, t, ctx), { allowed: true });
  const post = await canPostToThread(PARENT_A, t, ctx);
  assert.equal(post.allowed, false);
  assert.equal((post as any).reason, "read_only_channel");
});

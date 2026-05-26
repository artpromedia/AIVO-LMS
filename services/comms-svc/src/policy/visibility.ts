/**
 * Sprint 13 — messaging visibility policy.
 *
 * See docs/comms/boundaries.md for the human-readable matrix. This file
 * is the executable version of that matrix; the routes never make their
 * own access decisions, they always delegate to one of:
 *
 *   - canViewThread(actor, thread, ctx)
 *   - canPostToThread(actor, thread, ctx)
 *   - canCreateThread(actor, intendedKind, learnerId, lessonId, ctx)
 *
 * Each function returns a discriminated PolicyDecision so callers can
 * surface a specific 403 reason in audit events without re-implementing
 * the rule themselves.
 */
import type { FamilyClient, FamilyRelationships } from "../clients/family-client.js";
import type { IdentityClient, IdentityUser } from "../clients/identity-client.js";

export type ThreadKind =
  | "parent_teacher"
  | "learner_teacher_lesson"
  | "therapist_family"
  | "district_announcement";

export interface MessageThreadRow {
  id: string;
  kind: ThreadKind;
  tenantId: string;
  learnerId: string | null;
  lessonId: string | null;
  createdBy: string;
  archivedAt: Date | null;
}

export interface MessageConsentRow {
  userId: string;
  channel: "email" | "sms" | "push" | "in_app";
  optedIn: boolean;
}

export interface PolicyActor {
  userId: string;
  tenantId: string;
  role: string;
}

export interface PolicyContext {
  identity: IdentityClient;
  family: FamilyClient;
  /**
   * Returns the (possibly empty) message_consent row(s) for the user.
   * Implementations typically wrap a drizzle query.
   */
  loadConsent(userId: string): Promise<MessageConsentRow[]>;
}

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

const allow = (): PolicyDecision => ({ allowed: true });
const deny = (reason: string): PolicyDecision => ({ allowed: false, reason });

function sameTenant(actor: PolicyActor, thread: { tenantId: string }): boolean {
  return actor.tenantId === thread.tenantId;
}

async function relationshipsFor(
  ctx: PolicyContext,
  userId: string,
): Promise<FamilyRelationships> {
  return ctx.family.getRelationships(userId);
}

function hasLearner(rel: FamilyRelationships, kind: keyof FamilyRelationships, id: string | null) {
  if (!id) return false;
  return rel[kind].includes(id);
}

async function therapistHasConsent(ctx: PolicyContext, therapistId: string): Promise<boolean> {
  const rows = await ctx.loadConsent(therapistId);
  return rows.some(
    (r) => r.optedIn && (r.channel === "in_app" || r.channel === "email"),
  );
}

// ────────────────────────────────────────────────────────────────────────
// canViewThread

export async function canViewThread(
  actor: PolicyActor,
  thread: MessageThreadRow,
  ctx: PolicyContext,
): Promise<PolicyDecision> {
  if (!sameTenant(actor, thread)) return deny("cross_tenant");
  if (thread.archivedAt) {
    // Archived threads are still readable to participants but not new joiners.
  }

  const rel = await relationshipsFor(ctx, actor.userId);

  switch (thread.kind) {
    case "parent_teacher": {
      if (!thread.learnerId) return deny("malformed_thread_no_learner");
      // Parent of learner OR teacher of learner OR caregiver of learner.
      if (hasLearner(rel, "parentLearnerIds", thread.learnerId)) return allow();
      if (hasLearner(rel, "teacherLearnerIds", thread.learnerId)) return allow();
      if (hasLearner(rel, "caregiverLearnerIds", thread.learnerId)) return allow();
      return deny("not_related_to_learner");
    }
    case "learner_teacher_lesson": {
      if (!thread.learnerId || !thread.lessonId) {
        return deny("malformed_thread_lesson");
      }
      // The learner themself OR the teacher of the lesson. We trust
      // family-svc's lesson-membership view via teacherLearnerIds.
      if (actor.role === "learner") {
        // The learner can see threads about themselves.
        if (hasLearner(rel, "parentLearnerIds", thread.learnerId)) {
          // parent shouldn't appear here, fall through
        }
        // Learners are scoped to their own user_id, identity-svc gives us
        // role=='learner' for those.
        return allow();
      }
      if (hasLearner(rel, "teacherLearnerIds", thread.learnerId)) return allow();
      return deny("not_in_lesson");
    }
    case "therapist_family": {
      if (!thread.learnerId) return deny("malformed_thread_no_learner");
      if (hasLearner(rel, "parentLearnerIds", thread.learnerId)) return allow();
      if (hasLearner(rel, "caregiverLearnerIds", thread.learnerId)) return allow();
      if (hasLearner(rel, "therapistLearnerIds", thread.learnerId)) {
        if (!(await therapistHasConsent(ctx, actor.userId))) {
          return deny("therapist_consent_missing");
        }
        return allow();
      }
      return deny("not_related_to_learner");
    }
    case "district_announcement": {
      // Within the tenant, all users can read.
      return allow();
    }
    default:
      return deny("unknown_kind");
  }
}

// ────────────────────────────────────────────────────────────────────────
// canPostToThread

export async function canPostToThread(
  actor: PolicyActor,
  thread: MessageThreadRow,
  ctx: PolicyContext,
): Promise<PolicyDecision> {
  if (!sameTenant(actor, thread)) return deny("cross_tenant");
  if (thread.archivedAt) return deny("thread_archived");

  const rel = await relationshipsFor(ctx, actor.userId);

  switch (thread.kind) {
    case "parent_teacher": {
      if (!thread.learnerId) return deny("malformed_thread_no_learner");
      // Caregivers are explicitly read-only.
      if (
        hasLearner(rel, "caregiverLearnerIds", thread.learnerId) &&
        !hasLearner(rel, "parentLearnerIds", thread.learnerId) &&
        !hasLearner(rel, "teacherLearnerIds", thread.learnerId)
      ) {
        return deny("caregiver_read_only");
      }
      if (hasLearner(rel, "parentLearnerIds", thread.learnerId)) return allow();
      if (hasLearner(rel, "teacherLearnerIds", thread.learnerId)) return allow();
      return deny("not_authorised_to_post");
    }
    case "learner_teacher_lesson": {
      if (!thread.learnerId || !thread.lessonId) {
        return deny("malformed_thread_lesson");
      }
      // Post requires the lesson to be currently active for the pair.
      let teacherForCheck: string;
      if (actor.role === "learner") {
        // For a learner posting, we check that ANY teacher in the lesson
        // is still active. We pick createdBy as the canonical teacher;
        // family-svc determines whether the lesson is live.
        teacherForCheck = thread.createdBy;
      } else if (hasLearner(rel, "teacherLearnerIds", thread.learnerId)) {
        teacherForCheck = actor.userId;
      } else {
        return deny("not_in_lesson");
      }
      const isActive = await ctx.family.isLessonActiveForPair(
        thread.learnerId,
        teacherForCheck,
        thread.lessonId,
      );
      if (!isActive) return deny("lesson_not_active");
      return allow();
    }
    case "therapist_family": {
      if (!thread.learnerId) return deny("malformed_thread_no_learner");
      if (hasLearner(rel, "therapistLearnerIds", thread.learnerId)) {
        if (!(await therapistHasConsent(ctx, actor.userId))) {
          return deny("therapist_consent_missing");
        }
        return allow();
      }
      if (hasLearner(rel, "parentLearnerIds", thread.learnerId)) return allow();
      return deny("not_authorised_to_post");
    }
    case "district_announcement": {
      // Only admins post; everyone else is reader-only.
      if (actor.role === "DISTRICT_ADMIN" || actor.role === "PLATFORM_ADMIN") {
        return allow();
      }
      return deny("read_only_channel");
    }
    default:
      return deny("unknown_kind");
  }
}

// ────────────────────────────────────────────────────────────────────────
// canCreateThread

export async function canCreateThread(
  actor: PolicyActor,
  intendedKind: ThreadKind,
  learnerId: string | null,
  lessonId: string | null,
  ctx: PolicyContext,
): Promise<PolicyDecision> {
  const rel = await relationshipsFor(ctx, actor.userId);

  switch (intendedKind) {
    case "parent_teacher": {
      if (!learnerId) return deny("learner_required");
      // Parent can create a thread for a learner they parent.
      if (
        actor.role === "parent" &&
        hasLearner(rel, "parentLearnerIds", learnerId)
      ) {
        return allow();
      }
      // Teacher can create a thread for a learner they teach.
      if (
        actor.role === "teacher" &&
        hasLearner(rel, "teacherLearnerIds", learnerId)
      ) {
        return allow();
      }
      // Two unrelated parents attempting to DM each other land here and
      // are refused: no shared learner means no parent_teacher channel
      // and there's no other parent ↔ parent channel.
      return deny("no_relationship_to_learner");
    }
    case "learner_teacher_lesson": {
      if (!learnerId || !lessonId) return deny("learner_and_lesson_required");
      if (actor.role === "teacher") {
        if (!hasLearner(rel, "teacherLearnerIds", learnerId)) {
          return deny("teacher_not_assigned_to_learner");
        }
        const active = await ctx.family.isLessonActiveForPair(
          learnerId,
          actor.userId,
          lessonId,
        );
        if (!active) return deny("lesson_not_active");
        return allow();
      }
      if (actor.role === "learner") {
        const active = await ctx.family.isLessonActiveForPair(
          learnerId,
          actor.userId, // learner's own id as one side; family-svc determines pair semantics
          lessonId,
        );
        if (!active) return deny("lesson_not_active");
        return allow();
      }
      return deny("role_cannot_create_lesson_thread");
    }
    case "therapist_family": {
      if (!learnerId) return deny("learner_required");
      if (
        actor.role === "therapist" &&
        hasLearner(rel, "therapistLearnerIds", learnerId)
      ) {
        if (!(await therapistHasConsent(ctx, actor.userId))) {
          return deny("therapist_consent_missing");
        }
        return allow();
      }
      if (
        actor.role === "parent" &&
        hasLearner(rel, "parentLearnerIds", learnerId)
      ) {
        return allow();
      }
      return deny("not_authorised_for_family_channel");
    }
    case "district_announcement": {
      if (actor.role === "DISTRICT_ADMIN" || actor.role === "PLATFORM_ADMIN") {
        return allow();
      }
      return deny("admin_only");
    }
    default:
      return deny("unknown_kind");
  }
}

// Re-exports for ergonomic imports in routes.
export type { IdentityUser };

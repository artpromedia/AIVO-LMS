import { fail } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { Permission } from "@aivo/security";
import type { Role, SessionProfile } from "@/lib/auth/types";
import { getRequestSession } from "@/lib/auth/session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { parentCanAccessLearner, teacherCanAccessLearner, getLearner, getBrainProfile } from "@/lib/db/repos";
import { listLearnersForMember } from "@/lib/db/team-invites";

export async function requireSession(req: Request, requestId: string) {
  const session = await getRequestSession(req);
  if (!session) {
    return {
      session: null,
      response: fail({ ...ERRORS.UNAUTHENTICATED, message: "No session found" }, requestId),
    };
  }
  return { session, response: null };
}

export function requireRole(session: SessionProfile, roles: Role[], requestId: string) {
  if (!roles.includes(session.role)) {
    return fail(
      {
        ...ERRORS.FORBIDDEN_ROLE,
        message: `Role ${session.role} not in ${roles.join(",")}`,
      },
      requestId,
    );
  }
  return null;
}

export function requirePermission(
  session: SessionProfile,
  permission: Permission | string,
  requestId: string,
) {
  if (!sessionHasPermission(session, permission)) {
    return fail(
      {
        ...ERRORS.FORBIDDEN_ROLE,
        message: `Permission ${permission} denied for role ${session.role}`,
      },
      requestId,
    );
  }
  return null;
}

export function requireTenant(session: SessionProfile, tenantId: string, requestId: string) {
  if (session.tenantId !== tenantId) {
    return fail({ ...ERRORS.FORBIDDEN_TENANT, message: "Tenant mismatch" }, requestId);
  }
  return null;
}

/**
 * Verify that the current session can see the given learner.
 * - parent: must have a ParentLearnerRelationship to the learner
 * - learner: the learner record must match their own userId (self-scope)
 * - teacher: must have roster/classroom access OR an accepted teacher team grant
 * - caregiver/therapist: must have an accepted care-team grant
 * - admins: must have tenant visibility; route-specific permission guards
 *   should still run before this helper
 */
export async function requireLearnerScope(
  session: SessionProfile,
  learnerId: string,
  requestId: string,
) {
  if (session.role === "parent") {
    if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
      return fail(
        { ...ERRORS.FORBIDDEN_LEARNER, message: "Parent not linked to learner" },
        requestId,
      );
    }
    return null;
  }
  if (session.role === "learner") {
    if (!session.learnerId || session.learnerId !== learnerId) {
      return fail(
        { ...ERRORS.FORBIDDEN_LEARNER, message: "Learner self-scope mismatch" },
        requestId,
      );
    }
    return null;
  }
  if (session.role === "teacher") {
    const rosterAccess = await teacherCanAccessLearner(session.userId, learnerId, session.tenantId);
    if (rosterAccess) return null;
    const teamLearners = await listLearnersForMember(
      session.userId,
      session.email,
      "teacher",
      session.tenantId,
    );
    if (teamLearners.includes(learnerId)) return null;
    return fail(
      { ...ERRORS.FORBIDDEN_LEARNER, message: "Teacher not linked to learner" },
      requestId,
    );
  }
  if (session.role === "caregiver" || session.role === "therapist") {
    const teamLearners = await listLearnersForMember(
      session.userId,
      session.email,
      session.role,
      session.tenantId,
    );
    if (teamLearners.includes(learnerId)) return null;
    return fail(
      { ...ERRORS.FORBIDDEN_LEARNER, message: `${session.role} not linked to learner` },
      requestId,
    );
  }
  if (
    session.role === "school_admin" ||
    session.role === "district_admin" ||
    session.role === "platform_admin"
  ) {
    const learner = await getLearner(learnerId, session.tenantId);
    if (!learner) {
      return fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "Learner not found in tenant" }, requestId);
    }
    return null;
  }
  return fail(
    { ...ERRORS.FORBIDDEN_ROLE, message: `Role ${session.role} cannot access learners` },
    requestId,
  );
}

/**
 * PIN activation is the handoff into the child-owned app. It therefore waits
 * for the parent's trust ceremony: a cloned brain profile with cloneStage
 * `approved`. This helper is server-side so direct BFF calls cannot bypass a
 * disabled setup button.
 */
export async function requireApprovedBrainForPin(
  session: SessionProfile,
  learnerId: string,
  requestId: string,
) {
  const brain = await getBrainProfile(learnerId, session.tenantId);
  if (!brain || brain.cloneStage !== "approved") {
    return fail(
      {
        ...ERRORS.PRECONDITION_FAILED,
        code: "brain_not_approved",
        message: "Brain profile awaiting parent approval before learner PIN activation",
        userMessage: "Review and approve this learner's AIVO brain before creating their app PIN.",
      },
      requestId,
    );
  }
  return null;
}

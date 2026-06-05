import { fail } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { Permission } from "@aivo/security";
import type { Role, SessionProfile } from "@/lib/auth/types";
import { getMockSession } from "@/lib/auth/mock-session";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { parentCanAccessLearner, getLearner } from "@/lib/db/repos";

export async function requireSession(req: Request, requestId: string) {
  const session = await getMockSession(req);
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
 * - teacher/admins: must share tenantId (cross-tenant blocked here; finer
 *   classroom-level scoping comes in Sprint 18)
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
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) {
    return fail({ ...ERRORS.FORBIDDEN_LEARNER, message: "Learner not found in tenant" }, requestId);
  }
  return null;
}

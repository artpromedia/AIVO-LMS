import { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  learners,
  learnerTeachers,
  withTenantContext,
  withoutTenantContext,
  type TenantTransaction,
} from "@aivo/db";
import {
  verifyJWT,
  JWTPayload,
  checkActiveRole,
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
} from "@aivo/security";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export interface AuthUser {
  sub: string;
  tenantId: string;
  role: string;
  email?: string;
  name?: string;
}

export function extractToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthUser | null> {
  const token = extractToken(request);
  if (!token) {
    reply.code(401).send({ error: "Authentication required" });
    return null;
  }
  let payload: JWTPayload;
  try {
    payload = await verifyJWT(token);
  } catch (_err) {
    reply.code(401).send({ error: "Invalid token" });
    return null;
  }

  // ADR 0020 — the `x-aivo-active-role` header is a hint only, never a
  // privilege grant. Reject (and audit) a header naming a role the token
  // does not grant. Single-role tokens make this a no-op for normal
  // callers (their app sends its own role); it catches spoofed headers.
  const activeRole = checkActiveRole(payload.role, request.headers[ACTIVE_ROLE_HEADER], {
    availableRoles: payload.availableRoles,
  });
  if (!activeRole.ok) {
    request.log?.warn?.(
      {
        event: ACTIVE_ROLE_SPOOFING_EVENT,
        userId: payload.sub,
        tenantId: payload.tenantId,
        requested: activeRole.requested,
        granted: activeRole.granted,
      },
      "rejected x-aivo-active-role header (token does not grant the requested role)",
    );
    reply.code(403).send({ error: "Forbidden role", code: FORBIDDEN_ROLE_CODE });
    return null;
  }

  return payload as AuthUser;
}

/**
 * Sprint 14 (RLS reference adoption): ownership checks self-scope via
 * withTenantContext — on the app_runtime role the learners table is
 * row-level-secured, so the read below returns rows ONLY inside a tenant
 * context matching the row. A token whose tenantId doesn't own the
 * learner therefore fails ownership by RLS even before the WHERE clause.
 */
export async function verifyParentOwnership(
  db: ReturnType<typeof import("@aivo/db").createDb>,
  tenantId: string,
  userSub: string,
  learnerId: string,
): Promise<boolean> {
  if (!isUuid(tenantId) || !isUuid(userSub) || !isUuid(learnerId)) {
    return false;
  }
  return withTenantContext(db, tenantId, async (tx) => {
    const result = await tx
      .select()
      .from(learners)
      .where(and(eq(learners.id, learnerId), eq(learners.parentId, userSub)));
    return result.length > 0;
  });
}

/**
 * True iff `userSub` is a teacher with an ACCEPTED link to `learnerId` in
 * `learner_teachers`. Mirrors the connected-access check used by
 * assessment-svc so a teacher can read the same brain/EF-derived insights a
 * parent sees, gated on the invite they accepted rather than ownership.
 */
export async function verifyTeacherAccess(
  db: ReturnType<typeof import("@aivo/db").createDb>,
  tenantId: string,
  userSub: string,
  learnerId: string,
): Promise<boolean> {
  if (!isUuid(tenantId) || !isUuid(userSub) || !isUuid(learnerId)) {
    return false;
  }
  try {
    return await withTenantContext(db, tenantId, async (tx) => {
      const [row] = await tx
        .select()
        .from(learnerTeachers)
        .where(
          and(
            eq(learnerTeachers.learnerId, learnerId),
            eq(learnerTeachers.teacherUserId, userSub),
            eq(learnerTeachers.status, "ACCEPTED"),
          ),
        )
        .limit(1);
      return !!row;
    });
  } catch {
    return false;
  }
}

/**
 * Sprint 14 (RLS): run a DB batch in the caller's tenant context with
 * app.user_id set (the learners_collaboration_read policy keys on it for
 * cross-tenant ACCEPTED team links). Platform-staff tokens carry no
 * tenant uuid — their access runs explicitly unscoped, which on the
 * app_runtime role yields zero RLS rows (and is unchanged on owner-role
 * deployments). One shared seam so every route file scopes identically.
 */
export function runScoped<T>(
  db: ReturnType<typeof import("@aivo/db").createDb>,
  claims: Pick<AuthUser, "tenantId" | "sub" | "role">,
  fn: (tx: TenantTransaction) => Promise<T>,
): Promise<T> {
  return isUuid(claims.tenantId)
    ? withTenantContext(db, claims.tenantId, fn, {
        userId: isUuid(claims.sub) ? claims.sub : undefined,
      })
    : withoutTenantContext(db, `platform-scoped caller (${claims.role})`, fn);
}

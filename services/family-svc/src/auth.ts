import { FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { learners } from "@aivo/db";
import {
  verifyJWT,
  JWTPayload,
  checkActiveRole,
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
} from "@aivo/security";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
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
  const activeRole = checkActiveRole(payload.role, request.headers[ACTIVE_ROLE_HEADER]);
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

export async function verifyParentOwnership(
  db: ReturnType<typeof import("@aivo/db").createDb>,
  userSub: string,
  learnerId: string,
): Promise<boolean> {
  if (!isUuid(userSub) || !isUuid(learnerId)) {
    return false;
  }
  const result = await db
    .select()
    .from(learners)
    .where(and(eq(learners.id, learnerId), eq(learners.parentId, userSub)));
  return result.length > 0;
}

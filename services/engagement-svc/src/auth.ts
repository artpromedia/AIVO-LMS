import { FastifyRequest, FastifyReply } from "fastify";
import {
  verifyJWT,
  initKeys,
  checkActiveRole,
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
} from "@aivo/security";

export interface AuthUser {
  sub: string;
  email: string;
  role: string;
  tenantId?: string;
}

let initialized = false;

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthUser | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization header" });
    return null;
  }

  const token = authHeader.slice(7);
  try {
    if (!initialized) {
      await initKeys();
      initialized = true;
    }
    const payload = await verifyJWT(token);
    // ADR 0020 — x-aivo-active-role is a hint, never a grant. Reject (and
    // audit) a header naming a role the token does not grant.
    const activeRole = checkActiveRole(payload.role || "", request.headers[ACTIVE_ROLE_HEADER], {
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
      reply.status(403).send({ error: "Forbidden role", code: FORBIDDEN_ROLE_CODE });
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email || "",
      role: payload.role || "",
      tenantId: payload.tenantId,
    };
  } catch {
    reply.status(401).send({ error: "Invalid or expired token" });
    return null;
  }
}

export function requireRole(claims: AuthUser, ...roles: string[]): boolean {
  return roles.includes(claims.role);
}

export function requireSelfOrRole(
  claims: AuthUser,
  learnerId: string,
  ...roles: string[]
): boolean {
  if (claims.sub === learnerId) return true;
  return roles.includes(claims.role);
}

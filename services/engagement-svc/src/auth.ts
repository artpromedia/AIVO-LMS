import { FastifyRequest, FastifyReply } from "fastify";
import { verifyJWT, initKeys } from "@aivo/security";

export interface AuthUser {
  sub: string;
  email: string;
  role: string;
  tenantId?: string;
}

let initialized = false;

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
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

export function requireSelfOrRole(claims: AuthUser, learnerId: string, ...roles: string[]): boolean {
  if (claims.sub === learnerId) return true;
  return roles.includes(claims.role);
}

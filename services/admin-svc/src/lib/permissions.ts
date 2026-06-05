import type { FastifyReply, FastifyRequest } from "fastify";
import { Permission, hasPermission, verifyJWT } from "@aivo/security";

export interface AdminJwtPayload {
  sub: string;
  role: string;
  email?: string;
}

export async function requirePermission(
  req: FastifyRequest,
  reply: FastifyReply,
  permission: Permission | string,
): Promise<AdminJwtPayload | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_bearer_token" });
    return null;
  }

  try {
    const payload = (await verifyJWT(auth.slice("Bearer ".length).trim())) as AdminJwtPayload;
    if (!hasPermission(payload.role, permission)) {
      reply.code(403).send({ error: "forbidden", required_permission: permission });
      return null;
    }
    (req as FastifyRequest & { user?: AdminJwtPayload }).user = payload;
    return payload;
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return null;
  }
}

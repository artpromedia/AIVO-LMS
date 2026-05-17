import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyJWT } from "@aivo/security";

interface JwtPayload {
  sub: string;
  role: string;
  email?: string;
}

export async function requirePlatformAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<JwtPayload | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_bearer_token" });
    return null;
  }
  const token = auth.slice("Bearer ".length).trim();
  try {
    const payload = (await verifyJWT(token)) as JwtPayload;
    if (payload.role !== "PLATFORM_ADMIN") {
      reply.code(403).send({ error: "forbidden", required_role: "PLATFORM_ADMIN" });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return null;
  }
}

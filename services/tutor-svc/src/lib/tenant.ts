import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { learners, users } from "@aivo/db";
import {
  verifyJWT,
  JWTPayload,
  checkActiveRole,
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
} from "@aivo/security";

const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "";
if (process.env.NODE_ENV === "production" && !INTERNAL_SERVICE_TOKEN) {
  throw new Error(
    "tutor-svc: INTERNAL_SERVICE_TOKEN must be set in production (shared secret for inter-service calls).",
  );
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: JWTPayload | { sub: string; role: "service"; tenantId: string };
  }
}

/**
 * Global authentication for tutor-svc. See learning-svc/lib/tenant.ts
 * for the full policy. Same Bearer/cookie/x-service-token rules apply.
 */
export function registerAuthHook(app: FastifyInstance): void {
  const expectedServiceToken =
    INTERNAL_SERVICE_TOKEN ||
    (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-token");

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.url || "";
    if (
      req.method === "OPTIONS" ||
      url === "/" ||
      url.startsWith("/health") ||
      url === "/api/tutors/version" ||
      url.startsWith("/docs") ||
      url.startsWith("/json")
    ) {
      return;
    }

    const auth = await extractAuth(req);
    if (auth?.sub) {
      // ADR 0020 — x-aivo-active-role is a hint, never a grant. Reject (and
      // audit) a header naming a role the token does not grant.
      const activeRole = checkActiveRole(auth.role, req.headers[ACTIVE_ROLE_HEADER], {
        availableRoles: (auth as { availableRoles?: string[] }).availableRoles,
      });
      if (!activeRole.ok) {
        req.log?.warn?.(
          {
            event: ACTIVE_ROLE_SPOOFING_EVENT,
            userId: auth.sub,
            tenantId: auth.tenantId,
            requested: activeRole.requested,
            granted: activeRole.granted,
          },
          "rejected x-aivo-active-role header (token does not grant the requested role)",
        );
        reply.code(403).send({ error: "Forbidden role", code: FORBIDDEN_ROLE_CODE });
        return;
      }
      req.auth = auth;
      return;
    }

    const serviceToken = req.headers["x-service-token"];
    if (
      expectedServiceToken &&
      typeof serviceToken === "string" &&
      serviceToken === expectedServiceToken
    ) {
      req.auth = { sub: "service", role: "service", tenantId: "" };
      return;
    }

    reply.code(401).send({ error: "Authentication required" });
  });
}

export async function extractAuth(request: FastifyRequest): Promise<JWTPayload | null> {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      return await verifyJWT(authHeader.slice(7));
    } catch {
      return null;
    }
  }
  const cookieHeader = request.headers.cookie || "";
  const match = cookieHeader.match(/access_token=([^;]+)/);
  if (match) {
    try {
      return await verifyJWT(match[1]);
    } catch {
      return null;
    }
  }
  return null;
}

export async function resolveTenantIdForLearner(
  request: FastifyRequest,
  db: any,
  learnerId?: string | null,
): Promise<string | null> {
  const auth = await extractAuth(request);
  if (auth?.tenantId) return auth.tenantId;

  if (learnerId) {
    try {
      const [row] = await db
        .select({ tenantId: learners.tenantId })
        .from(learners)
        .where(eq(learners.id, learnerId));
      if (row?.tenantId) return row.tenantId;
    } catch {}
  }
  return null;
}

export async function resolveTenantIdForUser(
  request: FastifyRequest,
  db: any,
  userId?: string | null,
  _bodyTenantIdIgnored?: string | null,
): Promise<string | null> {
  const auth = await extractAuth(request);
  if (auth?.tenantId) return auth.tenantId;

  if (userId) {
    try {
      const [row] = await db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, userId));
      if (row?.tenantId) return row.tenantId;
    } catch {}
  }
  return null;
}

import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { learners } from "@aivo/db";
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
    "learning-svc: INTERNAL_SERVICE_TOKEN must be set in production (shared secret for inter-service calls).",
  );
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: JWTPayload | { sub: string; role: "service"; tenantId: string };
  }
}

/**
 * Global authentication: every request must carry either a valid JWT
 * (Bearer header / access_token cookie) or a matching x-service-token
 * header for trusted internal callers (brain-svc, tutor-svc, etc).
 *
 * Skips healthcheck and swagger paths so probes / docs remain reachable.
 * In production INTERNAL_SERVICE_TOKEN must be set; in dev a fallback
 * keeps local hacking unblocked.
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
      url.startsWith("/docs") ||
      url.startsWith("/json")
    ) {
      return;
    }

    const auth = await extractAuth(req);
    if (auth?.sub) {
      // ADR 0020 — x-aivo-active-role is a hint, never a grant. Reject (and
      // audit) a header naming a role the token does not grant.
      const activeRole = checkActiveRole(auth.role, req.headers[ACTIVE_ROLE_HEADER]);
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

export async function resolveTenantId(
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

  const internalTenantHeader = request.headers["x-tenant-id"];
  if (typeof internalTenantHeader === "string" && internalTenantHeader.length > 0) {
    return internalTenantHeader;
  }

  return null;
}

export interface LearnerAccess {
  tenantId: string;
}

/**
 * Strict guard for routes that mutate or expose learner-scoped state.
 *
 * Requires either:
 *  - a valid JWT whose tenantId matches the learner's tenantId (PLATFORM_ADMIN
 *    role bypasses the tenant match), OR
 *  - an internal service-to-service call (x-internal-service header set to a
 *    known service AND a matching x-service-token, or x-tenant-id sent from a
 *    trusted internal source).
 *
 * Returns the resolved tenantId on success, or sends an error response and
 * returns null on failure. Callers should `return` immediately when null.
 */
export async function requireLearnerAccess(
  request: FastifyRequest,
  reply: any,
  db: any,
  learnerId: string,
): Promise<LearnerAccess | null> {
  // 1. Verify the caller is authenticated FIRST so unauthenticated probes
  //    can't enumerate learner IDs by distinguishing 404 from 401.
  const auth = await extractAuth(request);
  const internalSvc = request.headers["x-internal-service"];
  const serviceToken = request.headers["x-service-token"];
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
  const isInternal =
    typeof internalSvc === "string" &&
    internalSvc.length > 0 &&
    (expectedToken ? typeof serviceToken === "string" && serviceToken === expectedToken : true);

  if (!auth?.tenantId && !isInternal) {
    reply.code(401).send({ error: "Authentication required" });
    return null;
  }

  // 2. Resolve the learner's tenantId.
  let learnerTenantId: string | null = null;
  try {
    const [row] = await db
      .select({ tenantId: learners.tenantId })
      .from(learners)
      .where(eq(learners.id, learnerId));
    learnerTenantId = row?.tenantId ?? null;
  } catch {
    learnerTenantId = null;
  }

  if (!learnerTenantId) {
    reply.code(404).send({ error: "Learner not found" });
    return null;
  }

  // 3. Authenticated callers must belong to the learner's tenant
  //    (PLATFORM_ADMIN bypasses).
  if (auth?.tenantId) {
    const isPlatformAdmin = (auth as any).role === "PLATFORM_ADMIN";
    if (!isPlatformAdmin && auth.tenantId !== learnerTenantId) {
      reply.code(403).send({ error: "Forbidden: tenant mismatch" });
      return null;
    }
  }

  return { tenantId: learnerTenantId };
}

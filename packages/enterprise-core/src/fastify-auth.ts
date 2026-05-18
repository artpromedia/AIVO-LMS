/**
 * Shared Fastify auth + request-context hook for enterprise services.
 *
 * Each new service registers `registerEnterpriseAuthHook(app)` on its
 * Fastify instance to:
 *   - parse the `Authorization: Bearer <jwt>` header (or `access_token`
 *     cookie) and verify it,
 *   - attach `RequestContext` to `request.enterpriseContext`,
 *   - reject the request with 401 when no token is present and the
 *     route is not in the allowlist (`/healthz` etc.).
 *
 * Verification is loaded dynamically from `@aivo/security` so this
 * package keeps `@aivo/security` as an optional peer — services that
 * already depend on it get full JWT verification; services that don't
 * (or run in tests) get a permissive path that still constructs a
 * RequestContext from x-actor-* headers when present.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createRequestContext, type RequestContext } from "./request-context.js";
import type { TenantContext, TenantRole } from "./tenant-context.js";

const TENANT_ROLES = new Set<TenantRole>([
  "learner",
  "parent",
  "teacher",
  "school_admin",
  "district_admin",
  "platform_admin",
  "service",
]);

function coerceRole(value: unknown): TenantRole | undefined {
  if (typeof value !== "string") return undefined;
  return TENANT_ROLES.has(value as TenantRole) ? (value as TenantRole) : undefined;
}

declare module "fastify" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface FastifyRequest {
    enterpriseContext?: RequestContext;
  }
}

export interface EnterpriseAuthOptions {
  /** Service name written into `RequestContext.sourceService`. */
  sourceService: string;
  /** Routes the hook skips (e.g. `/healthz`, `/metrics`). */
  skipPaths?: string[];
  /**
   * Optional sync override of the JWT verifier. Used by tests and by
   * services that do not pull in @aivo/security.
   */
  verify?: (token: string) => Promise<Record<string, unknown> | null>;
  /**
   * When true, requests with no token are still allowed through but
   * with an unauthenticated RequestContext. Defaults to false (401).
   */
  allowUnauthenticated?: boolean;
}

function readBearer(request: FastifyRequest): string | undefined {
  const authHeader = request.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = request.headers["cookie"];
  if (typeof cookieHeader === "string") {
    const match = cookieHeader.match(/(?:^|;\s*)access_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return undefined;
}

async function loadSecurityVerifier(): Promise<
  ((token: string) => Promise<Record<string, unknown>>) | null
> {
  try {
    // Use a dynamic import so the dep stays optional. Some services run in
    // restricted environments (tests, smoke containers) without security
    // keys and we want them to fall back to the header-based path.
    const moduleName = "@aivo/security";
    const mod = (await import(moduleName)) as {
      verifyJWT?: <T>(token: string) => Promise<T>;
    };
    const verifyJWT = mod.verifyJWT;
    if (typeof verifyJWT === "function") {
      return async (token: string) => {
        const result = await verifyJWT<Record<string, unknown>>(token);
        return (result ?? {}) as Record<string, unknown>;
      };
    }
  } catch {
    // @aivo/security not present or key material missing — fall back.
  }
  return null;
}

export function registerEnterpriseAuthHook(
  app: FastifyInstance,
  options: EnterpriseAuthOptions,
): void {
  const skip = new Set(options.skipPaths ?? ["/healthz", "/metrics"]);
  let cachedVerifier: ((token: string) => Promise<Record<string, unknown> | null>) | null = null;

  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (skip.has(request.url.split("?")[0])) {
      return;
    }

    const token = readBearer(request);
    let claims: Record<string, unknown> | null = null;

    if (token) {
      const verifier = options.verify ?? cachedVerifier ?? (await loadSecurityVerifier());
      if (verifier && !options.verify) cachedVerifier = verifier;
      if (verifier) {
        try {
          claims = await verifier(token);
        } catch {
          return reply.code(401).send({ error: "Invalid token" });
        }
      } else if (process.env.NODE_ENV === "production") {
        // No verifier available in production is a hard failure.
        return reply.code(503).send({ error: "Auth verifier unavailable" });
      }
    }

    if (!claims && !options.allowUnauthenticated) {
      // Allow services to use x-actor-* headers for service-to-service
      // calls in dev. In production, require a token.
      const actorId = request.headers["x-actor-id"];
      const actorRole = coerceRole(request.headers["x-actor-role"]);
      const tenantId = request.headers["x-tenant-id"];
      if (
        process.env.NODE_ENV !== "production" &&
        typeof actorId === "string" &&
        typeof tenantId === "string" &&
        actorRole
      ) {
        const tenant: TenantContext = { tenantId, role: actorRole };
        request.enterpriseContext = createRequestContext({
          actorId,
          actorRole,
          tenant,
          sourceService: options.sourceService,
        });
        return;
      }
      return reply.code(401).send({ error: "Authentication required" });
    }

    const role = coerceRole(claims?.role);
    const tenantId = typeof claims?.tenantId === "string" ? claims.tenantId : undefined;
    const actorId = typeof claims?.sub === "string" ? claims.sub : undefined;
    const tenant: TenantContext | undefined = tenantId && role ? { tenantId, role } : undefined;
    request.enterpriseContext = createRequestContext({
      actorId,
      actorRole: role,
      tenant,
      sourceService: options.sourceService,
      correlationId:
        typeof request.headers["x-correlation-id"] === "string"
          ? (request.headers["x-correlation-id"] as string)
          : undefined,
    });
  });
}

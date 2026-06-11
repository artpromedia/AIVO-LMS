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
import {
  decideImpersonatedRequest,
  isImpersonation,
  type ImpersonationClaimView,
  type ImpWriteAllowlist,
} from "./impersonation-guard.js";

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
  // identity-svc mints roles in UPPER_CASE ("DISTRICT_ADMIN"); normalize so
  // those tokens get a tenant context too (Sprint B4 — audit-svc tenant
  // scoping depends on it).
  const normalized = value.toLowerCase() as TenantRole;
  return TENANT_ROLES.has(normalized) ? normalized : undefined;
}

declare module "fastify" {
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
  /**
   * This service's impersonation write allowlist (Sprint 9). When a request
   * arrives under an impersonation token (`imp === true`), writes are blocked
   * unless `imp_writes_ok` is set AND (method, path) is on this allowlist.
   * Omitted ⇒ no write is ever allowed under impersonation (deny-by-default).
   */
  impWriteAllowlist?: ImpWriteAllowlist;
  /**
   * Audit sink for impersonated requests. Receives one event per request
   * under impersonation. Wire this to the service's audit emitter; if omitted
   * the guard still enforces, it just doesn't emit.
   */
  onImpersonatedRequest?: (event: ImpersonatedRequestAuditEvent) => void;
}

export interface ImpersonatedRequestAuditEvent {
  action:
    | "auth.impersonation.request"
    | "auth.impersonation.write_allowed"
    | "auth.impersonation.write_blocked"
    | "auth.impersonation.expired";
  actorId: string | undefined;
  subjectId: string | undefined;
  sessionId: string | undefined;
  reason: string | undefined;
  method: string;
  path: string;
  ip: string | undefined;
  userAgent: string | undefined;
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

    // ── Impersonation enforcement (Sprint 9) ────────────────────────────────
    // For impersonation tokens, reads use the impersonated user's roles (the
    // `sub`/`role` claims above already are the subject's), and writes are
    // denied unless explicitly permitted + allowlisted. Every impersonated
    // request is audited.
    if (claims && isImpersonation(claims as ImpersonationClaimView)) {
      const impClaims = claims as ImpersonationClaimView;
      const method = request.method ?? "GET";
      const path = request.url.split("?")[0];
      const decision = decideImpersonatedRequest(
        impClaims,
        method,
        path,
        options.impWriteAllowlist,
      );
      const baseEvent = {
        actorId: impClaims.act,
        subjectId: impClaims.sub,
        sessionId: impClaims.imp_sid,
        reason: impClaims.imp_reason,
        method,
        path,
        ip: request.ip,
        userAgent:
          typeof request.headers["user-agent"] === "string"
            ? (request.headers["user-agent"] as string)
            : undefined,
      };
      // Always record that the request was made under impersonation.
      options.onImpersonatedRequest?.({ action: "auth.impersonation.request", ...baseEvent });

      if (decision.kind === "expired") {
        options.onImpersonatedRequest?.({ action: "auth.impersonation.expired", ...baseEvent });
        return reply.code(401).send({ error: "Impersonation session expired" });
      }
      if (decision.kind === "write_blocked") {
        options.onImpersonatedRequest?.({
          action: "auth.impersonation.write_blocked",
          ...baseEvent,
        });
        return reply
          .code(403)
          .send({ error: "Write blocked under impersonation", reason: decision.reason });
      }
      if (decision.kind === "write_allowed") {
        options.onImpersonatedRequest?.({
          action: "auth.impersonation.write_allowed",
          ...baseEvent,
        });
      }
      // Tag the context so downstream handlers/audit know the real actor.
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
      request.enterpriseContext.impersonatorId = impClaims.act;
      request.enterpriseContext.impersonationSessionId = impClaims.imp_sid;
      return;
    }

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

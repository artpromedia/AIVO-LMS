/**
 * Secure impersonation ("View As") routes — Sprint 9.
 *
 *   POST /api/impersonation/start   { subject_user_id, reason, ttl_seconds, allow_writes, ... }
 *   POST /api/impersonation/stop
 *   GET  /api/impersonation/active
 *   GET  /api/impersonation/history?adminId=
 *
 * /start validates the RBAC matrix and consent rules, requires step-up MFA,
 * then issues a NEW signed JWT carrying the impersonation claims (act/sub/imp/
 * imp_exp/imp_writes_ok/imp_reason/imp_sid). The actor's token MUST be a
 * normal (non-impersonation) token — no transitive impersonation.
 *
 * Resolvers (subject lookup, consent, tenant settings, audit) are injectable
 * so the route is testable without a database; the production wiring uses the
 * identity-svc `db` decorator.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { signJWT, verifyJWT, type JWTPayload } from "@aivo/security";
import {
  buildImpersonationClaims,
  clampTtlSeconds,
  evaluateConsent,
  evaluateRbac,
  type Actor,
  type AdminRole,
  type ConsentContext,
  type Subject,
  type TenantImpersonationSettings,
} from "../lib/impersonation.js";
import {
  getImpersonationStore,
  type ImpersonationSession,
  type ImpersonationStore,
} from "../lib/impersonation-store.js";

const ADMIN_ROLE_SET = new Set(["platform_admin", "district_admin", "school_admin"]);

function normalizeRole(role: string | undefined): string {
  return (role ?? "").toLowerCase();
}

export interface ImpersonationAuditEvent {
  action: string;
  actorId: string;
  subjectId: string;
  reason?: string;
  basis?: string | null;
  justificationTicketId?: string | null;
  ip?: string | null;
  ua?: string | null;
  requestId?: string;
  details?: Record<string, unknown>;
}

export interface ImpersonationDeps {
  store?: ImpersonationStore;
  /** Resolve the subject user to impersonate. */
  resolveSubject: (subjectUserId: string) => Promise<Subject | null>;
  /** Resolve consent context for (actor, subject). */
  resolveConsent: (actor: Actor, subject: Subject, body: StartBody) => Promise<ConsentContext>;
  /** Resolve tenant impersonation settings. */
  resolveTenantSettings: (tenantId: string) => Promise<TenantImpersonationSettings>;
  /** Emit an audit event. */
  audit: (event: ImpersonationAuditEvent) => void | Promise<void>;
  /** Test clock. */
  now?: () => number;
  /**
   * Optional step-up gate. Returns null when satisfied or a 403/401 reason
   * string when step-up is required/invalid. Defaults to checking for an
   * `x-step-up-token` header presence (the real wiring uses requireStepUp).
   */
  verifyStepUp?: (req: FastifyRequest) => Promise<string | null>;
}

export interface StartBody {
  subject_user_id: string;
  reason: string;
  ttl_seconds?: number;
  allow_writes?: boolean;
  justification_ticket_id?: string | null;
  break_glass_code?: string | null;
  /** Adult subject self-consent (verified upstream). */
  subject_consent?: boolean;
  /** Minor subject guardian consent (verified against consent_ledger upstream). */
  guardian_consent?: boolean;
  /** An open compliance/safety incident covers the subject. */
  open_incident?: boolean;
  /** Platform-admin explicit override (adult subjects only). */
  platform_override?: boolean;
}

function clientIp(req: FastifyRequest): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.ip ?? null;
}

function userAgent(req: FastifyRequest): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua : null;
}

async function readActor(req: FastifyRequest): Promise<JWTPayload | null> {
  const auth = req.headers["authorization"];
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return null;
  try {
    return await verifyJWT<JWTPayload>(auth.slice(7));
  } catch {
    return null;
  }
}

export function registerImpersonationRoutes(app: FastifyInstance, deps: ImpersonationDeps): void {
  const store = deps.store ?? getImpersonationStore();
  const now = deps.now ?? Date.now;
  const verifyStepUp =
    deps.verifyStepUp ??
    (async (req: FastifyRequest) => {
      const t = req.headers["x-step-up-token"];
      return typeof t === "string" && t.length > 0 ? null : "STEP_UP_REQUIRED";
    });

  app.post<{ Body: StartBody }>("/api/impersonation/start", async (req, reply) => {
    const actorClaims = await readActor(req);
    if (!actorClaims) return reply.code(401).send({ error: "Authentication required" });

    // No transitive impersonation: an impersonation token can never start a
    // new impersonation.
    if (actorClaims.imp === true) {
      await deps.audit({
        action: "auth.impersonation.refused",
        actorId: actorClaims.act ?? actorClaims.sub,
        subjectId: req.body?.subject_user_id ?? "",
        reason: req.body?.reason,
        ip: clientIp(req),
        ua: userAgent(req),
        details: { code: "TRANSITIVE_IMPERSONATION" },
      });
      return reply.code(403).send({ error: "Cannot impersonate while impersonating" });
    }

    const actorRole = normalizeRole(actorClaims.role);
    if (!ADMIN_ROLE_SET.has(actorRole)) {
      return reply.code(403).send({ error: "Only admins may impersonate" });
    }

    const body = req.body ?? ({} as StartBody);
    if (!body.subject_user_id || !body.reason) {
      return reply.code(400).send({ error: "subject_user_id and reason are required" });
    }

    // Step-up MFA gate.
    const stepUpError = await verifyStepUp(req);
    if (stepUpError) {
      return reply.code(401).send({ error: "Step-up MFA required", code: stepUpError });
    }

    const subject = await deps.resolveSubject(body.subject_user_id);
    if (!subject) return reply.code(404).send({ error: "Subject not found" });

    const actor: Actor = {
      userId: actorClaims.sub,
      role: actorRole as AdminRole,
      tenantId: actorClaims.tenantId,
      districtId: (actorClaims as unknown as Record<string, unknown>).districtId as
        | string
        | undefined,
      schoolId: (actorClaims as unknown as Record<string, unknown>).schoolId as string | undefined,
    };

    // 1) RBAC matrix.
    const rbac = evaluateRbac(actor, subject);
    if (!rbac.allowed) {
      await deps.audit({
        action: "auth.impersonation.refused",
        actorId: actor.userId,
        subjectId: subject.userId,
        reason: body.reason,
        ip: clientIp(req),
        ua: userAgent(req),
        details: { code: rbac.reason },
      });
      return reply.code(403).send({ error: "Forbidden by RBAC", code: rbac.reason });
    }

    // 2) Consent + tenant settings.
    const tenantSettings = await deps.resolveTenantSettings(subject.tenantId);
    const consent = await deps.resolveConsent(actor, subject, body);
    const consentResult = evaluateConsent(subject, consent, tenantSettings, rbac);
    if (!consentResult.allowed) {
      await deps.audit({
        action: "auth.impersonation.refused",
        actorId: actor.userId,
        subjectId: subject.userId,
        reason: body.reason,
        justificationTicketId: body.justification_ticket_id ?? null,
        ip: clientIp(req),
        ua: userAgent(req),
        details: { code: consentResult.reason },
      });
      return reply
        .code(403)
        .send({ error: "Consent requirements not met", code: consentResult.reason });
    }

    // 3) Clamp TTL and mint the impersonation token.
    const ttl = clampTtlSeconds(body.ttl_seconds, tenantSettings);
    const startedAt = new Date(now()).toISOString();
    const endsAt = new Date(now() + ttl * 1000).toISOString();

    const session: ImpersonationSession = store.create({
      actorId: actor.userId,
      subjectId: subject.userId,
      tenantId: subject.tenantId,
      startedAt,
      endsAt,
      endedAt: null,
      reason: body.reason,
      allowWrites: !!body.allow_writes,
      consentBasis: consentResult.basis,
      ip: clientIp(req),
      ua: userAgent(req),
      justificationTicketId: body.justification_ticket_id ?? null,
    });

    const claims = buildImpersonationClaims({
      actorId: actor.userId,
      subject,
      reason: body.reason,
      ttlSeconds: ttl,
      allowWrites: !!body.allow_writes,
      sessionId: session.id,
      subjectEmail: (subject as unknown as Record<string, unknown>).email as string | undefined,
      subjectAvailableRoles: subject.role ? [subject.role] : undefined,
      now: now(),
    });

    const token = await signJWT(claims as unknown as JWTPayload, `${ttl}s`);

    await deps.audit({
      action: "auth.impersonation.start",
      actorId: actor.userId,
      subjectId: subject.userId,
      reason: body.reason,
      basis: consentResult.basis,
      justificationTicketId: body.justification_ticket_id ?? null,
      ip: clientIp(req),
      ua: userAgent(req),
      details: { sessionId: session.id, ttlSeconds: ttl, allowWrites: !!body.allow_writes },
    });

    return reply.code(201).send({
      token,
      session: {
        id: session.id,
        subjectId: subject.userId,
        endsAt,
        allowWrites: !!body.allow_writes,
        consentBasis: consentResult.basis,
      },
    });
  });

  app.post("/api/impersonation/stop", async (req: FastifyRequest, reply: FastifyReply) => {
    const claims = await readActor(req);
    if (!claims) return reply.code(401).send({ error: "Authentication required" });

    // The stop call may carry either the impersonation token or the original
    // admin token (with an explicit session id).
    const sessionId =
      claims.imp === true
        ? claims.imp_sid
        : ((req.body as { session_id?: string } | undefined)?.session_id ?? undefined);
    if (!sessionId) return reply.code(400).send({ error: "No active impersonation session" });

    const session = store.end(sessionId, new Date(now()).toISOString());
    if (!session) return reply.code(404).send({ error: "Session not found" });

    await deps.audit({
      action: "auth.impersonation.stop",
      actorId: session.actorId,
      subjectId: session.subjectId,
      reason: session.reason,
      ip: clientIp(req),
      ua: userAgent(req),
      details: { sessionId: session.id },
    });
    return { stopped: true, sessionId: session.id };
  });

  app.get("/api/impersonation/active", async (req: FastifyRequest, reply: FastifyReply) => {
    const claims = await readActor(req);
    if (!claims) return reply.code(401).send({ error: "Authentication required" });
    const actorId = claims.imp === true ? (claims.act ?? "") : claims.sub;
    const active = store.activeForActor(actorId, now());
    return { active: active ?? null };
  });

  app.get<{ Querystring: { adminId?: string } }>(
    "/api/impersonation/history",
    async (req, reply) => {
      const claims = await readActor(req);
      if (!claims) return reply.code(401).send({ error: "Authentication required" });
      const role = normalizeRole(claims.role);
      // Platform reviewers see all; others see only their own history.
      if (role === "platform_admin" && req.query.adminId) {
        return { sessions: store.historyForActor(req.query.adminId) };
      }
      if (role === "platform_admin") {
        return { sessions: store.all() };
      }
      return { sessions: store.historyForActor(claims.sub) };
    },
  );
}

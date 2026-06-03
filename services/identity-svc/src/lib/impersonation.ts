/**
 * Secure impersonation ("View As") core logic — Sprint 9.
 *
 * Pure, dependency-light functions so the security-critical rules are
 * exhaustively unit-testable:
 *   - TTL clamping (default 15 min, hard cap 30 min, per-tenant floor ≥ 5 min)
 *   - the RBAC matrix (who may impersonate whom)
 *   - consent rules (adult vs minor subjects, break-glass, tenant disable)
 *   - the impersonation JWT claim builder
 *
 * The route layer (routes/impersonation.ts) wires these to MFA step-up, the
 * audit log, and the impersonation_sessions store. Authorization decisions
 * here NEVER trust client input for the acting identity — the caller passes
 * the verified actor context from their own (non-impersonation) token.
 */

export type AdminRole = "platform_admin" | "district_admin" | "school_admin";
export type AnyRole = AdminRole | "teacher" | "parent" | "learner" | "service";

export const DEFAULT_TTL_SECONDS = 15 * 60;
export const HARD_CAP_SECONDS = 30 * 60;
export const MIN_TTL_FLOOR_SECONDS = 5 * 60;

export interface TenantImpersonationSettings {
  /** Tenant can globally disable impersonation. */
  enabled: boolean;
  /** Per-tenant max TTL (seconds); clamped to ≥ MIN_TTL_FLOOR and ≤ HARD_CAP. */
  maxTtlSeconds?: number;
}

/**
 * Clamp a requested TTL. Order: default when unset → never exceed the
 * per-tenant max (itself floored at 5 min, capped at 30 min) → never exceed
 * the global 30-min hard cap → never below 60s (a usable minimum).
 */
export function clampTtlSeconds(
  requested: number | undefined,
  tenant: TenantImpersonationSettings,
): number {
  const tenantMax = Math.min(
    HARD_CAP_SECONDS,
    Math.max(MIN_TTL_FLOOR_SECONDS, tenant.maxTtlSeconds ?? HARD_CAP_SECONDS),
  );
  let ttl = requested && requested > 0 ? requested : DEFAULT_TTL_SECONDS;
  ttl = Math.min(ttl, tenantMax, HARD_CAP_SECONDS);
  ttl = Math.max(ttl, 60);
  return Math.floor(ttl);
}

// ── RBAC matrix ─────────────────────────────────────────────────────────────

export interface Actor {
  userId: string;
  role: AdminRole;
  tenantId: string;
  /** District the actor administers (district_admin) or belongs to. */
  districtId?: string;
  /** School the actor administers (school_admin). */
  schoolId?: string;
}

export interface Subject {
  userId: string;
  role: AnyRole;
  tenantId: string;
  districtId?: string;
  schoolId?: string;
  /** Subject age in years; undefined treated as adult (fail-safe to stricter adult-consent path is handled by consent layer). */
  ageYears?: number;
}

export type RbacDenyReason =
  | "SELF_IMPERSONATION"
  | "CROSS_DISTRICT"
  | "CROSS_SCHOOL"
  | "ADMIN_TARGET_FORBIDDEN"
  | "OUT_OF_SCOPE";

export interface RbacResult {
  allowed: boolean;
  reason: RbacDenyReason | null;
  /** When impersonating another admin role, a break-glass code is required. */
  requiresBreakGlass: boolean;
}

const ADMIN_ROLES = new Set<AnyRole>(["platform_admin", "district_admin", "school_admin"]);

/**
 * The impersonation RBAC matrix:
 *   platform_admin → any user (admin targets require break-glass).
 *   district_admin → any user in their district EXCEPT other district/platform admins.
 *   school_admin   → learners/teachers/parents in their school only.
 *
 * Impersonating another admin role is forbidden for everyone except
 * platform_admin with a documented break-glass code (signalled via
 * requiresBreakGlass).
 */
export function evaluateRbac(actor: Actor, subject: Subject): RbacResult {
  if (actor.userId === subject.userId) {
    return { allowed: false, reason: "SELF_IMPERSONATION", requiresBreakGlass: false };
  }

  const subjectIsAdmin = ADMIN_ROLES.has(subject.role);

  if (actor.role === "platform_admin") {
    // Platform admin may impersonate anyone; admin targets need break-glass.
    return { allowed: true, reason: null, requiresBreakGlass: subjectIsAdmin };
  }

  // Only platform_admin may ever target an admin.
  if (subjectIsAdmin) {
    return { allowed: false, reason: "ADMIN_TARGET_FORBIDDEN", requiresBreakGlass: false };
  }

  if (actor.role === "district_admin") {
    if (!actor.districtId || subject.districtId !== actor.districtId) {
      return { allowed: false, reason: "CROSS_DISTRICT", requiresBreakGlass: false };
    }
    return { allowed: true, reason: null, requiresBreakGlass: false };
  }

  if (actor.role === "school_admin") {
    const allowedTargets = new Set<AnyRole>(["learner", "teacher", "parent"]);
    if (!allowedTargets.has(subject.role)) {
      return { allowed: false, reason: "OUT_OF_SCOPE", requiresBreakGlass: false };
    }
    if (!actor.schoolId || subject.schoolId !== actor.schoolId) {
      return { allowed: false, reason: "CROSS_SCHOOL", requiresBreakGlass: false };
    }
    return { allowed: true, reason: null, requiresBreakGlass: false };
  }

  return { allowed: false, reason: "OUT_OF_SCOPE", requiresBreakGlass: false };
}

// ── Consent rules ───────────────────────────────────────────────────────────

export interface ConsentContext {
  /** Subject (or guardian) has consent recorded in consent_ledger. */
  hasSubjectConsent?: boolean;
  hasGuardianConsent?: boolean;
  /** A documented justification ticket id (e.g. support/PAM ticket). */
  justificationTicketId?: string | null;
  /** An open compliance/safety incident covering this subject. */
  hasOpenIncident?: boolean;
  /** Platform-admin explicit override (adult subjects only). */
  platformOverride?: boolean;
  /** Documented break-glass code (required to target admins). */
  breakGlassCode?: string | null;
}

export type ConsentBasis =
  | "SUBJECT_CONSENT"
  | "GUARDIAN_CONSENT"
  | "JUSTIFICATION_TICKET"
  | "OPEN_INCIDENT"
  | "PLATFORM_OVERRIDE"
  | "BREAK_GLASS";

export type ConsentDenyReason =
  | "TENANT_DISABLED"
  | "MINOR_NO_GUARDIAN_CONSENT"
  | "ADULT_NO_BASIS"
  | "BREAK_GLASS_REQUIRED";

export interface ConsentResult {
  allowed: boolean;
  basis: ConsentBasis | null;
  reason: ConsentDenyReason | null;
}

const ADULT_AGE = 18;

/**
 * Resolve whether impersonation of `subject` is permitted given consent
 * context. Each allowed path returns a distinct `basis` so the audit log can
 * record exactly which legal/operational basis was used.
 */
export function evaluateConsent(
  subject: Subject,
  consent: ConsentContext,
  tenant: TenantImpersonationSettings,
  rbac: RbacResult,
): ConsentResult {
  if (!tenant.enabled) {
    return { allowed: false, basis: null, reason: "TENANT_DISABLED" };
  }

  // Targeting an admin requires a documented break-glass code (in addition to
  // platform_admin RBAC, enforced separately).
  if (rbac.requiresBreakGlass && !consent.breakGlassCode) {
    return { allowed: false, basis: null, reason: "BREAK_GLASS_REQUIRED" };
  }

  // Minor subjects: guardian consent on file OR an open compliance/safety
  // incident. (Justification tickets and platform overrides do NOT bypass
  // guardian consent for minors.)
  const isMinor = subject.ageYears !== undefined && subject.ageYears < ADULT_AGE;
  if (isMinor) {
    if (consent.hasGuardianConsent) {
      return { allowed: true, basis: "GUARDIAN_CONSENT", reason: null };
    }
    if (consent.hasOpenIncident) {
      return { allowed: true, basis: "OPEN_INCIDENT", reason: null };
    }
    return { allowed: false, basis: null, reason: "MINOR_NO_GUARDIAN_CONSENT" };
  }

  // Adult subjects: subject consent OR documented justification ticket OR
  // explicit platform-admin override (each a distinct, audited basis).
  if (consent.breakGlassCode && rbac.requiresBreakGlass) {
    return { allowed: true, basis: "BREAK_GLASS", reason: null };
  }
  if (consent.hasSubjectConsent) {
    return { allowed: true, basis: "SUBJECT_CONSENT", reason: null };
  }
  if (consent.justificationTicketId) {
    return { allowed: true, basis: "JUSTIFICATION_TICKET", reason: null };
  }
  if (consent.platformOverride) {
    return { allowed: true, basis: "PLATFORM_OVERRIDE", reason: null };
  }
  return { allowed: false, basis: null, reason: "ADULT_NO_BASIS" };
}

// ── Claim builder ───────────────────────────────────────────────────────────

export interface ImpersonationClaims {
  /** Impersonated user (authorization subject for reads). */
  sub: string;
  tenantId: string;
  role: string;
  availableRoles?: string[];
  /** Acting admin's user id. */
  act: string;
  imp: true;
  imp_exp: number;
  imp_writes_ok: boolean;
  imp_reason: string;
  imp_sid: string;
  email?: string;
  name?: string;
}

export interface BuildClaimsInput {
  actorId: string;
  subject: Subject;
  reason: string;
  ttlSeconds: number;
  allowWrites: boolean;
  sessionId: string;
  subjectEmail?: string;
  subjectName?: string;
  subjectAvailableRoles?: string[];
  now?: number;
}

/**
 * Build the impersonation JWT payload. `imp_exp` is set from the clamped TTL
 * so the token cannot outlive the impersonation window even if the JWT `exp`
 * were (incorrectly) longer.
 */
export function buildImpersonationClaims(input: BuildClaimsInput): ImpersonationClaims {
  const nowSec = Math.floor((input.now ?? Date.now()) / 1000);
  return {
    sub: input.subject.userId,
    tenantId: input.subject.tenantId,
    role: input.subject.role,
    availableRoles: input.subjectAvailableRoles ?? [input.subject.role],
    act: input.actorId,
    imp: true,
    imp_exp: nowSec + input.ttlSeconds,
    imp_writes_ok: input.allowWrites,
    imp_reason: input.reason,
    imp_sid: input.sessionId,
    email: input.subjectEmail,
    name: input.subjectName,
  };
}

/** True when an impersonation token has passed its `imp_exp` hard expiry. */
export function isImpersonationExpired(impExp: number | undefined, now = Date.now()): boolean {
  if (!impExp) return true;
  return Math.floor(now / 1000) >= impExp;
}

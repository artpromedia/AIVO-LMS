/**
 * Role-context enricher — ADR 0020 Phase 4, slice 4.6.
 *
 * Every analytics event, structured log line, and trace span we emit
 * needs to be sliceable by `activeRole` and `availableRoles` so
 * dashboards, alerts, and post-incident reviews can answer "did this
 * regression hit therapists or only parents?" without separate apps
 * per role.
 *
 * The enricher is intentionally tiny and side-effect-free: it
 * accepts a `roleSession`-shaped record (the same shape `@aivo/nav`
 * exports as `RoleSession`, but typed loosely here so this package
 * stays free of a nav dependency) and returns a flat key/value
 * extension to merge into any payload. Use it from
 * `safe-logger`-style payloads, from `learning-traces` baggage, and
 * from the Fastify / FastAPI request contexts.
 *
 * Missing-session paths stamp a sentinel
 * `activeRole: "anonymous"` so dashboards don't silently drop the
 * field — better to count "anonymous" hits than to have them
 * disappear from the slice.
 */

import { redactForLogging } from "./safe-logger.js";

/**
 * Loose shape of the role session the enricher consumes. Mirrors the
 * `RoleSession` interface in `@aivo/nav` but kept here as a local
 * type so this package doesn't depend on nav at compile time.
 */
export interface RoleContextSession {
  id?: string;
  tenantId?: string;
  roles?: readonly string[];
  activeRole?: string;
}

/** The fields the enricher stamps onto every event. */
export interface RoleContextFields {
  /** Active role at emit time. `"anonymous"` when no session. */
  activeRole: string;
  /** Sorted list of every role the user holds. Empty when no session. */
  availableRoles: readonly string[];
  /** Tenant id, when known. */
  tenantId?: string;
  /** User id, when known. */
  userId?: string;
}

/** Sentinel emitted when the enricher runs without a session. */
export const ANONYMOUS_ROLE = "anonymous";

/**
 * Pure helper: derive the role-context fields from a session-like
 * record. Use this from anywhere that needs the canonical key set
 * (logs, metrics labels, trace attributes).
 *
 * The returned object is safe to pass directly to
 * `redactForLogging` — the enricher already strips any string that
 * looks like an email/JWT/etc. via the parent logger's redactor.
 */
export function roleContextBase(
  session?: RoleContextSession | null,
): RoleContextFields {
  if (!session) {
    return { activeRole: ANONYMOUS_ROLE, availableRoles: [] };
  }
  const roles = Array.isArray(session.roles) ? [...session.roles].sort() : [];
  const out: RoleContextFields = {
    activeRole: session.activeRole ?? ANONYMOUS_ROLE,
    availableRoles: roles,
  };
  if (session.tenantId) out.tenantId = session.tenantId;
  if (session.id) out.userId = session.id;
  return out;
}

/**
 * Merge the role-context fields into a structured payload. The
 * payload's existing keys win on collision so a caller-provided
 * `activeRole` (e.g. from a forwarded baggage header) is preserved.
 *
 * The returned object is sanitised through the standard
 * `safe-logger` redactor so a session that somehow holds a sensitive
 * value can't leak into logs via this enricher.
 */
export function withRoleContext<T extends Record<string, unknown>>(
  payload: T,
  session?: RoleContextSession | null,
): T & RoleContextFields {
  const base = roleContextBase(session);
  const merged: Record<string, unknown> = { ...base, ...payload };
  // Preserve types for the canonical role-context fields by re-asserting.
  return redactForLogging(merged) as T & RoleContextFields;
}

/**
 * Trace-span attribute helper. OpenTelemetry / `withSpan` accept a
 * flat `Record<string, string>`; this helper produces the right
 * shape from a session.
 */
export function roleContextAttributes(
  session?: RoleContextSession | null,
): Record<string, string> {
  const base = roleContextBase(session);
  const out: Record<string, string> = {
    "aivo.active_role": base.activeRole,
    "aivo.available_roles": base.availableRoles.join(","),
  };
  if (base.tenantId) out["aivo.tenant_id"] = base.tenantId;
  if (base.userId) out["aivo.user_id"] = base.userId;
  return out;
}

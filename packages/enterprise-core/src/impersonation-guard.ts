/**
 * Impersonation request guard (Sprint 9) — shared across every service.
 *
 * When a request arrives with an impersonation token (`imp === true`), the
 * auth middleware:
 *   - authorizes READS using the impersonated user's roles (`sub`),
 *   - BLOCKS writes unless `imp_writes_ok === true` AND the route is on the
 *     service's write allowlist,
 *   - rejects tokens past their `imp_exp` hard expiry,
 *   - emits an `auth.impersonation.request` audit event for every request
 *     and `auth.impersonation.write_blocked` / `write_allowed` for writes.
 *
 * These helpers are pure so the confused-deputy / audit-evasion rules are
 * fully unit-testable; the Fastify integration lives in fastify-auth.ts.
 */

export interface ImpersonationClaimView {
  imp?: boolean;
  act?: string;
  sub?: string;
  imp_exp?: number;
  imp_writes_ok?: boolean;
  imp_reason?: string;
  imp_sid?: string;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isImpersonation(claims: ImpersonationClaimView | null | undefined): boolean {
  return !!claims && claims.imp === true && typeof claims.act === "string";
}

export function isWriteMethod(method: string | undefined): boolean {
  return WRITE_METHODS.has((method ?? "GET").toUpperCase());
}

export function isImpersonationExpired(
  claims: ImpersonationClaimView,
  now = Date.now(),
): boolean {
  if (typeof claims.imp_exp !== "number") return true;
  return Math.floor(now / 1000) >= claims.imp_exp;
}

/**
 * A write allowlist matches (method, path) pairs that are explicitly safe to
 * perform under impersonation when `imp_writes_ok` is set. Entries are exact
 * method + path-prefix matches; nothing matches by default (deny-by-default).
 */
export interface ImpWriteAllowEntry {
  method: string;
  /** Path or path-prefix (matched with startsWith). */
  pathPrefix: string;
}

export type ImpWriteAllowlist = ImpWriteAllowEntry[];

export function createImpWriteAllowlist(entries: ImpWriteAllowEntry[]): ImpWriteAllowlist {
  return entries.map((e) => ({ method: e.method.toUpperCase(), pathPrefix: e.pathPrefix }));
}

export function isRouteWriteAllowlisted(
  allowlist: ImpWriteAllowlist | undefined,
  method: string,
  path: string,
): boolean {
  if (!allowlist || allowlist.length === 0) return false;
  const m = (method ?? "GET").toUpperCase();
  const p = path.split("?")[0];
  return allowlist.some((e) => e.method === m && p.startsWith(e.pathPrefix));
}

export type ImpWriteDecision =
  | { kind: "not_impersonation" }
  | { kind: "read_allowed" }
  | { kind: "expired" }
  | { kind: "write_allowed" }
  | { kind: "write_blocked"; reason: "writes_disabled" | "route_not_allowlisted" };

/**
 * The single decision function the middleware calls per request. It encodes
 * the full impersonation enforcement policy in one place.
 */
export function decideImpersonatedRequest(
  claims: ImpersonationClaimView | null | undefined,
  method: string,
  path: string,
  allowlist: ImpWriteAllowlist | undefined,
  now = Date.now(),
): ImpWriteDecision {
  if (!isImpersonation(claims)) return { kind: "not_impersonation" };
  const c = claims as ImpersonationClaimView;

  if (isImpersonationExpired(c, now)) return { kind: "expired" };

  if (!isWriteMethod(method)) return { kind: "read_allowed" };

  if (!c.imp_writes_ok) {
    return { kind: "write_blocked", reason: "writes_disabled" };
  }
  if (!isRouteWriteAllowlisted(allowlist, method, path)) {
    return { kind: "write_blocked", reason: "route_not_allowlisted" };
  }
  return { kind: "write_allowed" };
}

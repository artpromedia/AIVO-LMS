/**
 * Phase 1 — Pure logic for `POST /api/bff/me/active-role`.
 *
 * Kept out of the Next.js route handler so it can be unit-tested under
 * vitest (which picks up files under `lib/`). The route shim in
 * `app/api/bff/me/active-role/route.ts` is the thin wrapper that
 * translates this module's outcome into HTTP + cookies.
 *
 * Contract:
 *   - Validates that the request body is `{ role: NavRole }` and that
 *     the target role is one of the eight known nav roles.
 *   - Validates that the target role is in the session's `roles[]`.
 *     A user cannot switch into a role they don't hold; the server is
 *     the only gate (ADR 0020 §4).
 *   - For roles where `ROLE_META[target].requiresStepUp === true`,
 *     verifies the `x-step-up-token` header via
 *     {@link verifyRoleChangeStepUp}.
 *   - On success, returns the cookies the route handler should write:
 *       - `aivo_active_role` (the new active role)
 *       - `aivo_session_role` (surface cookie, signed via
 *         `signSurfaceCookieValue` from `@aivo/security`, so the
 *         middleware authorization keys off the *active* role per
 *         ADR 0020 §4)
 *     and the updated `RoleSessionPayload` to return as the body.
 */
import {
  ROLE_META,
  ROLES,
  type Role as NavRole,
  type RoleSession,
} from "@aivo/nav";
import { signSurfaceCookieValue, SURFACE_COOKIE_NAME } from "@aivo/security";
import type { SessionProfile } from "@/lib/auth/types";
import {
  ACTIVE_ROLE_COOKIE,
  buildRoleSession,
  toWebRole,
  type RoleSessionPayload,
} from "@/lib/auth/role-session";
import { verifyRoleChangeStepUp } from "@/lib/auth/step-up-verify";

export interface CookieDirective {
  name: string;
  value: string;
  /** Lifetime in seconds. Required so the route handler can pass `maxAge`. */
  maxAge: number;
  /** True for cookies that must not be visible to JS (surface, active-role). */
  httpOnly: boolean;
}

export type ActiveRoleOutcome =
  | {
      ok: true;
      payload: RoleSessionPayload;
      cookies: CookieDirective[];
    }
  | {
      ok: false;
      status: number;
      code:
        | "VALIDATION_FAILED"
        | "FORBIDDEN_ROLE"
        | "STEP_UP_REQUIRED";
      message: string;
      /** Populated for STEP_UP_REQUIRED so the client can launch the right challenge. */
      stepUp?: { scope: "role:change"; reason: string };
    };

export interface ActiveRoleInputs {
  session: SessionProfile;
  body: unknown;
  /** Header lookup so the caller can pass a `Headers` instance or a plain object. */
  getHeader(name: string): string | null;
}

const ACTIVE_ROLE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SURFACE_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days, matches sign default

function isNavRole(value: unknown): value is NavRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export async function decideActiveRoleSwitch(
  inputs: ActiveRoleInputs,
): Promise<ActiveRoleOutcome> {
  const body = inputs.body as { role?: unknown } | null | undefined;
  const target = body && typeof body === "object" ? body.role : undefined;
  if (!isNavRole(target)) {
    return {
      ok: false,
      status: 400,
      code: "VALIDATION_FAILED",
      message: "Body must be { role: NavRole }",
    };
  }

  const sessionPayload = buildRoleSession(inputs.session);
  if (!sessionPayload.roles.includes(target)) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN_ROLE",
      message: `Session does not hold role ${target}`,
    };
  }

  if (ROLE_META[target].requiresStepUp) {
    const token = inputs.getHeader("x-step-up-token");
    const verify = await verifyRoleChangeStepUp({
      token,
      targetRole: target,
      userId: inputs.session.userId,
    });
    if (!verify.ok) {
      return {
        ok: false,
        status: 403,
        code: "STEP_UP_REQUIRED",
        message: `Step-up required to switch into ${target} (${verify.reason})`,
        stepUp: { scope: "role:change", reason: verify.reason },
      };
    }
  }

  // No-op switches still succeed (idempotent) but skip surface-cookie
  // re-minting since the value would be identical.
  const isNoop = sessionPayload.activeRole === target;
  const cookies: CookieDirective[] = [];
  cookies.push({
    name: ACTIVE_ROLE_COOKIE,
    value: toWebRole(target),
    maxAge: ACTIVE_ROLE_MAX_AGE_SECONDS,
    httpOnly: true,
  });
  if (!isNoop) {
    const surfaceValue = await signSurfaceCookieValue(toWebRole(target));
    cookies.push({
      name: SURFACE_COOKIE_NAME,
      value: surfaceValue,
      maxAge: SURFACE_COOKIE_TTL_SECONDS,
      httpOnly: true,
    });
  }

  const newPayload: RoleSessionPayload = {
    ...sessionPayload,
    activeRole: target,
  };
  return { ok: true, payload: newPayload, cookies };
}

/**
 * Convenience: shape of the resulting `RoleSession` the route returns,
 * re-exported so tests and the route handler share one symbol.
 */
export type { RoleSessionPayload, RoleSession };

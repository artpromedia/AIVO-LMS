/**
 * Phase 1 — Step-up verification for `POST /me/active-role`.
 *
 * ADR 0020 §4 and Phase 1 require that switching *into* any role with
 * `ROLE_META[role].requiresStepUp === true` (parent, teacher,
 * therapist, caregiver, all admin roles) presents a fresh proof of
 * identity. The token is carried as the `x-step-up-token` header so it
 * never appears in browser history, Referer, or access logs.
 *
 * Two verification paths so dev and prod can share the same route:
 *
 *   - **Mock mode** (`AUTH_MODE=mock`): accepts a deterministic
 *     `mock-stepup.<role>.<expEpoch>` token issued by the mock
 *     step-up flow. No crypto — this mode is dev-only and refuses to
 *     accept any token in production.
 *   - **Real mode**: verifies the token via `@aivo/security`'s
 *     `verifyJWT` (RS256, identity-svc-issued). Required claims:
 *       `purpose === "step-up"`, `scope === "role:change"`, and
 *       `sub === session.userId`.
 *
 * The verifier returns `{ ok: true }` on success or
 * `{ ok: false, reason }` with a stable reason string callers can
 * surface to the client. Callers must NEVER fall back to "allow on
 * verifier error" — a step-up failure must always block the switch.
 */
import { serverEnv } from "@/lib/env";
import type { Role as NavRole } from "@aivo/nav";
import { toWebRole } from "@/lib/auth/role-session";

const MOCK_PREFIX = "mock-stepup.";

export interface StepUpVerifyArgs {
  /** Raw value of the `x-step-up-token` header. */
  token: string | null | undefined;
  /** Role the caller is trying to switch into. */
  targetRole: NavRole;
  /** Authenticated user id (session.userId). */
  userId: string;
}

export type StepUpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "invalid" | "expired" | "wrong_scope" | "wrong_subject" };

export async function verifyRoleChangeStepUp(args: StepUpVerifyArgs): Promise<StepUpVerifyResult> {
  if (!args.token) return { ok: false, reason: "missing" };
  if (serverEnv.AUTH_MODE === "mock") {
    return verifyMockToken(args);
  }
  return verifyRealToken(args);
}

/**
 * Build a mock step-up token for tests and dev role-switch flows. The
 * mock flow that emits this lives outside this module; the helper is
 * exported so tests can issue tokens without duplicating the format.
 */
export function buildMockStepUpToken(targetRole: NavRole, ttlSeconds = 300): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${MOCK_PREFIX}${toWebRole(targetRole)}.${exp}`;
}

function verifyMockToken(args: StepUpVerifyArgs): StepUpVerifyResult {
  const token = args.token!;
  if (!token.startsWith(MOCK_PREFIX)) return { ok: false, reason: "invalid" };
  const rest = token.slice(MOCK_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "invalid" };
  const role = rest.slice(0, dot);
  const expStr = rest.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= 0) return { ok: false, reason: "invalid" };
  if (exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };
  if (role !== toWebRole(args.targetRole)) return { ok: false, reason: "wrong_scope" };
  return { ok: true };
}

async function verifyRealToken(args: StepUpVerifyArgs): Promise<StepUpVerifyResult> {
  // Lazy-load to keep the @aivo/security dependency (and its filesystem
  // JWT key bootstrap) off the hot path for mock-mode dev servers.
  const { verifyJWT } = await import("@aivo/security");
  type StepUpClaims = {
    sub?: string;
    purpose?: string;
    scope?: string;
    role?: string;
  };
  let claims: StepUpClaims;
  try {
    claims = (await verifyJWT(args.token!)) as StepUpClaims;
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (claims.purpose !== "step-up") return { ok: false, reason: "wrong_scope" };
  if (claims.scope !== "role:change") return { ok: false, reason: "wrong_scope" };
  if (claims.sub !== args.userId) return { ok: false, reason: "wrong_subject" };
  return { ok: true };
}

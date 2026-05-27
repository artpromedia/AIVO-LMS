/**
 * Sprint 12: Active learner selection.
 *
 * For roles with multiple potential learners (currently `parent` — multiple
 * children) we keep the currently-selected learner in a cookie. The cookie
 * is set via POST `/api/bff/active-learner` and read in two places: BFF
 * route handlers (Request) and server components (next/headers cookies()).
 *
 * For the `learner` role the active learner is always `session.learnerId`;
 * the cookie is ignored. This keeps cross-tenant or cross-learner data
 * leaks impossible by construction.
 */
import { cookies } from "next/headers";
import type { SessionProfile } from "@/lib/auth/types";
import { listLearnersForParent, getLearner } from "@/lib/db/repos";

export const ACTIVE_LEARNER_COOKIE = "aivo_active_learner_id";

function parseId(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_]{3,80}$/.test(trimmed) ? trimmed : null;
}

/** Server-component reader. Resolves to an authorized learnerId for `session`. */
export async function readActiveLearnerFromCookies(
  session: SessionProfile,
): Promise<string | null> {
  if (session.role === "learner") return session.learnerId ?? null;
  const jar = await cookies();
  const candidate = parseId(jar.get(ACTIVE_LEARNER_COOKIE)?.value);
  if (!candidate) return null;
  return verifyActiveLearner(session, candidate);
}

/** Edge / route-handler reader. */
export async function readActiveLearnerFromRequest(
  req: Request,
  session: SessionProfile,
): Promise<string | null> {
  if (session.role === "learner") return session.learnerId ?? null;
  const header = req.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${ACTIVE_LEARNER_COOKIE}=`));
  const candidate = parseId(match?.split("=")[1]);
  if (!candidate) return null;
  return verifyActiveLearner(session, candidate);
}

/**
 * Authorize a candidate learnerId for this session. Returns the id when the
 * session is permitted to view that learner, otherwise null. Parents must
 * have a ParentLearnerRelationship; staff must share tenant.
 */
export async function verifyActiveLearner(
  session: SessionProfile,
  candidate: string,
): Promise<string | null> {
  if (session.role === "parent") {
    const linked = await listLearnersForParent(session.userId, session.tenantId);
    return linked.some((l) => l.id === candidate) ? candidate : null;
  }
  // teacher / school_admin / district_admin / platform_admin must at least
  // share the tenant. (Classroom-level scoping arrives in Sprint 18.)
  const learner = await getLearner(candidate, session.tenantId);
  return learner ? candidate : null;
}

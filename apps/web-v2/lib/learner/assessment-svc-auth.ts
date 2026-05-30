/**
 * Mint a short-lived, learner-scoped JWT for the assessment-svc streaming
 * routes.
 *
 * assessment-svc's `authenticate` verifies an RS256 JWT (via
 * `@aivo/security`) and then `checkAccess` matches the token `sub` to the
 * learner: LEARNER → `learner.userId`, PARENT → `learner.parentId`. So the
 * runner forwards a token signed with the *acting user's* id and role,
 * rather than a static service token that the service would reject for a
 * user-scoped route.
 *
 * Deployment note: web-v2 and assessment-svc must share the
 * `@aivo/security` signing keys (same key dir / provisioned secret) for the
 * minted token to verify across services. When keys aren't shared or the
 * role isn't user-scoped, the caller falls back to the configured service
 * token and the streaming path degrades to the local adaptive path on a
 * 401.
 */
import { signJWT } from "@aivo/security";

/** web-v2 session roles that map to an assessment-svc principal. */
const ROLE_MAP: Record<string, "LEARNER" | "PARENT"> = {
  learner: "LEARNER",
  parent: "PARENT",
};

export interface MintTokenSession {
  userId: string;
  role: string;
}

/**
 * Returns a signed JWT for the session, or `null` when the role has no
 * assessment-svc principal or signing fails (caller should fall back).
 */
export async function mintAssessmentSvcToken(session: MintTokenSession): Promise<string | null> {
  const role = ROLE_MAP[session.role];
  if (!role) return null;
  try {
    return await signJWT({ sub: session.userId, role }, "10m");
  } catch {
    return null;
  }
}

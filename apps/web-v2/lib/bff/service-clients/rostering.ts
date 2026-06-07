/**
 * Reads the teacher rostering grant from identity-svc.
 *
 * The source of truth is the district setting
 * `featureOverrides.teacherRosteringEnabled`, exposed to the caller's own
 * tenant via identity-svc `GET /api/rostering/teacher-grant`. Used by the
 * teacher rostering guard in `AIVO_USE_IDENTITY_SVC` mode; the in-memory
 * `rostering-grants` store backs mock mode.
 *
 * Returns `null` on any missing-token / network / non-OK condition so the
 * caller can fall back (default-deny) rather than throw.
 */

// Mirrors IDENTITY_ACCESS_TOKEN_COOKIE in @/lib/auth/identity-client without
// importing that server-only module into the guard's import graph.
const IDENTITY_ACCESS_TOKEN_COOKIE = "aivo_access_token";
const TIMEOUT_MS = 4000;

export async function fetchTeacherRosteringGrant(): Promise<boolean | null> {
  try {
    const { cookies } = await import("next/headers");
    const token = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
    if (!token) return null;
    const baseUrl = process.env.IDENTITY_SVC_URL || "http://localhost:3001";
    const res = await fetch(`${baseUrl}/api/rostering/teacher-grant`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { enabled?: boolean };
    return Boolean(json.enabled);
  } catch {
    return null;
  }
}

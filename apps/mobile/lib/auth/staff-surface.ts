/**
 * Staff / district sign-in surface routing (#4).
 *
 * The consumer login endpoint (`/api/auth/login`) deliberately bounces
 * internal-staff and district-admin accounts off the consumer surface with a
 * `403` whose body carries a `wrongSurface` hint (`"admin"` or `"district"`)
 * and a `redirectTo` URL. On the web those users are redirected to the admin /
 * district sign-in hosts. Mobile has a single sign-in screen, so instead of a
 * redirect we transparently retry the same email/password against the correct
 * identity-svc endpoint — letting staff and district admins sign in on mobile
 * with the existing form and MFA flow.
 */

/** identity-svc endpoints for the non-consumer sign-in surfaces. */
export const STAFF_LOGIN_ENDPOINTS = {
  admin: "/api/auth/admin-login",
  district: "/api/auth/district-login",
} as const;

export type WrongSurface = keyof typeof STAFF_LOGIN_ENDPOINTS;

/**
 * Given the status + parsed body of a consumer-login response, return the
 * identity-svc endpoint to retry against, or `null` when no retry applies.
 *
 * Only a `403` carrying a recognised `wrongSurface` hint triggers a retry; any
 * other status (including ordinary `401` invalid-credentials) is left for the
 * caller's normal error handling.
 */
export function staffLoginEndpointFor(status: number, body: unknown): string | null {
  if (status !== 403) return null;
  const surface = (body as { wrongSurface?: unknown } | null | undefined)?.wrongSurface;
  if (surface === "admin") return STAFF_LOGIN_ENDPOINTS.admin;
  if (surface === "district") return STAFF_LOGIN_ENDPOINTS.district;
  return null;
}

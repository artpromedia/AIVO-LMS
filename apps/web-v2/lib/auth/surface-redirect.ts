/**
 * Helpers for handling the "wrong surface" path returned by identity-svc.
 *
 * When a user signs in on a surface that doesn't match their role (e.g. a
 * platform admin lands on the consumer /login from the marketing site),
 * identity-svc returns HTTP 403 with a `redirectTo` URL pointing at the
 * correct portal. The login server actions use these helpers to forward
 * the user instead of leaving them stuck on `?error=wrong_surface`.
 */

/**
 * Allow only:
 *   - relative paths starting with "/" (same-origin dev / preview env)
 *   - absolute https URLs on the aivolearning.com apex or subdomains.
 *
 * Rejects everything else so a compromised identity-svc response cannot
 * be used as an open redirect to an arbitrary host.
 */
export function isSafeSurfaceRedirect(url: string | undefined | null): url is string {
  if (!url || typeof url !== "string") return false;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return /(^|\.)aivolearning\.com$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

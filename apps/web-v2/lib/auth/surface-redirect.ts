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

export type WrongSurface = "admin" | "district";

export function isKnownWrongSurface(value: string | undefined | null): value is WrongSurface {
  return value === "admin" || value === "district";
}

/**
 * Only follow wrong-surface redirects for known target surfaces and only when
 * the target host matches that surface (or is a same-origin relative path in
 * dev/preview environments).
 */
export function isAllowedWrongSurfaceRedirect(
  wrongSurface: string | undefined | null,
  redirectTo: string | undefined | null,
): redirectTo is string {
  if (!isSafeSurfaceRedirect(redirectTo)) return false;

  const inferredSurface: WrongSurface | null = (() => {
    if (isKnownWrongSurface(wrongSurface)) return wrongSurface;
    if (redirectTo.startsWith("/admin/district")) return "district";
    if (redirectTo.startsWith("/admin")) return "admin";
    try {
      const hostname = new URL(redirectTo).hostname.toLowerCase();
      if (hostname === "district.aivolearning.com") return "district";
      if (hostname === "admin.aivolearning.com") return "admin";
    } catch {
      // ignore parse failures; safety is enforced by isSafeSurfaceRedirect.
    }
    return null;
  })();

  if (!inferredSurface) return false;
  if (redirectTo.startsWith("/")) {
    return (
      (inferredSurface === "district" && redirectTo.startsWith("/admin/district")) ||
      (inferredSurface === "admin" && redirectTo.startsWith("/admin"))
    );
  }

  try {
    const hostname = new URL(redirectTo).hostname.toLowerCase();
    if (inferredSurface === "admin") return hostname === "admin.aivolearning.com";
    return hostname === "district.aivolearning.com";
  } catch {
    return false;
  }
}

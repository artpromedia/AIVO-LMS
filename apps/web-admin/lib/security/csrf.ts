/**
 * CSRF guard for state-changing requests (Sprint A3, ZAP #65/#73
 * "Absence of Anti-CSRF Tokens").
 *
 * Strategy (OWASP "verifying origin with standard headers"):
 *   - Mutating methods (POST/PUT/PATCH/DELETE) from a BROWSER must prove
 *     same-origin: `Sec-Fetch-Site: same-origin|none` (every evergreen
 *     browser sends it), or an `Origin` header matching the request host.
 *   - Requests carrying NEITHER header are not browser-ambient requests
 *     (service-to-service calls, webhooks, curl) — cookies aren't attached
 *     cross-site by those clients, so they pass.
 *   - This composes with the session cookies' `SameSite=Lax`
 *     (packages/admin-auth session-cookies) and Next Server Actions' built-in
 *     origin checks; see docs/security/csrf.md for the full model.
 *
 * Wired centrally in middleware.ts for every mutating request so new
 * routes are covered by default.
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface CsrfVerdict {
  ok: boolean;
  reason?: "sec-fetch-cross-site" | "origin-mismatch";
}

export function checkSameOrigin(req: {
  method: string;
  headers: { get(name: string): string | null };
  url: string;
}): CsrfVerdict {
  if (!MUTATING.has(req.method.toUpperCase())) return { ok: true };

  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite) {
    if (secFetchSite === "same-origin" || secFetchSite === "none") return { ok: true };
    return { ok: false, reason: "sec-fetch-cross-site" };
  }

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const requestHost = req.headers.get("x-forwarded-host") ?? new URL(req.url).host;
      if (originHost === requestHost) return { ok: true };
    } catch {
      // fall through — malformed Origin is rejected below
    }
    return { ok: false, reason: "origin-mismatch" };
  }

  // No browser fetch-metadata and no Origin: not a cookie-bearing
  // cross-site browser request (non-browser client / same-site GET nav).
  return { ok: true };
}

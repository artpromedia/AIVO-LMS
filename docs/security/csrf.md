# CSRF protection model (Sprint A3)

Closes the "Absence of Anti-CSRF Tokens" classes in ZAP baseline reports
#65 / #73. Three independent layers must all fail for a CSRF to land:

## 1. SameSite=Lax session cookies
Every auth cookie web-v2 and web-admin set (`aivo_access_token`,
`aivo_session`, `aivo_refresh_token`, mock/MFA/role cookies) carries
`SameSite=Lax; HttpOnly; Secure(prod)` — browsers do not attach them to
cross-site subresource or form POSTs. See
`apps/web-v2/lib/auth/session-cookies.ts` and
`packages/admin-auth/src/session-cookies.ts`.

## 2. Fetch-metadata / Origin verification (server-side, central)
`checkSameOrigin()` rejects every mutating request (POST/PUT/PATCH/DELETE)
whose `Sec-Fetch-Site` is not `same-origin`/`none`, falling back to an
`Origin`-vs-host comparison (honoring `x-forwarded-host`) for engines
without fetch metadata. Requests with neither header (service-to-service,
webhooks, curl) pass — they are not browser-credentialed cross-site
requests, which is the CSRF threat model.

- web-v2: `lib/bff/csrf.ts`, enforced in `middleware.ts` for every
  `/api/bff/*` route (the `/api/bff/csp-report` sink is exempt, as
  report-uri deliveries are specced without same-origin semantics).
- web-admin: `lib/security/csrf.ts`, enforced in `middleware.ts` for every
  mutating request.

Unit coverage: `apps/web-v2/lib/bff/csrf.test.ts` (cross-site reject,
origin mismatch reject, proxied host pass, webhook pass).

## 3. Next.js Server Actions origin checks
All web-admin mutations are Server Actions; Next verifies the Action
request's `Origin` against the `Host`/`X-Forwarded-Host` itself before
invoking the action.

## Why not synchronizer tokens?
Per-form tokens add server state and template plumbing without adding
protection on top of layers 1–3 for an app whose APIs are same-origin
only (CORS is not opened to any other origin). If a future surface opens
CORS to partner origins, introduce double-submit tokens for those routes
at that time.

# apps/web-v2 deployment runbook

`apps/web-v2` is the Next.js 15 dashboard implementing the Sprint 0-24 build
sequence on top of an in-memory data store. It is **not** the production
marketing site (that ships from `apps/marketing` to `aivolearning.com`).

## Build & run

```
pnpm install
pnpm --filter @aivo/web-v2 build
PORT=5000 pnpm --filter @aivo/web-v2 start
```

`@aivo/web-v2` now runs `pnpm --filter @aivo/brand build` before `dev`, `build`,
and `start`, so brand token CSS + Tailwind preset artifacts are generated
automatically even when `packages/brand/dist/` is empty.

For Replit/local supervisor workflows, use:

```
bash scripts/start-web-v2.sh
```

Dev mode uses Turbopack and `next dev`. Production binds to `0.0.0.0:$PORT`.

## Required environment

| Variable                | Required in prod | Notes                                          |
| ----------------------- | ---------------- | ---------------------------------------------- |
| `NODE_ENV`              | yes              | `production` enables HSTS + strict envs.       |
| `NEXT_PUBLIC_AUTH_MODE` | yes              | Must be `production` once a real IdP is wired. |
| `PORT`                  | yes              | Bind port for `next start`.                    |

Mock auth is intentionally still active (Sprint 24 ships the data layer;
provider swap is its own deliverable). The root layout renders a yellow
banner in any environment where `NEXT_PUBLIC_AUTH_MODE !== "production"`.

## Security headers

`next.config.ts` registers a `headers()` block that returns:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- `X-DNS-Prefetch-Control: off`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  (production only)

## Rate limits

`lib/bff/rate-limit.ts` exposes a memory token-bucket limiter. Applied to:

- `POST /api/bff/learners/:id/context/generate`
- `POST /api/bff/learners/:id/lesson-runs`
- `POST /api/bff/learners/:id/homework`

Defaults: burst 12, refill 10/min per user/route. Replace with a Redis-backed
limiter before multi-instance deployment.

## Upload limits

`lib/validators/iep.ts` is the canonical source of the IEP upload caps
(`IEP_MAX_BYTES = 10 MiB` and the MIME allow-list — PDF, DOC, DOCX, plain
text). `lib/upload-limits.ts` re-exports those constants so callers cannot
drift out of sync. The upload route enforces both bytes and content type.

## Consent enforcement (COPPA)

`lib/bff/consent-guard.ts` exposes `requireLearnerConsent(session, learnerId,
types[], requestId)` — a no-op when the learner is 13+ or no age gate exists.
For under-13 learners, every supplied `ConsentType` must have an active
(non-revoked) record either per-learner or account-wide for the acting
parent. Currently wired into the AI-generation routes
(`context/generate`, `lesson-runs` POST, `homework` POST). Apply it to any
new route that persists or generates learner-derived data.

IP addresses captured at consent acceptance are SHA-256 hashed with a
per-deploy salt (`IP_HASH_SALT` env, fallback constant) and truncated to 32
hex chars — see `hashIpFromRequest` in `consent-guard.ts`. Raw IPs are never
stored.

## Route audit (Sprint 22)

```
BASE_URL=http://localhost:5000 node apps/web-v2/scripts/route-audit.mjs
```

The script enumerates every `page.tsx`, probes each static route across every
demo role, asserts no `href="/..."` literal is a dead link, and fails on any
`ComingSoon` / "Ships in Sprint" string in `app/`.

## Reset / re-seed

Restart the `Web App` workflow. The in-memory store is created lazily on the
first request after boot and re-seeded via `lib/db/seed.ts`.

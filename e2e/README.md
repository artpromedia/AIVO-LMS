# AIVO end-to-end tests

Playwright suite for cross-app browser flows that cannot be covered by
service-level unit tests.

## Run locally

```bash
cd e2e
npm install
npx playwright install chromium
WEB_BASE_URL=http://localhost:5000 npm test
```

The repository-level `pnpm test` command intentionally excludes this package.
It is the deterministic, sequential unit/service test gate and does not start
the live service mesh required by these Playwright scenarios. Run the full
browser suite explicitly from the repository root with:

```bash
pnpm test:e2e
```

The Sprint 12 compose-backed subset runs sequentially with:

```bash
docker compose -f docker-compose.e2e.yml up -d --wait
pnpm test:e2e:sprint12
docker compose -f docker-compose.e2e.yml down -v
```

The DISTRICT_ADMIN-rejection test is auto-skipped unless you provide seeded
credentials:

```bash
E2E_DISTRICT_ADMIN_EMAIL=district-admin@example.org \
E2E_DISTRICT_ADMIN_PASSWORD=... \
npm test
```

## What's covered today

- `tests/admin-district-split.spec.ts` — Sprint 1 auth-surface split:
  district login page renders and posts to `/api/auth/district-login`,
  consumer `/login` rejects DISTRICT_ADMIN with a "Go to staff sign-in"
  link pointing at the standalone district host's `/login`.
- `tests/admin-host-routing.spec.ts` — verifies the standalone admin host
  redirects unauthenticated `/platform` requests to `/login` and, when
  platform-admin credentials are configured, covers login, MFA, and the
  `/platform` landing page.

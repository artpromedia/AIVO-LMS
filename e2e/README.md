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
  link pointing at `/district/login`.

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

## Journey gate (Sprint A7)

`.github/workflows/district-pilot-e2e.yml` (now titled `journeys-e2e`) is
the **blocking user-journey gate** and runs on every PR — the path filter
that used to skip it was removed. It brings up the compose `pilot`
profile (postgres, redis, identity-svc, billing-svc, comms-svc,
admin-svc, web-v2 :5000, web-admin :5001) and runs, in order:

1. `specs/district-pilot` — provisioning → parent → learner stages 0-4.
2. `specs/admin` — the standalone admin console suite, including the
   Sprint A7 journeys: `login-mfa.spec.ts` (real form → MFA challenge →
   role home, with wrong-password/wrong-code copy), 
   `pilot-provision.spec.ts` (form → tenant visible → audit row), and
   `rbac-boundaries.spec.ts` (district/school/support scope bounces).
3. The role golden paths: `tests/sprint12/{learner,parent,teacher}` and
   `tests/learner-lesson-loop.spec.ts`.

MFA journeys use identity test-mode's `seed-platform-admin`
(`mfaEnabled: true`) plus `/api/__test__/last-mfa-code/:email` via the
`seedPlatformAdmin(email, { mfaEnabled })` / `lastMfaCode()` fixtures.

The mobile golden path (`apps/mobile/.maestro/journeys/
login-lesson-offline.yaml`: login → lesson → airplane-mode answer →
reconnect → offline banner drains) runs as the `android-journey` job in
`mobile-build.yml` on an emulator, gated on the EXPO_TOKEN /
MAESTRO_LEARNER_* secrets with an explicit notice (never a false green)
when absent.

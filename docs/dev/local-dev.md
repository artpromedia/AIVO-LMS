# AIVO_LMS — Local Development Guide

Sprint 02 baseline. This guide is what a fresh developer reads before
touching code. Update it whenever a service moves ports, a new
environment variable becomes required, or a new app joins the workspace.

## Prerequisites

| Tool     | Version                                  | Notes                                                                  |
| -------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| Node.js  | `>=22`                                   | enforced by `engines.node` and CI                                      |
| pnpm     | `10.26.1`                                | enforced by `packageManager`                                           |
| Python   | `>=3.11`                                 | for `services/ai-svc`, `services/brain-svc`, `services/curriculum-svc` |
| Postgres | `>=15`                                   | `DATABASE_URL`                                                         |
| Redis    | `>=7`                                    | `REDIS_URL`                                                            |
| Expo CLI | bundled via `pnpm --filter @aivo/mobile` | for mobile dev                                                         |

## Bootstrap

```bash
# 1. install all workspaces
pnpm install --frozen-lockfile

# 2. validate the workspace shape (Sprint 00)
pnpm repo:health

# 3. validate brand assets (Sprint 01)
pnpm brand:check

# 4. build everything (turbo, cached)
pnpm build

# 5. run the production-readiness gate
pnpm prod:check

# 6. run the production-readiness test suite
pnpm test:production-readiness
```

If any of those fail on a clean clone, treat it as a P0 — Sprint 02 owns
keeping bootstrap green.

## Environment variables

Two `.env.example` files exist today:

- `./.env.example` — root template covering identity, brain, assessment,
  AI, learning, tutor, family, engagement, billing, comms, integrations,
  admin, status-page, research service URLs plus auth secrets and SSO
  client IDs.
- `./apps/web-v2/.env.example` — web-v2 specific (NEXT_PUBLIC_APP_URL,
  DATABASE_URL, REDIS_URL, AUTH_MODE, SESSION_SECRET, AI provider).

To bootstrap:

```bash
cp .env.example .env
cp apps/web-v2/.env.example apps/web-v2/.env.local
```

Then fill in `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `AUTH_SECRET`,
`SESSION_SECRET`, and whichever AI provider key you intend to use.

### Required vars per environment

| Var                                                       | Required in dev                 | Required in prod | Owner                        |
| --------------------------------------------------------- | ------------------------------- | ---------------- | ---------------------------- |
| `DATABASE_URL`                                            | yes                             | yes              | `@aivo/db`                   |
| `REDIS_URL`                                               | yes                             | yes              | scheduling, generation state |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`                      | recommended                     | yes              | identity-svc                 |
| `AUTH_SECRET`                                             | yes                             | yes              | session cookies              |
| `SESSION_SECRET`                                          | yes                             | yes              | web-v2 sessions              |
| `INTERNAL_SERVICE_TOKEN`                                  | recommended                     | yes              | service-to-service auth      |
| `OPS_ALERT_WEBHOOK_URL`                                   | optional                        | yes              | ops-alerts dispatcher        |
| `STRIPE_SECRET_KEY`                                       | optional                        | yes (Sprint 11)  | billing-svc                  |
| AI provider key (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) | optional in dev (mock provider) | yes (one of)     | ai-svc                       |

`apps/web/next.config.ts` will throw at runtime in production if any of
its required `*_SVC_URL` env vars are missing.

## Service port catalog

This is the authoritative dev-mode port map. Every service's `src/index.ts`
reads `process.env.<NAME>_PORT` first and falls back to these defaults.

| Service               | Env var                 | Dev port | Web rewrite                                            |
| --------------------- | ----------------------- | -------- | ------------------------------------------------------ |
| `identity-svc`        | `IDENTITY_SVC_URL`      | `3001`   | `/api/{admin,auth,users,avatars,consent,curriculum}/*` |
| `brain-svc`           | `BRAIN_SVC_URL`         | `3002`   | `/api/brain/*`                                         |
| `assessment-svc`      | `ASSESSMENT_PORT`       | `3003`   | `/api/{assessments,iep}/*`                             |
| `ai-svc`              | (python)                | `3004`   | `/api/ai/*`                                            |
| `learning-svc`        | `LEARNING_PORT`         | `3005`   | `/api/learning/*`                                      |
| `tutor-svc`           | `TUTOR_PORT`            | `3006`   | `/api/{tutors,tutor}/*`                                |
| `family-svc`          | `FAMILY_PORT`           | `3007`   | `/api/family/*`                                        |
| `engagement-svc`      | `ENGAGEMENT_PORT`       | `3008`   | `/api/engagement/*`                                    |
| `billing-svc`         | `BILLING_SVC_PORT`      | `3009`   | `/api/billing/*`                                       |
| `comms-svc`           | `COMMS_SVC_PORT`        | `3010`   | `/api/comms/*`                                         |
| `i18n-svc`            | `I18N_SVC_URL`          | `3011`   | `/api/i18n/*`                                          |
| `integrations-svc`    | `INTEGRATIONS_SVC_PORT` | `3012`   | `/api/integrations/*`                                  |
| `admin-svc`           | `ADMIN_SVC_PORT`        | `3013`   | (no rewrite — server-side only)                        |
| `status-page-svc`     | `STATUS_PAGE_SVC_PORT`  | `3014`   | `/api/status/*`                                        |
| `research-svc`        | `RESEARCH_SVC_PORT`     | `3015`   | `/api/research/*`                                      |
| `alerts-proxy-svc`    | `ALERTS_PROXY_SVC_PORT` | `3016`   | server-to-server                                       |
| `problem-session-svc` | `PROBLEM_SESSION_PORT`  | `3061`   | server-to-server                                       |
| `math-recognizer-svc` | `MATH_RECOGNIZER_PORT`  | `3062`   | invoked by ai-svc                                      |
| `science-solver-svc`  | `SCIENCE_SOLVER_PORT`   | `3063`   | invoked by ai-svc                                      |
| `subject-brain-svc`   | `SUBJECT_BRAIN_PORT`    | `3064`   | invoked by ai-svc                                      |
| `homework-svc`        | `HOMEWORK_PORT`         | `3065`   | (Sprint 06 wires the rewrite)                          |
| `recommendation-svc`  | `RECOMMENDATION_PORT`   | `3066`   | server-to-server                                       |
| `tenant-svc`          | `TENANT_PORT`           | `3067`   | (admin-svc fronts it)                                  |
| `integration-svc`     | `INTEGRATION_PORT`      | `3068`   | **see drift note below**                               |
| `audit-svc`           | `AUDIT_PORT`            | `3069`   | server-to-server                                       |
| `data-governance-svc` | `DATA_GOVERNANCE_PORT`  | `3070`   | (Sprint 04 wires the rewrite)                          |
| `responsible-ai-svc`  | `RESPONSIBLE_AI_PORT`   | `3071`   | invoked by ai-svc                                      |

### Web app rewrite drift to resolve (Sprint 02)

`apps/web/next.config.ts` only declares 14 service URL rewrites today,
which leaves these out of the BFF surface:

- `audit-svc` (3069)
- `data-governance-svc` (3070) — wired by Sprint 04
- `homework-svc` (3065) — wired by Sprint 06
- `responsible-ai-svc` (3071) — wired by Sprint 14
- `tenant-svc` (3067) — fronted by admin-svc, no direct rewrite
- `problem-session-svc`, `math-recognizer-svc`, `science-solver-svc`,
  `subject-brain-svc`, `recommendation-svc` — invoked by ai-svc, no
  direct rewrite

`apps/web-v2/next.config.ts` does not declare any rewrites yet. It uses
in-app route handlers that talk to services directly via the `lib/`
fetcher. That is intentional during Sprint 08's migration.

### Duplicate workspace situation

| Workspace                                 | Status                                                                                                       | Action                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `packages/ops-alert`                      | **deprecated** — `package.json#deprecated` says "use `@aivo/ops-alerts` (durable outbox + alerts-proxy-svc)" | leave in place until every legacy caller migrates; do not extend |
| `packages/ops-alerts`                     | active                                                                                                       | new code uses this                                               |
| `services/integration-svc` (port `3068`)  | active — implements SIS providers (Clever, ClassLink), LTI 1.3 launch validation                             | called by `integrations-svc` and ai-svc                          |
| `services/integrations-svc` (port `3012`) | active — implements connector REST routes, connector sync watchdog                                           | this is the BFF surface the web rewrite hits                     |

Both services are legitimate. Sprint 12 (Rostering, SIS) is the right
place to either consolidate them into a single `integrations-svc` with
internal modules, or document the split as final. Until then, both
build, test, and ship.

## Running the platform

### Web (apps/web — legacy admin + dashboards)

```bash
pnpm --filter @aivo/web dev
# http://localhost:5000
```

### Web v2 (apps/web-v2 — role-grouped role surfaces)

```bash
pnpm --filter @aivo/web-v2 dev
```

### Marketing

```bash
pnpm --filter @aivo/marketing dev
# Sprint 10 owns the production deploy gates
```

### Mobile (Expo)

```bash
pnpm --filter @aivo/mobile start
# scan QR with Expo Go, or `i` / `a` for simulator
```

### Services

Each service has its own dev script:

```bash
pnpm --filter @aivo/identity-svc dev
pnpm --filter @aivo/learning-svc dev
# ...etc
```

Or start everything via:

```bash
bash scripts/start-services.sh
```

### Database

```bash
pnpm db:push     # apply Drizzle schema
pnpm db:seed     # populate seed data
```

## Verifying your change

Before opening a PR, run these in order. Any failure must be fixed, not
documented as future work — that is the project rule from the global
prompt.

```bash
pnpm lint
pnpm test
pnpm build
pnpm api:check                # if you touched a service route
pnpm prod:check               # production-readiness gate
pnpm test:production-readiness
pnpm test:enterprise          # if you touched an enterprise feature
pnpm repo:health
pnpm brand:check
pnpm consent:audit            # if you touched a consent gate (Sprint 04)
```

CI runs the same gates. `production-gates.yml` (added in Sprint 02) runs
`repo:health`, `brand:check`, `prod:check`, and
`test:production-readiness` on every PR.

## Troubleshooting

- **`pnpm install` is slow or fails** — make sure you are on Node 22 and
  pnpm 10.26.1. Use `corepack enable && corepack prepare pnpm@10.26.1 --activate`.
- **A service won't start** — check its port isn't already bound. The
  port catalog above is the contract.
- **`apps/web` proxy returns 502** — the BFF expects each `*_SVC_URL` to
  be live. In dev, start the dependent service or set the URL to a stub.
- **`api:check` fails** — run `pnpm api:generate` and commit the
  regenerated specs in the same PR.
- **`prod:check` fails on demo content** — search for `MOCK_`,
  `placeholder`, or `coming soon` in the touched files. The scan is in
  `scripts/no-demo-prod-scan.mjs`.

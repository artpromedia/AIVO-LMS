# AIVO AI Learning Platform

> AI-powered adaptive learning platform for neurodiverse children — featuring a Brain-Clone architecture, 14 specialized AI tutors, 5 functioning levels, and a sensory-aware learning experience.

[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-10.26.1-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Turbo](https://img.shields.io/badge/turbo-2.5-EF4444?logo=turborepo&logoColor=white)](https://turbo.build)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)

---

## Table of Contents

- [Overview](#overview)
- [What's New in v2.1](#whats-new-in-v21)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Workflow](#database-workflow)
- [Running Tests](#running-tests)
- [Linting and Formatting](#linting-and-formatting)
- [Internationalization](#internationalization)
- [Design Language](#design-language)
- [Backend Boot Ordering](#backend-boot-ordering)
- [Deployment](#deployment)
- [Continuous Integration](#continuous-integration)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

AIVO is an adaptive learning platform built around five core ideas:

1. **Brain-Clone architecture** — every learner has a persistent JSONB "brain state" that drives personalization across sessions, tutors, and devices.
2. **14 specialized AI tutors** — 7 core + 7 expansion tutors with adaptive system prompts that respect each learner's functioning level.
3. **5 functioning levels** — from `STANDARD` down to `PRE_SYMBOLIC`, each level reshapes content density, sensory load, and response modalities.
4. **Discovery Adventure baseline** — an immersive 6-chapter assessment that replaces traditional quizzes with adaptive difficulty and break activities.
5. **The Stage** — a full-screen, beat-based learner experience with sensory adaptations and multiple response types.

The platform serves parents, learners, teachers, caregivers, therapists, and district admins, plus internal dashboards for sales, marketing, customer care, support, finance, and DevOps.

## What's New in v2.1

The v2.1 release lands a wide sweep of platform fixes — from the four neurodiverse-first corrections that change _how_ the agent meets a learner, through new content/curriculum services, observability and budget guardrails, and infrastructure cleanup. Everything below is implemented end-to-end (DB schema → service routes → tests / UI), not scaffolding.

### Neurodiverse-first corrections (the headline four)

1. **Adaptive multimodal baseline.** The baseline no longer asks "what grade is this kid at?" — it builds a `LearningProfile` (preferred modality, logit θ ability, frustration tolerance, attention-run-length, median latency). The Discovery Adventure derives + persists this profile via `assessment-svc/services/learning-profile.ts`, and a fully adaptive run-loop (`/api/assessments/adaptive-baseline/:learnerId/{start,respond,finalize}`) backed by `@aivo/adaptive-baseline` chooses each next item by SE-stop on a 1-PL model. Tables: `learner_profiles`, `adaptive_baseline_sessions`.
2. **Special interests as the curriculum engine.** Parents log a learner's deep interests through `family-svc/routes/interests.ts`; signals score directly via `@aivo/special-interest-engine`. The assessment service pipes the top scored theme into both `generate-discovery-chapter` and `generate-baseline` ai-svc calls, and `ai-svc/baseline_generator.py` rewrites the prompt rule when a primary theme is present: _"Build the activity AROUND `<theme>` as the primary theme — the engine, not a sprinkle."_ Word problems live in Minecraft, reading passages live in volcanoes. Table: `learner_interest_signals`.
3. **Executive-function partner.** ADHD is fundamentally an EF challenge, so the agent quietly carries the planning load. `tutor-svc/routes/ef.ts` exposes `POST /api/ef/breakdown` (a 4-step micro-plan with optional modality narrowing), `GET /api/ef/breakdown/:learnerId/:taskId` (next-step prompt + progress), step-complete endpoints (idempotent via unique index), session-outcome ledger, and `GET /api/ef/best-window/:learnerId` (best learning window endorsed only with ≥2 observations). Tables: `ef_task_breakdowns`, `ef_task_step_progress`, `ef_session_outcomes`.
4. **"What's working" parent dashboard.** `family-svc/routes/whats-working.ts` (`GET /api/family/whats-working/:learnerId?windowDays=N`) reads the real `ef_session_outcomes` ledger (capped at 5,000 rows / 365 days) through a pure analytics module, and the new `WhatsWorkingPanel` on the parent dashboard surfaces three IEP-meeting-ready signals per learner: best learning window, modality that clicks, where frustration spikes. Per-subject rate limit + payload cap address the CodeQL `js/missing-rate-limiting` finding.

### Pedagogy & content engine

- **`@aivo/pedagogy`, `@aivo/tutor-sdk`, `@aivo/tutor-runtime`.** New tutor stack scaffolded as workspace packages; tutor-runtime now consumes the special-interest engine to theme generated activities.
- **`@aivo/level-transforms` and `@aivo/special-interest-engine`.** Pure-function packages for functioning-level content reshaping and interest scoring (`scoreInterests` / `pickTheme`).
- **`@aivo/skill-graphs` and `@aivo/content-pack`.** Seed data, validators, and tests for skill-graph traversal and content-pack manifests.
- **`@aivo/item-bank` + IEP packet generator route.** Calibrated item bank package; IEP packet generator with a module-level `SIGNATURE_ROLES` constant (review nit) and a fastify route for parent/teacher exports.
- **`curriculum-svc` + `admin-svc` content-cms first cut.** New curriculum microservice plus admin-svc CMS surface; curriculum-svc wired into the CI/CD pipeline.

### Curriculum source of truth

`curriculum-svc` is the **single authoritative source** of curriculum
truth across the platform. Every standard code a learner is held to must
exist in its catalogue. LLM-driven services (`brain-svc`, `ai-svc`) may
only *personalize and scaffold* catalogue nodes — they never invent
standards, and any code an LLM proposes that is absent from the catalogue
is rejected. See:

- [ADR 0040 — Curriculum source of truth](docs/adr/0040-curriculum-source-of-truth.md)
- [ADR 0041 — Agentic boundaries (LLMs never emit authoritative standards)](docs/adr/0041-agentic-boundaries.md)
- [docs/curriculum/ARCHITECTURE.md](docs/curriculum/ARCHITECTURE.md) — target end-state (jurisdiction → framework → content pack → skill → scaffolded lesson).

### Approval & the teach-gate

One answer to *"is this child's profile approved, by whom, under which
consent?"* across both brain pipelines. A single **shared approval/consent
contract** (status enum, record shape, revision semantics) is honored by web-v2
and brain-svc; the teach gate is asserted **server-side on every lesson
pipeline** (web `createLessonRun` and the explicit `approval_status` check at
the services lesson/path-init); and every cross-role read of a child's profile
is recorded in a FERPA disclosure log with a compliance query surface. See:

- [ADR 0042 — One brain, one gate (shared approval/consent contract)](docs/adr/0042-one-brain-one-gate.md)

### Stage & learner experience

- **Stage hooks ported into packages.** `useTTS`, `useSpeechInput`, `useSensoryAdapter`, `voiceMatch`, and `StageBreakCloud` extracted from the web app into shared packages so mobile + web share one source of truth.
- **Phase 2 stage-ui.** Web stage-ui DOM components and `stage-runtime` `SessionMachine` shipped; native a11y typing fixed; RN type fix for stage-ui.
- **AAC bridge.** Vendor-certification suite plus an end-to-end eye-gaze pipeline.
- **Auth pages redesign.** Login / signup pages updated to the new design system.

### AI runtime guardrails

- **Per-tenant LLM budget caps** in `ai-svc`, with admin `status`/`reset` routes.
- **Phase 1 platform wiring:** prompt caching, budget auto-cap, and observability hooks integrated end-to-end.

### Observability & ops

- **Logger API unification.** `refactor(logging)` makes the shared logger accept both message-first and pino-style signatures; `alerts-proxy-svc`, `admin-svc` watchdog, and `ops-alerts` migrated to the new `(msg, data)` order via a legacy adapter, deprecating `@aivo/ops-alert`.
- **Mobile + ops-alerts lint cleanup.** Resolves mobile eslint import errors; marks ops-alerts stats `readonly`.

### Identity & storage

- **S3-backed avatar storage in `identity-svc`** with a proxied `GET` so clients never touch S3 directly; pnpm-lock updated for `@aws-sdk/client-s3`.

### Database & dependency hygiene

- **DB migration backfill** — `fix(db)` adds `CREATE TABLE` migrations for tables that were previously only added via `db:push`, so a fresh environment can be brought up purely from migrations.
- **Workspace dep fix** — `assessment-svc` now declares `@aivo/special-interest-engine` as a workspace dependency (was an implicit hoisted resolution).

### Internationalization

- **22 missing marketing keys** added across all non-English locales, and the remaining **21 untranslated strings** translated — bringing the i18n coverage report back to 100%.

### CI / release

- **Sprint 20 Phase 2 + Supplemental A/B/C** implementation merged.
- **Slack notification cleanup** — unused integration removed; remaining secret/job expressions in the `notify-slack-on-failure` action description are now properly escaped.
- **Code-review feedback** addressed: spelling fixes and env-var naming consistency across services.

All new HTTP routes inherit the platform auth contract (parent-on-own-kid / learner-on-self / TEACHER / ADMIN / service-token), are covered by a 120-rpm `@fastify/rate-limit` global cap on top of per-route token buckets, and ship with unit tests for the pure helpers.

## Design Language

The new **Aivo Playful Calm** design language lives in [`docs/design-language/`](./docs/design-language/README.md), with implementation in:

- `packages/brand` (layered tokens + brand assets)
- `packages/learner-ui` (playful calm primitives + patterns + motion/sound)
- `apps/web-v2` (theme/age-mode aware integration)

## Architecture

The repository is a Turborepo + pnpm workspace containing three apps, twelve shared packages, and sixteen microservices.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       Web · Marketing · Mobile (Expo)                    │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                       ┌─────────▼─────────┐
                       │   Identity Svc    │  JWT RS256, OAuth, MFA, PIN
                       └─────────┬─────────┘
       ┌─────────────────────────┼─────────────────────────┐
       │                         │                         │
┌──────▼──────┐          ┌───────▼────────┐         ┌──────▼──────┐
│  Brain Svc  │ ◄──────► │  Assessment    │ ◄─────► │  Learning   │
│  (FastAPI)  │          │     Svc        │         │     Svc     │
└──────┬──────┘          └────────────────┘         └──────┬──────┘
       │                                                   │
┌──────▼──────┐  ┌───────────┐  ┌──────────┐  ┌───────────▼─────┐
│   AI Svc    │  │ Tutor Svc │  │  Family  │  │  Engagement Svc │
│  (LiteLLM)  │  │           │  │   Svc    │  │  (XP, badges)   │
└─────────────┘  └───────────┘  └──────────┘  └─────────────────┘
                          ┌──────────────┴──────────────┐
                          │  Billing · Comms · i18n     │
                          │  Integrations · Admin       │
                          │  Status-Page · Research     │
                          └─────────────────────────────┘

                    PostgreSQL 16 (JSONB) · NATS Event Bus
```

## Tech Stack

| Layer                     | Technology                                                                      |
| ------------------------- | ------------------------------------------------------------------------------- |
| Frontend (web, marketing) | Next.js 15, React 19, Tailwind CSS v4, TypeScript 5.7                           |
| Mobile                    | React Native, Expo SDK 54, Expo Router v6, TypeScript                           |
| Backend (TypeScript)      | Fastify 5, Drizzle ORM 0.45.2, postgres-js 3.4.5                                |
| Backend (Python)          | FastAPI, uvicorn, LiteLLM (Claude Sonnet → Gemini Flash → GPT-4o-mini fallback) |
| Auth                      | JWT RS256 + refresh tokens, PIN login, Google OAuth, email-based MFA, WebAuthn  |
| Database                  | PostgreSQL 16 with JSONB brain states                                           |
| Events                    | NATS (typed event definitions in `@aivo/events`)                                |
| Email                     | Postmark (via `comms-svc`)                                                      |
| Internationalization      | `next-intl`, 10 locales including RTL Arabic                                    |
| Tooling                   | Turborepo, pnpm 10.26.1, ESLint, Prettier, cspell                               |
| Deployment                | Docker, GHCR, Hetzner                                                           |

## Repository Layout

> **See [docs/TOPOLOGY.md](docs/TOPOLOGY.md) for the canonical, always-current map.** The summary below
> is a quick-reference; if it disagrees with TOPOLOGY.md, the doc wins.

```
aivo-ai-learning/
├── apps/
│   ├── web-v2/         Next.js 15 — every role-scoped UI + the BFF API
│   ├── marketing/      Next.js 15 — public marketing site
│   └── mobile/         React Native (Expo) — iOS & Android
├── packages/
│   ├── db/             Drizzle schema + migrations + test helpers
│   ├── brand/          Color palette, typography, design tokens
│   ├── events/         NATS event type definitions
│   ├── learner-ui/     Shared web learner components
│   ├── mobile-ui/      Shared mobile components
│   ├── observability/  Pino logger + tracing
│   ├── ops-alert/      Ops alert client (webhooks)
│   ├── scheduling/     Advisory-lock scheduler + drizzle ledger
│   ├── scoring/        Assessment scoring primitives
│   ├── security/       JWT signing/verification utilities
│   └── sso/            SSO/OAuth helpers
├── services/
│   ├── identity-svc/       Auth, sessions, MFA, OAuth
│   ├── assessment-svc/     Discovery Adventure & assessments
│   ├── brain-svc/          (FastAPI) Brain-Clone state engine
│   ├── ai-svc/             (FastAPI) LLM gateway
│   ├── learning-svc/       Lessons, sessions, content
│   ├── tutor-svc/          14 AI tutors registry & dispatch
│   ├── family-svc/         Parent/learner/caregiver graph
│   ├── engagement-svc/     XP, badges, streaks, quests
│   ├── billing-svc/        Subscriptions, expiry reminders
│   ├── comms-svc/          Postmark transactional email
│   ├── i18n-svc/           Translation registry
│   ├── integrations-svc/   Google Classroom, Clever, ClassLink, Canvas
│   ├── admin-svc/          District admin tools, jobs, audit log
│   ├── status-page-svc/    Public health page
│   ├── research-svc/       Anonymized research queries
│   └── alerts-proxy-svc/   Alertmanager → ops webhooks
├── infra/              Helm charts, k8s manifests, IaC
├── docs/               Product & engineering docs
├── e2e/                Playwright end-to-end tests
└── scripts/            Build, deploy, audit helpers
```

## Prerequisites

- **Node.js** ≥ 22 (`.nvmrc` is honored)
- **pnpm** 10.26.1 (`corepack enable && corepack prepare pnpm@10.26.1 --activate`)
- **Python** 3.11+ (for `brain-svc`, `ai-svc`)
- **Docker** + Docker Compose (for local Postgres and tests)
- **PostgreSQL** 16 (locally or via Docker)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and edit environment file
cp .env.example .env
# fill in DATABASE_URL, JWT keys, service URLs, etc.

# 3. Start a local Postgres (via Docker)
docker run -d --name aivo-pg \
  -p 5432:5432 \
  -e POSTGRES_USER=aivo -e POSTGRES_PASSWORD=aivo -e POSTGRES_DB=aivo \
  postgres:16-alpine

# 4. Push schema to your dev DB
pnpm --filter @aivo/db db:push

# 5. (Optional) Seed sample data
pnpm db:seed

# 6. Run everything in dev mode
pnpm dev
```

Individual targets:

```bash
pnpm --filter web dev                # Next.js web app
pnpm --filter marketing dev          # Next.js marketing site
pnpm --filter @aivo/identity-svc dev # one specific service
```

## Environment Variables

The full list lives in [`.env.example`](.env.example). Production builds validate these at service boot — missing values throw immediately rather than silently falling back to localhost.

Key variables:

| Variable                             | Required by                              | Purpose                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                       | all backend services                     | Postgres connection string                                                                                                                                 |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | identity-svc + verifiers                 | RS256 signing keys                                                                                                                                         |
| `INTERNAL_SERVICE_TOKEN`             | learning-svc, tutor-svc, status-page-svc | Inter-service shared secret                                                                                                                                |
| `INTERNAL_AI_TOKEN`                  | tutor-svc                                | Auth for `ai-svc` curriculum calls                                                                                                                         |
| `*_SVC_URL`                          | status-page-svc, tutor-svc               | Service discovery (IDENTITY, BRAIN, ASSESSMENT, AI, LEARNING, TUTOR, FAMILY, ENGAGEMENT, BILLING, COMMS, I18N, INTEGRATIONS, ADMIN, STATUS_PAGE, RESEARCH) |
| `WEBAUTHN_ORIGINS`                   | identity-svc                             | Comma-separated WebAuthn origin allow-list                                                                                                                 |
| `POSTMARK_SERVER_TOKEN`              | comms-svc                                | Transactional email                                                                                                                                        |
| `LITELLM_*`                          | brain-svc, ai-svc                        | LLM provider keys                                                                                                                                          |

## Database Workflow

**Local / dev** — fast schema sync, no migration files:

```bash
pnpm --filter @aivo/db db:push
```

**Production** — apply numbered SQL files in order:

```bash
for f in packages/db/drizzle/*.sql; do
  psql -v ON_ERROR_STOP=1 -f "$f"
done
```

Every file in `packages/db/drizzle/` is hand-written with `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` guards, so re-applying the full set is safe on a partially synced DB.

> When you change `packages/db/src/schema/*`, also add a new numbered SQL file in `packages/db/drizzle/` so production picks it up.

## Running Tests

```bash
pnpm test                                  # all packages and services
pnpm --filter @aivo/admin-svc test         # one service
pnpm --filter @aivo/identity-svc test      # one service
```

Backend service tests use Node's built-in test runner with auto-migration:

```bash
pnpm --filter @aivo/db run build && \
pnpm --filter @aivo/db run db:migrate && \
node --test --import tsx tests/*.test.ts
```

The shared `@aivo/db` package exports `closeDb(db)` — call it in `finally` blocks so postgres-js releases its pool and the test runner exits cleanly.

End-to-end tests live in `e2e/` and use Playwright:

```bash
pnpm --filter e2e test
```

## Linting and Formatting

```bash
pnpm lint            # eslint across the workspace
pnpm i18n:audit      # locale-file parity check (web, marketing, mobile)
```

The i18n auditor fails on missing/orphan keys and warns on untranslated copy. CI enforces it via `.github/workflows/i18n-file-audit.yml`.

## Internationalization

Ten locales are supported via `next-intl`, including RTL Arabic. Translation files live alongside each app under `messages/<locale>.json`. Use `pnpm i18n:audit:verbose` to inspect coverage.

### Two gates, two questions

The repo distinguishes **key coverage** from **real translation** with two separate scripts:

| Script                                      | Asks                                                               | Mode                                                         |
| ------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `pnpm i18n:audit`                           | "Does every locale carry the same flat key set as English?"        | Blocking — runtime UIs crash if not                          |
| `node scripts/i18n-untranslated-report.mjs` | "How many non-English values are still byte-identical to English?" | Two ratchets, both blocking, neither requires a global green |

### Untranslated ratchet (`i18n-untranslated-report.mjs`)

Runs in `.github/workflows/i18n-file-audit.yml`. Two enforcement modes:

1. **Targeted-namespace gate** — for recently-shipped features (`billing`, `speech_buddy`, `onboarding`, `whats_working`, `lti_admin`) the untranslated count must stay at **0** across all 9 non-English locales. Regressions exit with code 3. New namespaces are added here when the feature ships translated.

2. **Global ratchet** — `scripts/i18n-untranslated.baseline.json` records the accepted per-locale count for each app. Counts may go **down** (re-run with `--update-threshold` to lock in the win) but never **up**. Regressions exit with code 2. This makes "we'll translate it later" impossible to ship without an explicit, reviewed bump of the baseline file.

Legitimate identical-to-English values (brand acronyms like `AIVO`/`LTI`/`OAuth`, the product name `AIVO Learning`, true cognates like French `Microphone`, universal placeholders like `Canvas — District`) are allowlisted in the report rather than fake-translated. This is QA, not green-checkmark theater.

To translate more strings: do the translation work, then run `node scripts/i18n-untranslated-report.mjs --threshold=scripts/i18n-untranslated.baseline.json --update-threshold` to ratchet the baseline down. The verbose report (`--verbose`) is uploaded as a CI artifact on every run for localization triage.

## Backend Boot Ordering

`scripts/start-services.sh` launches the ~14 Node and Python backend services in **five small groups with a brief pause between groups**, not in parallel. Fanning out all services at once exhausts the container's process / thread budget on a fresh boot (`EAGAIN` fork errors, `ERR_WORKER_INIT_FAILED` from tsx) and starves the Next.js workflows of CPU long enough to fail port-readiness checks.

Groups:

1. identity / comms / i18n
2. assessment / learning
3. tutor / family / engagement
4. billing / integrations / admin
5. status-page / research / ai-svc

Adds ~8 seconds to cold-boot time but keeps every workflow card green. **Do not collapse the groups back to a single fan-out without a corresponding bump in container resources.**

## Deployment

Production is hosted on Hetzner with images pushed to GitHub Container Registry. See:

- [`HETZNER_DEPLOYMENT_GUIDE.md`](HETZNER_DEPLOYMENT_GUIDE.md) — full step-by-step deployment guide
- [`infra/`](infra/) — Helm charts and Kubernetes manifests

Image build pipeline: GitHub Actions → GHCR → Hetzner cluster pull.

### Client data-path conventions (web-v2)

- Server components fetch on the server (repos / BFF helpers) — unchanged.
- Client components call the BFF through `bffFetch` (`apps/web-v2/lib/api/client.ts`) or a TanStack Query hook built on it; bare `fetch(` is gated by `scripts/ci/check-bare-fetch.mjs` (ratchet — the budget only goes down).
- User-visible failures surface through the toast layer (`@/lib/use-toast` + the root `<Toaster />`); lesson-critical writes ride the idempotent offline outbox.

## Continuous Integration

GitHub Actions workflows live in [`.github/workflows/`](.github/workflows/) and cover:

- Lint, type check, unit tests (per-package matrix)
- Accessibility axe gate (`web-a11y-axe`): every `@a11y`-tagged Playwright spec runs against a real web-v2 server and blocks the PR on violations — run locally with `corepack pnpm --filter @aivo/web-v2 run test:a11y`
- Background Jobs & Scheduler integration tests (admin-svc, identity-svc) with auto-migrated Postgres
- i18n file audit
- Python service builds (brain-svc, ai-svc) with `pip-audit` CVE checks
- Marketing & web Next.js production builds
- OWASP ZAP weekly security baseline scan
- Docker image build & push to GHCR

## Security

- **Auth**: JWT RS256 with refresh tokens, PIN login, Google OAuth, email-based MFA, optional WebAuthn
- **Inter-service**: `x-service-token` header with `INTERNAL_SERVICE_TOKEN`
- **Secrets scanning**: `.gitleaks.toml` enforced in CI
- **Dependencies**: `pip-audit` and `pnpm audit` run in CI
- **Web**: OWASP ZAP weekly baseline scan
- **Privacy**: COPPA consent flow built into the Brain-Clone approval pipeline
- **Tenant isolation**: Postgres RLS backstop on the core tenant tables for the non-bypassing `app_runtime` role (family-svc enforces it end-to-end; rollout playbook in `docs/security/rls-rollout.md`)
- **Audit coverage**: CI gate `scripts/ci/check-audited-writes.mjs` — service write routes must audit or carry an explicit `audit-exempt(reason)`; per-service baselines only ratchet down

Report security issues privately to the maintainers (see `SECURITY.md` if present).

## Contributing

This is a private repository. Internal contributors:

1. Branch from `main`.
2. Run `pnpm lint && pnpm test` before opening a PR.
3. For schema changes, add both `packages/db/src/schema/*` updates **and** a numbered SQL file in `packages/db/drizzle/`.
4. For new services or env vars, update `.env.example` and the relevant `*_SVC_URL` map in `status-page-svc`.
5. PRs must be green on lint, tests, i18n audit, and CodeQL before merge.

## License

Proprietary — © AIVO. All rights reserved.

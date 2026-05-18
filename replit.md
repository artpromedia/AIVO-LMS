# AIVO AI Learning Platform

## Overview

AIVO is an AI-powered adaptive learning platform designed for neurodiverse children. It features a unique "Brain-Clone" architecture, 14 specialized AI tutors, 5 functioning levels, and a sensory profiles engine. The platform aims to provide personalized education, enhancing learning outcomes for its target demographic.

## User Preferences

I prefer iterative development, with a focus on delivering functional, well-tested components in each step. I appreciate clear communication regarding design choices and potential trade-offs. Ask before making major architectural changes or introducing new external dependencies.

## System Architecture

### Monorepo Structure

The project utilizes a monorepo managed with Turborepo and pnpm, encompassing various applications and services:

- **Applications**: `web` (Next.js 15 for main dashboards and authentication), `marketing` (Next.js 15 for marketing site), `mobile` (React Native/Expo for mobile app).
- **Packages**: Shared utilities for database schema (Drizzle ORM), branding assets, mobile UI components, event definitions (NATS), observability (Pino), security (JWT), and internationalization.
- **Microservices (Fastify/Python FastAPI)**: A suite of services covering identity, assessment, brain-clone logic, AI gateway, learning sessions, tutor management, family collaboration, engagement, billing, communications, internationalization, third-party integrations, admin, status page, and research.

### Tech Stack

- **Frontend**: Next.js 15, Tailwind CSS v4, TypeScript
- **Mobile**: React Native (Expo SDK 54), Expo Router v6, TypeScript
- **Backend (TypeScript)**: Fastify 5, Drizzle ORM, PostgreSQL 16
- **Backend (Python)**: FastAPI, LiteLLM (for LLM fallback chain: Claude Opus 4.7 → Gemini 3.0 Pro → GPT-5.5)
- **Authentication**: JWT RS256 with refresh tokens, PIN login, Google OAuth, and email-based MFA.
- **Database**: PostgreSQL 16, utilizing JSONB for brain states and a Drizzle ORM managed schema.
- **Styling**: AIVO brand system with specific color palettes and game-themed fonts (Fredoka, Nunito).
- **Internationalization**: `next-intl` integration with 10 supported locales, including RTL support for Arabic. Run `pnpm i18n:audit` (or `pnpm i18n:audit:verbose`) to check locale-file parity across web, marketing, and mobile — it fails on missing/orphan keys and warns on untranslated copy. Wired into CI via `.github/workflows/i18n-file-audit.yml`.

### Database Migration Workflow

- **Local / dev**: `pnpm --filter @aivo/db db:push` syncs the schema in `packages/db/src/schema/*` directly to the dev DB. Fast, no migration files needed.
- **Production**: deploys must apply the checked-in SQL files in `packages/db/drizzle/` in numeric order (e.g. `psql -v ON_ERROR_STOP=1 -f 0000_*.sql … -f 0011_*.sql`). Every file is hand-written and uses `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so applying the full set is safe on a fresh DB or one already partially synced via `db:push`. When you add or change columns/tables in `packages/db/src/schema/*`, also add a new numbered SQL file under `packages/db/drizzle/` so production picks the change up.

### Key Features

- **Adaptive Tutors**: 14 AI tutors (7 core, 7 expansion) with adaptive system prompts based on functioning levels.
- **5 Functioning Levels**: Ranging from STANDARD to PRE_SYMBOLIC, driving content adaptation.
- **Role-Based Dashboards**: Specific dashboards for parents, learners, teachers, caregivers, therapists, and district admins, with internal dashboards for sales, marketing, customer care, support, finance, and DevOps.
- **Brain Clone & Approval Flow**: A multi-step process for creating and managing learner "brain clones," including parent assessment, baseline assessment, pre-clone review, COPPA consent, and parent modification controls.
- **Discovery Adventure**: An immersive, 6-chapter baseline assessment for learners, replacing traditional quizzes with adaptive difficulty and break activities.
- **The Stage (Learner Experience Engine)**: A full-screen immersive learning environment with beat-based lessons, sensory adaptations, and interactive response types.
- **Engagement System**: XP engine, level system, streaks, badges, virtual currency, avatar shop, quests, and multiplayer challenges.
- **Accessibility**: Comprehensive accessibility features including SkipLinks, accessible components, screen reader support, `focus-visible` styling, and automated a11y testing in CI.

## Backend Boot Ordering

The Identity Service workflow runs `scripts/start-services.sh`, which launches the ~14 Node and Python backend services. They are deliberately started in **five small groups with a brief pause between groups** rather than fanning out all at once — launching them in parallel exhausts the container's process / thread budget on a fresh boot (`EAGAIN` fork errors, `ERR_WORKER_INIT_FAILED` from tsx) and starves the Next.js workflows (`Web App`, `Marketing Site`) of CPU long enough that their port-readiness check times out. Groups: (1) identity / comms / i18n, (2) assessment / learning, (3) tutor / family / engagement, (4) billing / integrations / admin, (5) status-page / research / ai-svc. Adds ~8 seconds to cold-boot time but keeps every workflow card green. Do not collapse the groups back to a single fan-out without a corresponding bump in container resources.

## Production Deployment (Replit Autoscale)

The Replit autoscale deployment publishes the **marketing site** (Next.js, `apps/marketing`) to `aivolearning.com`. Configuration lives in `.replit`'s `[deployment]` block:

- **Build**: `rm -rf node_modules && pnpm install --frozen-lockfile --prefer-offline --filter "@aivo/marketing..." --reporter=append-only && pnpm --filter @aivo/brand run build && pnpm --filter @aivo/marketing run build && find apps -mindepth 1 -maxdepth 1 -type d ! -name marketing -exec rm -rf {} + && find packages -mindepth 1 -maxdepth 1 -type d ! -name brand -exec rm -rf {} + && rm -rf services artifacts infra e2e docs scripts .git .turbo`. Three deliberate slimming steps — _the deploy image has an 8 GiB ceiling and the full monorepo (30 workspaces, mobile + web + 14 services) blows past it_: (1) `rm -rf node_modules` before pnpm install discards Replit's auto-`npm install` of root devDeps (`eas-cli` alone pulls ~500 transitive Expo/RN packages we don't need to render the marketing site); (2) `pnpm --filter "@aivo/marketing..."` installs only marketing + its workspace deps (= `@aivo/brand`) — 2 of 30 projects instead of all 30; (3) the post-build `find … -exec rm -rf` strips every app/package/service/artifact source dir that isn't required by `next start`, leaving only `apps/marketing/.next`, `packages/brand/dist`, root `node_modules`, and `start.sh`. Builds `dbca5998` and `b8483929` both failed with `error: image size is over the limit of 8 GiB`; the first fix (slimming the build artifacts above) was not enough on its own because container image layers are append-only — `rm -rf` in a later layer adds a whiteout marker but does not reclaim bytes from the earlier layer that introduced the file. The Nix base layer is what actually moved the needle (see next bullet).
- **Slim Nix base layer** (`replit.nix`): trimmed to `pkgs.nats-server` + `pkgs.redis`. `pkgs.flutter` was previously in the deps list and was pulling the entire Dart SDK + Flutter SDK (~1.5–2 GiB) into every deploy image's nix layer — verified unused in this repo (no `*.dart`, no `pubspec.yaml`, `apps/mobile` is pure Expo/React Native). Removing it is the change that finally got the marketing image under 8 GiB after both the build slimming above and the source-tree cleanup were not enough on their own. **Do not re-add `pkgs.flutter` to `replit.nix`** — if mobile ever needs Flutter tooling, install it on a separate Repl or a separate CI runner, not the marketing deploy. (`.replit`'s `[nix]` `packages` list still contains `cargo`, `rustc`, `postgresql`, etc., used by service development workflows; those add up to a few hundred MB and should be considered if the image creeps back near the limit.)
- **Run**: `bash start.sh` — `start.sh` cd's into `apps/marketing` and `exec`s `next start --port "$PORT" --hostname 0.0.0.0`. Binding to `0.0.0.0` is mandatory; binding to `localhost` silently fails the autoscale health check. The post-build cleanup deletes `scripts/` so anything `start.sh` needs at runtime must live at the repo root or inside `apps/marketing` / `packages/brand`.
- **No root Python deps**: `pyproject.toml` and `uv.lock` are intentionally archived under `services/brain-svc/.workspace-extras/` rather than living at the repo root. If a root-level `pyproject.toml` is reintroduced, Replit's deploy pipeline auto-runs `uv sync` against the read-only Nix-store Python and the build dies with `Permission denied (os error 13)` on the first package install. The Python services (`brain-svc`, `ai-svc`) install their own deps from per-service `requirements.txt` and don't need a workspace-wide pyproject. See `services/brain-svc/.workspace-extras/README.md` for restoration instructions.
- **Custom domain verified (Apr 2026)**: `https://aivolearning.com` is fronted by Cloudflare and serves the live Replit autoscale deployment of the Friendly Universe redesign — confirmed by the rendered "Learning adventures" hero headline and the "COPPA · FERPA · SOC 2" footer lock box. To re-verify after a republish, run `scripts/verify-marketing-deploy.sh`; it iterates every `(path, markers)` pair in `scripts/marketing-markers.sh` (today: `/`, `/privacy-policy`, `/coppa-compliance`, `/ferpa-compliance`), asserts HTTP 200 + every required substring per page, and exits non-zero on any failure. The same script is wired into `.github/workflows/marketing-smoke-test.yml`, which auto-runs after the **Marketing Deploy Production** workflow succeeds and on a 30-minute safety-net schedule, so a silent regression (custom domain re-pointed away, blank build shell, removed trust badges, blanked legal page) fails loudly in GitHub Actions instead of waiting for someone to remember to curl. **Failures and the first recovery after a failure are pinged to the shared ops/deploys Slack channel** (the `SLACK_WEBHOOK_URL` repo secret — same channel used by `health-check.yml` and `mobile-release.yml`); steady-state green runs stay quiet. If the script fails, check Deployments → Custom Domains in the Replit UI to confirm `aivolearning.com` is still attached to the latest deployment.
- **Pre-merge marker guardrail**: The per-route markers live in `scripts/marketing-markers.sh` (single source-of-truth) as `MARKETING_ROUTES` + the `marketing_markers_for "$path"` function, and the file is sourced by both `scripts/verify-marketing-deploy.sh` (production/staging URL check) and `scripts/verify-marketing-build.sh` (locally builds and `next start`s the marketing site, then iterates each route on `http://127.0.0.1:$PORT`). Coverage today: `/` (Hero "Learning adventures" + Footer COPPA/FERPA/SOC 2), `/privacy-policy` (COPPA/FERPA + "Children's Online Privacy Protection"), `/coppa-compliance` (compliance@aivolearning.com + verifiable-parental-consent), `/ferpa-compliance` ("FERPA Compliance Statement" + "SOC 2 Type II"). The PR-blocking workflow `.github/workflows/marketing-pr-check.yml` runs the build script on every PR that touches `apps/marketing/**` (or any of the marker-related scripts/workflow), so a Hero/Footer redesign OR an i18n key rename / section drop on any compliance page fails the PR before merge instead of after publish. The staging deploy workflow (`.github/workflows/marketing-deploy-staging.yml`) also runs `verify-marketing-deploy.sh` against the `MARKETING_STAGING_URL` env-level variable as a post-deploy step (skipped with a warning if the variable is unset). Adding a new route is a one-file change: extend `MARKETING_ROUTES` and the `marketing_markers_for` case in `scripts/marketing-markers.sh` — both verify scripts and all three workflows auto-pick it up.
- **Other unattended scheduled checks page Slack the same way**: `db-schema-drift.yml`, `paging-url-leaks.yml`, `secret-scan.yml`, `i18n-file-audit.yml`, and `backup-verify.yml` all use the reusable `.github/actions/notify-slack-on-failure` composite action so they fail loudly in the same ops/deploys Slack channel (and announce first recovery) instead of sitting red in the Actions UI. PR-triggered runs stay silent because PR failures are already visible to the PR author. The full list of which scheduled workflows page Slack and which intentionally don't is in `docs/runbooks/scheduled-check-alerts.md`, along with instructions for wiring the notifier into a new workflow.

### Staging deploy (Vercel)

Every push to `develop` that touches `apps/marketing/**` ships the site to a hosted **Vercel** preview environment via `.github/workflows/marketing-deploy-staging.yml` and then runs `verify-marketing-deploy.sh` against the just-published URL. This is a third independent line of defense behind the PR-time build check and the production smoke check, plus a real preview environment for QA before `Marketing Deploy Production` is dispatched. Production still runs on the Replit autoscale deployment of `aivolearning.com` — Vercel here is staging-only.

The workflow captures the per-deploy URL from `vercel deploy --prebuilt`'s stdout and feeds it to the marker check, so the verification step never gets skipped for "no URL configured" reasons. If `vars.MARKETING_STAGING_URL` is set on the GitHub `staging` environment to a stable hostname (e.g. `staging.aivolearning.com`), the deployment is also `vercel alias`'d to that hostname and verified against it — gives QA a stable URL.

Required GitHub configuration on the `staging` environment:

- Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (the latter two come from `apps/marketing/.vercel/project.json` after running `vercel link` inside `apps/marketing` once).
- Vercel project settings: Framework = Next.js, Root Directory = `apps/marketing`, Install Command = `pnpm install --frozen-lockfile`, Build Command = `pnpm --filter @aivo/marketing build`. Vercel's pnpm-workspace detection pulls `@aivo/brand` transitively.
- Optional: `vars.MARKETING_STAGING_URL` for the stable-alias behaviour above.

The workflow has a preflight step that fails fast with a complete setup checklist if any of the three secrets are missing, so a fresh staging environment surfaces a clear next-step instead of a cryptic CLI error.

### Dashboard (`apps/web`) is **not** on Replit

The signed-in dashboard ships to production on the Hetzner K3s cluster (`app.aivolearning.com`), not on a second Replit autoscale deployment. The Hetzner overlay (`infra/k8s/overlays/hetzner/web-ingress.yaml` + `kustomization.yaml`) already reserves the host, the TLS slot, and the `web-learner` Service/Deployment + GHCR image (`ghcr.io/artpromedia/aivo-web-learner`). Do not re-point the Replit `[deployment]` block at `apps/web` — full reasoning, rollout steps, and revisit conditions are in `docs/runbooks/web-dashboard-deployment-decision.md`.

## Production Environment Checklist

The following env vars are validated at service boot when `NODE_ENV=production`. Missing values throw immediately rather than silently falling back to localhost — see `.env.example` for the full list.

- **All `*_SVC_URL` (IDENTITY, BRAIN, ASSESSMENT, AI, LEARNING, TUTOR, FAMILY, ENGAGEMENT, BILLING, COMMS, I18N, INTEGRATIONS, ADMIN, STATUS_PAGE, RESEARCH)** — required by `status-page-svc` (builds the health-check map) and by `tutor-svc` for `AI_SVC_URL`, `BRAIN_SVC_URL`, `LEARNING_SVC_URL`.
- **`INTERNAL_SERVICE_TOKEN`** — required by `learning-svc`, `tutor-svc`, and `status-page-svc`. Shared secret for inter-service `x-service-token` calls.
- **`INTERNAL_AI_TOKEN`** — required by `tutor-svc` (curriculum routes calling `ai-svc`).
- **`WEBAUTHN_ORIGINS`** — optional comma-separated allow-list. If unset in production, `identity-svc` returns only the static `aivolearning.com` allow-list and ignores forwarded host headers (no origin reflection).

## External Dependencies

- **PostgreSQL 16**: Primary database for all application data.
- **NATS**: For typed event definitions and inter-service communication.
- **LiteLLM**: Used by Python FastAPI services (ai-svc, brain-svc) for managing LLM interactions with a fallback chain (Claude Opus 4.7, Gemini 3.0 Pro, GPT-5.5).
- **Postmark**: For transactional email delivery via `comms-svc`.
- **Google OAuth**: For user authentication and sign-in.
- **Third-Party Integrations (District Level)**: Google Classroom, Clever, ClassLink, Canvas LMS for roster synchronization.
- **Hetzner**: Cloud provider for deployment infrastructure.
- **GitHub Container Registry (GHCR)**: For storing and managing Docker images.
- **OWASP ZAP**: Used for weekly security baseline scans in CI.

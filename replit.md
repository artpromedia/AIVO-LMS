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

### Shared landing-page design ("A calmer, more personal way to learn")

Two separate public landing pages share one design and must be kept in visual sync: the **marketing site** (`apps/marketing/src/app/page.tsx`, port 3003) and the signed-in app's **web-v2 home** (`apps/web-v2/app/page.tsx`, port 5000 — what the Replit preview pane shows). Same ~11 sections (hero with tablet-learner device + robot mascot, three adult views, how-it-works steps, features grid, learner-function showcase, testimonials, trust strip, FAQ, final CTA), same `@aivo/brand` `--aivo-*` tokens. Differences are intentional and must be preserved: web-v2's hero is **session-aware** (`getSession` → "Continue as {role}" vs "Start Free Trial"), uses `font-iw-display` (web-v2's `font-heading` token does not resolve) and `marketingHref()` for routes that don't exist in web-v2 (`/demo`, `/privacy-policy`, etc.); marketing uses `font-heading`, real `Link`/`<a>`, and a non-session hero. Shared CTA/card styling lives in per-file `const`s (`heroPrimaryBtn`, `heroSecondaryBtn`, `cardShadow`): CTAs are `rounded-full` pills (`min-h-[52px]`, `px-7`, soft purple-glow shadow, `hover:-translate-y-0.5`), "Watch Demo" wraps a filled-circle `Play` icon, and every card carries the shared soft purple-tinted `cardShadow`. When you change the design on one page, mirror it to the other (and to the twin `HomeHeroDevice.tsx` / `LearnerFunctionShowcase.tsx` under each app's `components/marketing/home/`).

The shared marketing **layouts** carry the same pill CTAs so every secondary page stays in sync: `LandingPageLayout.tsx` defines `ctaPrimary`/`ctaSecondary` consts that mirror the home page's `heroPrimaryBtn`/`heroSecondaryBtn` and applies them to its hero + final CTAs (covers the audience pages, pricing, etc.); `legal/LegalPageLayout.tsx` and `legal/CompanyPageLayout.tsx` use the same pill geometry (LegalPageLayout keeps its per-page `accentColor` inline style). Bespoke marketing pages (`about`, `resources`, `guides`, `blog`, `subprocessors`) and the marketing auth forms (`signup`, `forgot-password`, `reset-password` — `rounded-full` gradient submit buttons in the `--visual-primary` token system) follow the same pill signature. web-v2's public auth pages already match: its local `components/ui/button.tsx` default variant is a `rounded-full bg-iw-primary` pill. The marketing `/login` route is a server redirect to the real app (no UI). When extending the redesign, keep these in sync.

The two top navs are also kept in sync: web-v2's `components/marketing/site-header.tsx` mirrors marketing's `StickyHeader` — same six links (For Parents / For Teachers / For Schools / Features / Pricing / Resources) and "Log In" / "Start Free Trial" CTAs. In web-v2 the audience pages + Pricing + Resources don't exist, so they ship as external `marketingHref()` links while Features anchors in-page to `#features-heading`. One intentional layout difference: web-v2's landing header renders the sensory-mode toggle **only in the mobile drawer**, not inline on desktop — the `max-w-6xl` header container cannot fit the wide Standard/Calm/High-Contrast pill alongside all six nav links + EN + both CTAs without the right cluster overlapping the last nav links, and the reference design has no toggle in the header anyway. Do not re-add an inline desktop sensory toggle to this header without first widening the container or trimming nav.

## Operations & Deployment

Detailed operational/deploy/port history lives in **`docs/runbooks/marketing-deploy-and-ops.md`** (the warnings there encode regressions that already happened — read the relevant section before touching workflows, ports, the `.replit` `[deployment]` block, or `replit.nix`). Quick map:

- **Backend boot ordering** — `scripts/start-services.sh` launches the ~14 backend services in **five small groups with pauses**, not a single fan-out (parallel boot exhausts the container's process budget and starves the Next.js workflows). Do not collapse the groups.
- **Marketing dev server** — `scripts/start-marketing.sh` binds Turbopack **directly to port 3003** (must equal `waitForPort`; the supervisor only sees ports declared as `localPort` in `.replit`). Boot order on a fresh start: restart **Identity Service** first (frees 3003, binds `assessment-svc` on **3012**), then **Marketing Site** (binds 3003). Do not move assessment-svc back to 3003.
- **Production (Replit autoscale)** — publishes `apps/marketing` to `aivolearning.com`. The build is heavily slimmed to stay under the 8 GiB image ceiling; `replit.nix` is trimmed to `nats-server` + `redis` — **do not re-add `pkgs.flutter`**, and do not reintroduce a root-level `pyproject.toml`. After a republish, verify with `scripts/verify-marketing-deploy.sh` (markers in `scripts/marketing-markers.sh`); failures page the ops/deploys Slack channel.
- **Staging (Vercel)** — pushes to `develop` touching `apps/marketing/**` deploy to a Vercel preview and run the marker check. Requires `VERCEL_*` secrets on the GitHub `staging` environment.
- **Dashboard (`apps/web`)** — ships to the Hetzner K3s cluster (`app.aivolearning.com`), **not** Replit. Do not re-point the Replit `[deployment]` block at it. See `docs/runbooks/web-dashboard-deployment-decision.md`.
- **Production env checklist** — `*_SVC_URL`, `INTERNAL_SERVICE_TOKEN`, `INTERNAL_AI_TOKEN`, and optional `WEBAUTHN_ORIGINS` are validated at boot when `NODE_ENV=production` (missing values throw). Full list in the runbook and `.env.example`.

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

# Contributing to AIVO Learning

Thanks for your interest in contributing! This document covers the
mechanics of working in this monorepo: how it's organised, how to set up
a dev environment, how to land changes, and what we expect from PRs.

This is a **proprietary repository** (see [`LICENSE`](./LICENSE)).
External contributions are welcome from authorised partners only —
please coordinate with the AIVO team before opening a non-trivial PR.

## Code of Conduct

By participating in this project you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md). Report unacceptable behaviour
to `conduct@aivolearning.com`.

## Repository layout

This is a [pnpm](https://pnpm.io) + [Turborepo](https://turbo.build)
monorepo with both Node/TypeScript and Python services.

```
apps/
  marketing/        Next.js public site
  web/              Next.js learner & admin app
  mobile/           Expo / React Native app
services/
  identity-svc/     Fastify — auth, MFA, sessions
  admin-svc/        Fastify — admin & district console APIs
  tutor-svc/        Fastify — tutor + homework chat
  brain-svc/        FastAPI — brain clone pipeline (Python)
  ai-svc/           FastAPI — LLM gateway, content gen (Python)
  curriculum-svc/   FastAPI — read-only curriculum lookup (Python)
  ...
packages/
  api-client/       Generated OpenAPI typed client
  db/               Prisma schema + migrations
  events/           Shared event-bus types
  security/         Auth + crypto helpers
infra/
  helm/             Helm charts and per-service overrides
  terraform/        Cloud infrastructure as code
.github/
  workflows/        CI/CD pipelines
```

## Prerequisites

- **Node.js** 22.x (see `NODE_VERSION` in `.github/workflows/ci.yml`)
- **pnpm** 9.x (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Python** 3.11+ (for FastAPI services)
- **Docker** + **docker-compose** (local Postgres, Redis, MinIO)

## Local development

```bash
# 1. Install JS dependencies
pnpm install --frozen-lockfile

# 2. Bring up local infra (Postgres, Redis, MinIO, JWT keys)
./scripts/dev-up.sh

# 3. Generate the OpenAPI typed client (after touching service routes)
pnpm api:generate

# 4. Run a single app
pnpm --filter @aivo/web dev
pnpm --filter @aivo/marketing dev

# 5. Or run the whole platform
pnpm dev
```

For each Python service:

```bash
cd services/brain-svc
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn brain_svc.main:app --reload --port 8001
```

## Coding standards

### TypeScript / JavaScript

- ESLint (`pnpm lint`) and TypeScript (`pnpm build`) must pass.
- We use 2-space indent, double quotes, semicolons. Match the
  surrounding file when in doubt.
- Prefer `import type` for type-only imports.
- New service routes **must** register a `@fastify/swagger` schema so
  they show up in the typed API client (see
  [`packages/api-client/README.md`](./packages/api-client/README.md)).

### Python

- Follow [PEP 8](https://peps.python.org/pep-0008/) and use type hints
  on all public APIs.
- Run `ruff check` locally before opening a PR. CI will enforce this
  going forward.
- FastAPI routes belong under `routes/` and should mount via
  `app.include_router(...)` in `main.py`.

### Commits & PRs

- Use [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`,
  `deps:` …). Scope by app or service when useful: `feat(tutor-svc):`,
  `fix(web):`.
- Keep PRs focused. A 200-line PR that does one thing is much easier to
  review than a 2,000-line PR that does five.
- Reference issues with `Fixes #123` so they auto-close on merge.
- Update tests, docs, and (when applicable) the OpenAPI client output
  in the **same PR** as the code change.

## Tests

- **Node services:** `pnpm test` runs Vitest across the workspace.
  Service-level tests live in `services/<svc>/test/`.
- **Python services:** `pytest tests/` from inside the service directory.
- **E2E:** Playwright tests live under `e2e/`. Run with `pnpm e2e`.
- Aim for **meaningful** coverage on auth, billing, and any code that
  touches student data — not arbitrary line-count thresholds.

CI runs lint + build on every PR, plus targeted test jobs per service.
A green CI is required to merge.

## Branching & releases

- Default branch is `main`. Feature work goes on
  `feature/<short-name>`; bug fixes on `fix/<short-name>`.
- We squash-merge PRs into `main`. The PR title becomes the squashed
  commit message — make it count.
- Releases are tagged from `main` (`vX.Y.Z`). Do not commit directly to
  release tags.

## Security

If you find a vulnerability, **do not open a public issue**. Follow the
disclosure process in [`SECURITY.md`](./SECURITY.md).

## Code review

- All PRs require at least one approval from a code owner (see
  [`.github/CODEOWNERS`](./.github/CODEOWNERS)).
- Touching paths in `services/identity-svc/`, `packages/security/`,
  `packages/db/`, the marketing compliance pages, or any AI-safety
  surface (`speech_buddy`, `quality_gate`, `budget_caps`, the LLM
  gateway) requires explicit code-owner approval — automated approval
  via Dependabot or others is not enough for those paths.
- Be kind. We review code, not people.

## Questions

- Internal: `#eng-platform` on Slack.
- External / partners: `engineering@aivolearning.com`.

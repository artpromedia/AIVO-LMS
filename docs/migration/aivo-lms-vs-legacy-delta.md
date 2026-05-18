# AIVO_LMS vs AIVO-AI-LEARNING — Repository Delta Report

**Status:** Sprint 00 baseline
**New repository:** `artpromedia/aivo-lms` (this repo, branch `claude/implement-sprint-prompts-Fiawa`)
**Legacy reference repository:** `artpromedia/aivo-ai-learning` (read-only)
**Generated:** Sprint 00 of the AIVO_LMS completion plan

> The legacy repository is read-only reference material. AIVO_LMS is the
> production-bound codebase. Do not overwrite AIVO_LMS with legacy code.
> Compare selectively, port only stable functionality that is genuinely
> missing here, and preserve newer AIVO_LMS architecture, marketing pages,
> release gates, packages, and docs.

## Method

Because the legacy repo is not present in the local execution environment,
this delta was built by reading the public GitHub tree of
`artpromedia/aivo-ai-learning` (default branch `main`) and comparing it
against the working tree of `artpromedia/aivo-lms` at the head of branch
`claude/implement-sprint-prompts-Fiawa`. Workspaces compared at this level:

- root build system (`package.json`, `pnpm-workspace.yaml`, `turbo.json`)
- `apps/*`
- `packages/*`
- `services/*`
- `docs/*`
- `scripts/*`
- `e2e/*`, `tests/integration/*`
- `.github/workflows/*`

Deeper, file-level diffs across hundreds of files inside services and
packages are not in scope for Sprint 00; Sprint 02 owns rewrites-and-drift
verification at that depth. This document captures the structural and
strategic delta needed to plan the remaining sprints.

## High-level summary

The two repositories share the same monorepo skeleton: same package
manager (`pnpm@10.26.1`), same Node engine (`>=22`), the same Turborepo
task graph, the same 27 services, and the same 31 internal packages. They
differ where it matters most for the product:

1. **Web app architecture.** AIVO_LMS has introduced a second Next.js app,
   `apps/web-v2`, with explicit role-group routes (`admin`, `learner`,
   `parent`, `teacher`, `settings`). The legacy repo only had `apps/web`.
   `apps/web` still exists in AIVO_LMS and ships features the legacy repo
   already had (admin, dashboard, district, accept-invite, MFA). The new
   role-grouped surfaces in `apps/web-v2` are where Sprint 08 will land.
2. **Marketing surface.** AIVO_LMS has the richer marketing homepage and a
   far larger public route tree (audience-selector, core product loop,
   Today's Mission preview, LessonRun preview, role visibility, trust,
   FunctioningLevels, BrainClone, FAQ, Pricing, plus `/for-parents`,
   `/for-teachers`, `/for-schools`, `/for-districts`, `/for-homeschool`,
   `/for-special-education`, `/compare`, `/guides`, `/levels`, `/trust`,
   `/subprocessors`, `/coppa-compliance`, `/ferpa-compliance`, etc.). The
   legacy repo carried only the bare `src/{app,components,i18n,lib,providers}`
   skeleton.
3. **Production readiness gates.** AIVO_LMS already ships the harder
   gates: `prod:check`, `prod:no-demo`, `prod:surface-contract`,
   `test:production-readiness`, `test:enterprise`, `api:check`. The
   legacy repo carries the same script names, so the gate definitions
   appear to have been authored on either side and kept in lock-step. The
   gates must continue to pass in this repo through Sprints 03–16.
4. **Mobile architecture (UNRESOLVED on both sides).** Both repos route
   mobile users into separate Expo role groups: `(auth)`, `(caregiver)`,
   `(learner)`, `(parent)`, `(teacher)`, `(therapist)`. The product
   direction is one unified app with role switching. This rewrite is
   Sprint 09 and is not satisfied by either repo today.
5. **Docs.** AIVO_LMS adds two doc directories the legacy repo does not
   have: `docs/marketing/` and `docs/ux/`. Both repos share the same
   architecture and contract docs at the same paths.

## Structural inventory

### Root files

Identical set on both sides: `.env.example`, `.gitleaks.toml`, `.replit`,
`.npmrc`, `.nvmrc`, `cspell.json`, `eslint.config.mjs`, `package.json`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `pyproject.toml`, `replit.md`,
`replit.nix`, `start.sh`, `tsconfig.base.json`, `tsconfig.json`,
`turbo.json`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `LICENSE`,
`README.md`, `SECURITY.md`, `HETZNER_DEPLOYMENT_GUIDE.md`. Engine and
pnpm overrides also match.

### `apps/`

| App         | Legacy                 | AIVO_LMS                 | Notes                                                  |
| ----------- | ---------------------- | ------------------------ | ------------------------------------------------------ |
| `marketing` | present, skeleton only | present, full route tree | richer in AIVO_LMS; preserve                           |
| `mobile`    | fragmented role groups | fragmented role groups   | both need Sprint 09 unification                        |
| `web`       | present                | present                  | legacy-aligned shell (admin/dashboard/district/MFA)    |
| `web-v2`    | —                      | **new**                  | role-grouped surfaces for parent/learner/teacher/admin |

### `packages/`

All 31 packages present on both sides with identical names:

```
aac-bridge, adaptive-baseline, api-client, billing-entitlements, brand,
content-pack, db, enterprise-core, events, executive-function,
feature-flags, item-bank, learner-surfaces, learner-ui, level-transforms,
mobile-ui, observability, ops-alert, ops-alerts, pedagogy, scheduling,
scoring, security, skill-graphs, special-interest-engine, sso,
stage-runtime, stage-ui, tutor-runtime, tutor-sdk, tutor-surface-protocol
```

Note: `ops-alert` and `ops-alerts` both exist in both repos. That looks
like a duplication and is flagged for Sprint 02 to investigate.

### `services/`

All 27 services present on both sides with identical names:

```
admin-svc, ai-svc, alerts-proxy-svc, assessment-svc, audit-svc,
billing-svc, brain-svc, comms-svc, curriculum-svc, data-governance-svc,
engagement-svc, family-svc, homework-svc, i18n-svc, identity-svc,
integration-svc, integrations-svc, learning-svc, math-recognizer-svc,
problem-session-svc, recommendation-svc, research-svc,
responsible-ai-svc, science-solver-svc, status-page-svc,
subject-brain-svc, tenant-svc, tutor-svc
```

Note: `integration-svc` and `integrations-svc` both exist in both repos.
Sprint 02 owns reconciling these or documenting why both are kept.

### `docs/`

AIVO_LMS adds: `docs/marketing/`, `docs/ux/`.
All other docs share the same filenames in both repos.

### Root scripts (`package.json`)

The script lists in both `package.json` files are identical. The
production-readiness gates, OpenAPI generation pipeline, and integration
test entry points already live on both sides.

### Mobile routes

Both repos:

```
apps/mobile/app/
  (auth)/   (caregiver)/   (learner)/   (parent)/   (teacher)/
  (therapist)/   _layout.tsx   accept-invite.tsx   index.tsx
```

This is the architecture Sprint 09 replaces.

### Web routes (AIVO_LMS only)

`apps/web/src/app/`:

```
accept-invite, admin, api, canvas-preview, coppa-compliance, dashboard,
district, forgot-password, login, privacy-policy, reset-password,
showcase, signup, terms-of-service, verify-mfa
```

`apps/web-v2/app/`:

```
admin/{district, platform, school}
learner/{baseline, home, homework, lesson-runs, library, missions,
         notifications, progress, quests, rewards, select, settings,
         subjects}
parent/{consent, home, learners, notifications, privacy, reports,
        schedule, settings}
teacher/{assignments, classes, home, insights, learners, lesson-plans,
         reports, settings}
api, login, signup, settings, error.tsx, global-error.tsx, not-found.tsx
```

This is the role-aware surface that Sprint 08 completes.

## Decision tables

### Keep from AIVO_LMS (do not regress)

| Area                                                                                                                                                                                     | Why                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `apps/marketing` route tree and section sequence (Audience Selector, Core Product Loop, Today's Mission, LessonRun, Role Visibility, FunctioningLevels, BrainClone, Trust, Pricing, FAQ) | Richer than legacy; primary acquisition surface; Sprint 10 finishes it                                    |
| `apps/web-v2` role groups (`admin`, `learner`, `parent`, `teacher`)                                                                                                                      | Modern role-aware web shell; Sprint 08 completes it                                                       |
| `packages/brand` as token source-of-truth wiring across apps                                                                                                                             | Sprint 01 hardens this; do not regress to ad-hoc tokens                                                   |
| `packages/billing-entitlements`                                                                                                                                                          | Drives Sprint 11                                                                                          |
| `packages/enterprise-core`, `packages/feature-flags`, `packages/security`, `packages/sso`                                                                                                | Enterprise/release-gate foundation                                                                        |
| `scripts/no-demo-prod-scan.mjs`, `scripts/surface-contract-scan.mjs`, `scripts/production-readiness-check.mjs`                                                                           | Production gates; must keep passing through every sprint                                                  |
| `tests/integration/vitest.production-readiness.config.ts`, `vitest.enterprise.config.ts`                                                                                                 | Same                                                                                                      |
| `docs/enterprise-release-gates.md`, `docs/production-readiness-gates.md`, `docs/release-blockers.md`, `docs/legacy-feature-porting-map.md`                                               | Existing release-discipline docs                                                                          |
| `apps/web` MFA, accept-invite, district shell, dashboard                                                                                                                                 | Pre-existing parent/admin flows still wired to identity-svc routes; do not delete during web-v2 migration |
| `docs/ux/`, `docs/marketing/`                                                                                                                                                            | New doc surfaces                                                                                          |

### Port from legacy (if and only if AIVO_LMS lacks it)

The structural inventory shows that legacy does not have anything
substantive that AIVO*LMS lacks at the workspace/service/package level.
Where porting may still apply is at the \_implementation* level inside
existing services and packages. Sprint 02 will perform a file-level
drift sweep and produce a concrete list. Candidate areas to inspect
during Sprint 02:

| Area                                                                      | Reason to inspect for porting                                                                 |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `services/problem-session-svc`                                            | Legacy `problem-session-ledger` was a porting target per `docs/legacy-feature-porting-map.md` |
| `services/math-recognizer-svc`, `services/science-solver-svc`             | Legacy "advanced content generators" porting target                                           |
| `services/subject-brain-svc`                                              | Legacy "advanced content generators" porting target                                           |
| `services/responsible-ai-svc`                                             | Legacy "responsible AI guardrails" porting target — Sprint 14                                 |
| `services/data-governance-svc` + `audit-svc`                              | Legacy "data governance center" porting target — Sprint 04                                    |
| `services/integration-svc` (SIS, LTI 1.3)                                 | Legacy SIS sync porting target — Sprint 12                                                    |
| `services/homework-svc` (focus-monitor, self-regulation-recommender, OCR) | Legacy self-regulation hub porting target                                                     |
| `packages/tutor-surface-protocol` validators                              | Legacy tutor surface protocol porting target                                                  |

These are _behind feature flags_ in the porting map and must keep their
existing test gates passing.

### Rewrite because both are incomplete

| Area                                                                                                                                                         | Reason                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/mobile` unified shell                                                                                                                                  | Both repos still route into separate role groups. Sprint 09 replaces with a single shell + role switching + `x-aivo-active-role` server enforcement.                                 |
| `apps/web-v2` route group surfaces                                                                                                                           | Skeleton exists; loading/error/empty/permission/consent-blocked states must be completed in Sprint 08.                                                                               |
| Consent perimeter (UI + API middleware + audit)                                                                                                              | The shared `services/data-governance-svc` and identity-svc consent routes need to be unified behind one `ConsentGate` (web + mobile) and one `requireConsent` middleware. Sprint 04. |
| AI safety pipeline (input classification → injection detection → output policy validation → fallback/timeout/circuit-breaker → cost controls → eval harness) | Pieces exist (`services/responsible-ai-svc`, ai-svc generators) but the end-to-end pipeline and admin dashboard do not. Sprint 14.                                                   |
| Curriculum + standards + skill-graph + item-bank source-of-truth contract and seeds (CCSS/NGSS, K–8 Math/ELA/Science)                                        | Packages exist but no end-to-end "no baseline without skill alignment" guarantee. Sprint 05.                                                                                         |
| Brand asset validation script and consolidated `packages/brand` exports for role themes/icons/splash/email/OG                                                | `packages/brand` exists but is not yet enforced. Sprint 01.                                                                                                                          |
| Mobile offline queue for learner lesson responses                                                                                                            | Sprint 09.                                                                                                                                                                           |

## Risks to the migration

1. **Two web apps simultaneously (`apps/web` and `apps/web-v2`).** Until
   Sprint 08 lands, both ship. Auth, MFA, accept-invite, and the existing
   admin/dashboard/district shells must not regress.
2. **Service duplication.** `integration-svc` vs `integrations-svc`, and
   `ops-alert` vs `ops-alerts`, exist on both sides. Sprint 02 must
   either consolidate or document why both are kept.
3. **Production readiness gates already in place.** Any sprint that adds
   demo data, mock fallbacks, or unreal surfaces will trip the gates and
   block release.
4. **The legacy repo is read-only.** No fork-and-merge; selective porting
   only. The default behavior is "keep AIVO_LMS as authored."

## Verification

This document is informational. Sprint 00 also adds `scripts/repo-health-check.mjs`
and a `repo:health` root script that verify the workspace structure
underpinning this inventory.

```bash
pnpm repo:health
```

A non-zero exit means the workspace shape this document depends on has
drifted; update the report and the script together.

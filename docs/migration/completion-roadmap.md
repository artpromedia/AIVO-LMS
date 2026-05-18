# AIVO_LMS Completion Roadmap

This roadmap is the ordered execution plan derived from the Sprint Prompt
Suite for completing AIVO_LMS. It pairs every sprint with its critical
dependencies, the workspaces it changes, the release gates it must keep
green, and the exit criteria the sprint cannot ship without.

## Execution order

```
00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16
```

The critical dependency chain:

> Auth + Consent + Curriculum
> → Assessment / Brain / Baseline
> → LessonRun
> → Role Surfaces
> → Mobile Unification
> → Billing / Rostering / Comms
> → AI Safety / Accessibility / Security Release

Sprints inside the same band can overlap if and only if they touch
disjoint workspaces. The default mode is strict-serial because most
sprints require the prior sprint's contracts to be stable.

## Dependency graph

```
S00 (delta + baseline)
 └── S01 (brand) ─────────┐
       └── S02 (build + drift) ──┐
              └── S03 (auth) ──┐ │
                    └── S04 (consent + IEP governance) ──┐
                          └── S05 (curriculum + skill graph + item bank) ──┐
                                └── S06 (parent onboarding + brain profile) ──┐
                                      └── S07 (baseline + lesson + tutor) ──┐
                                            └── S08 (web role surfaces) ──┐
                                                  └── S09 (mobile unification) ──┐
                                                        └── S10 (marketing) ──┐
                                                              └── S11 (billing) ──┐
                                                                    └── S12 (rostering) ──┐
                                                                          └── S13 (comms) ──┐
                                                                                └── S14 (AI safety) ──┐
                                                                                      └── S15 (accessibility) ──┐
                                                                                            └── S16 (security + release)
```

## Cross-cutting invariants

Every sprint must hold these. They are explicitly enforced by gates and
audits, not by good intentions:

- No production mock data, no "coming soon," no demo-only fallback
  reachable in production (`pnpm prod:no-demo`).
- No TODO placeholders in any code touched by the sprint.
- All sprints keep the monorepo stack: pnpm 10.26.1, Turborepo, Node
  `>=22`, Next.js 15, React 19, Expo SDK 54, TypeScript.
- `packages/brand` is the single source of truth for brand tokens, logos,
  colors, typography, and app icons.
- Every BFF/API route enforces authenticated session, tenant scope, role
  scope, learner ownership, and audit logging for sensitive
  child/IEP/billing data.
- Sprint-end commands must pass: `pnpm install`, `pnpm lint`,
  `pnpm test`, `pnpm build`, `pnpm api:check` where APIs change,
  `pnpm prod:check`, `pnpm test:production-readiness`.

## Sprints

### S00 — Repo delta, build baseline, migration map

- Workspaces: `docs/migration/`, `scripts/`.
- Adds: `docs/migration/aivo-lms-vs-legacy-delta.md`,
  `docs/migration/completion-roadmap.md`, `scripts/repo-health-check.mjs`,
  root script `repo:health`.
- Exit: `pnpm repo:health` passes; report explicitly marks
  AIVO-AI-LEARNING as read-only reference.
- Gates: existing gates still pass.

### S01 — Brand assets, design tokens, shared UI foundation

- Workspaces: `packages/brand`, `apps/web`, `apps/web-v2`,
  `apps/marketing`, `apps/mobile`.
- Adds: `packages/brand` exports for colors, gradients, typography,
  spacing, radius, shadows, logo asset paths, app icon asset paths, role
  theme tokens; `scripts/brand-asset-check.mjs`; root script
  `brand:check`.
- Refactors apps to consume `packages/brand` for brand values.
- Exit: `pnpm brand:check` passes; favicons, OG images, splash, and Apple
  touch icons resolve in web/marketing/mobile.

### S02 — Local dev, service rewrites, API client drift, CI

- Workspaces: `apps/web/next.config.ts`, `apps/web-v2/next.config.ts`,
  `services/*`, `packages/api-client`, `.env.example`, `docs/dev/`,
  `.github/workflows/`.
- Validates every `next.config.ts` rewrite maps to a real service and
  port. Reconciles or documents `integration-svc` vs `integrations-svc`
  and `ops-alert` vs `ops-alerts`.
- Refreshes `packages/api-client` (`api:dump`, `api:generate`,
  `api:check` all clean).
- Adds/updates CI workflow to run install + lint + test + build + api:check
  - prod:check + test:production-readiness.
- Exit: a fresh `pnpm install && pnpm build` succeeds from
  `docs/dev/local-dev.md` instructions.

### S03 — Real auth, email verification, password reset, MFA, sessions

- Workspaces: `services/identity-svc`, `apps/web`, `apps/web-v2`,
  `apps/mobile`, `tests/integration/`, `e2e/`.
- Implements signup → verify-email → login → forgot/reset → MFA →
  refresh/logout for parent + staff/admin + learner PIN.
- Moves any mock/dev login under `/dev/login` and disables in production.
- Adds e2e tests for happy paths and security tests for token reuse,
  expired tokens, and rate-limited login.
- Exit: no mock auth route reachable in production; audit events created
  for every auth event.

### S04 — Consent, COPPA/FERPA, IEP governance, privacy matrices

- Workspaces: `services/identity-svc`, `services/data-governance-svc`,
  `services/audit-svc`, `apps/web/src`, `apps/web-v2/app`,
  `apps/mobile/app`, `packages/security`, `docs/compliance/`.
- Adds `docs/compliance/consent-matrix.md` and
  `docs/compliance/state-privacy-matrix.md`.
- Implements `ConsentGate` (web + mobile) and `requireConsent` middleware.
- Adds `scripts/consent-gate-audit.mjs` and root script `consent:audit`.
- Exit: no child data collection without `child_data_collection`; no IEP
  upload without `iep_document_storage`; teachers never see raw IEP.

### S05 — Curriculum, standards, skill graph, item bank source of truth

- Workspaces: `packages/skill-graphs`, `packages/item-bank`,
  `packages/content-pack`, `packages/pedagogy`, `services/curriculum-svc`,
  `services/assessment-svc`, `services/learning-svc`.
- Adds `docs/curriculum/skill-graph-contract.md`, seed content for Math
  K–8, ELA/Reading K–8, Science K–8 starter (NGSS-aligned).
- Adds versioning (draft/active/deprecated/archived) and validation
  scripts `curriculum:validate`, `curriculum:seed`.
- Exit: no baseline or lesson can be generated against a stub skill;
  every item has standards alignment.

### S06 — Parent onboarding, learner creation, assessment, IEP upload, brain profile

- Workspaces: `apps/web-v2/app/parent`, `apps/mobile`, `services/family-svc`,
  `services/assessment-svc`, `services/brain-svc`,
  `services/data-governance-svc`.
- Implements signup → consent → learner creation → age gate → parent
  assessment → IEP upload → brain profile review → baseline launch.
- Implements IEP states (uploading, scanning, parsing, review,
  confirm/correct, failed parse, retry).
- Exit: parent can complete onboarding without dead ends; brain profile
  is explainable and parent-reviewable; no raw IEP exposed to
  unauthorized roles.

### S07 — Baseline, mastery, LessonRun, Today's Mission, tutor runtime

- Workspaces: `packages/adaptive-baseline`, `packages/learner-surfaces`,
  `packages/stage-runtime`, `packages/stage-ui`,
  `packages/tutor-runtime`, `packages/tutor-surface-protocol`,
  `services/assessment-svc`, `services/learning-svc`, `services/tutor-svc`.
- Removes any static `MOCK_QUESTIONS`. Wires baseline to parent
  assessment + brain profile + IEP-derived accommodations + skill graph
  - item bank.
- Implements LessonRun: intro → guided → practice → feedback →
  reflection → mastery event → resumable state.
- Exit: lessons are real, stateful, resumable, auditable; parent
  summaries are plain-language and consent-bounded.

### S08 — Web app role surfaces, dashboards, inboxes, state coverage

- Workspaces: `apps/web-v2/app/*`, `apps/web/src/app/*`, `packages/learner-ui`.
- Completes parent, learner, teacher, school admin, district admin,
  platform admin surfaces.
- Adds per-route-group `loading.tsx`, `error.tsx`, `not-found.tsx`.
- Adds `docs/ux/route-matrix.md` and a route audit script.
- Exit: no broken CTAs, dead buttons, or production "coming soon";
  learner home has one primary CTA ("Start Today's Mission"); teacher
  cannot access parent-only data.

### S09 — Unified mobile app with role switching

- Workspaces: `apps/mobile/`, `packages/mobile-ui`, server identity/auth
  for `x-aivo-active-role` enforcement.
- Adds feature flag `MOBILE_UNIFIED_APP` (default off during migration).
- Adds `app/(app)/_layout.tsx`, `RoleContext`, role chooser, role
  switcher; parameterizes shared screens by active role.
- Adds offline queue for learner lesson responses; deep links; learner
  PIN; push routing.
- Exit: one app supports parent/learner/teacher/caregiver/therapist
  modes; server rejects forged active-role headers; legacy role groups
  removed after parity.

### S10 — Marketing website, lead capture, SEO, analytics

- Workspaces: `apps/marketing/src`, `services/admin-svc`, `packages/brand`.
- Completes public routes, lead forms, SEO (sitemap/robots/OG/JSON-LD),
  analytics catalog (no PII), i18n.
- Wires forms to `admin-svc` leads with honeypot, dedupe, consent, audit.
- Exit: marketing site can ship independently; every CTA works; no fake
  testimonials or unverified claims.

### S11 — Billing, entitlements, coupons, family plans, district purchasing

- Workspaces: `packages/billing-entitlements`, `services/billing-svc`,
  `apps/web-v2/app/parent`, `apps/web-v2/app/admin`.
- Implements plans, entitlements, billing states, Stripe checkout/portal/
  webhooks, coupons, school/district purchasing.
- Adds entitlement middleware to protected features.
- Exit: UI and server agree on entitlements; learner cannot use paid AI
  features after expiry except within grace; webhook idempotency
  verified.

### S12 — Rostering, SIS, Clever/ClassLink/OneRoster, school admin

- Workspaces: `services/integrations-svc` (and/or `integration-svc`),
  `apps/web-v2/app/admin`, `services/family-svc`.
- Implements OneRoster, CSV fallback, Clever/ClassLink scaffolding,
  roster matching, guardian linking, consent flow, partial-failure UI,
  audit.
- Exit: school admin can import rosters; cross-tenant access impossible;
  teacher dashboards receive real roster data.

### S13 — Notifications, messaging, parent–teacher boundaries

- Workspaces: `services/comms-svc`, `apps/mobile`, `apps/web-v2`,
  `packages/brand` email templates.
- Implements notification types, channels (in-app/email/push/optional SMS),
  preference center, parent–teacher messaging boundaries, delivery audit.
- Exit: no IEP leakage in messages; push routes to correct mobile role;
  delivery is auditable.

### S14 — AI safety, moderation, prompt-injection defense, evals, cost

- Workspaces: `services/ai-svc`, `services/responsible-ai-svc`,
  `services/admin-svc`, `packages/observability`.
- Implements input classification, injection detection, age-appropriate
  moderation, crisis escalation, PII/IEP leakage protection, output
  policy validation, model/provider abstraction with fallback/circuit
  breaker, cost controls, eval harness, human review queue.
- Exit: prompt injection tests pass; Homework Helper cannot reveal final
  answers directly; admin can monitor AI quality, safety, latency, and
  cost.

### S15 — TTS, read-aloud, AAC, accessibility, inclusive modes

- Workspaces: `packages/aac-bridge`, `packages/stage-ui`,
  `packages/learner-ui`, `apps/mobile`, `apps/web-v2`.
- Implements TTS/read-aloud, AAC response, accessibility settings,
  WCAG 2.2 AA audit, axe automation, mobile keyboard/keys checks.
- Adds `docs/accessibility/vpat-readiness.md`.
- Exit: read-aloud works in baseline + LessonRun + homework helper;
  accessibility settings persist per learner; no keyboard traps or
  unlabeled critical controls.

### S16 — Security, SOC 2, incident response, backups, release

- Workspaces: `docs/security/`, `infra/`, `.github/workflows/`,
  `services/audit-svc`, `services/admin-svc`.
- Adds threat model, SOC 2 readiness docs (access, change mgmt, incident
  response, vendor mgmt, retention, backup/restore, logging), incident
  runbook, status page, on-call runbook, backup schedule, restore drill,
  RPO/RTO targets, production release checklist.
- Exit: all gates pass (lint, test, build, api:check, prod:check,
  test:production-readiness, test:enterprise, route audit, consent
  audit, brand check, curriculum validate, accessibility tests); no
  production blocker remains.

## How to consume this roadmap

- Treat each sprint's "Exit" line as the merge gate. A sprint is not
  finished if its exit criteria are not met or if any of the standing
  gates regress.
- Updates to this roadmap and to `aivo-lms-vs-legacy-delta.md` go
  together. When a sprint changes the workspace shape (adds a package,
  removes a service, renames a route group), update both documents and
  `scripts/repo-health-check.mjs`.
- This roadmap is the authoritative ordering. Do not start S08 before
  S07, do not start S09 before S08, etc.

# Backend Feature Parity Matrix

> Sprint **GREEN-00** stub; populated by Sprint **GREEN-01**.
> Comparison: AIVO_LMS (this repo) vs. AIVO-AI-LEARNING (legacy reference).
>
> **Rule:** A feature is **green** only when it has real persistence, route
> behavior, auth/role/tenant/consent enforcement, audit logging where
> applicable, and unit + integration tests. **Type-only** existence does not
> count as green.

## Status legend

- 🟢 green — full implementation, all guards, tests pass
- 🟡 yellow — partial implementation or missing tests/guards
- 🔴 red — missing or stubbed; production blocker
- ⚫ excluded — explicitly out of scope with documented reason

## Domains to verify

For each row, GREEN-01 must fill: Legacy exists?, New repo exists?, DB model?,
Migration?, Repository?, API route?, BFF route?, UI consumer?, Auth guard?,
Consent guard?, Tenant guard?, Audit log?, Unit tests?, Integration tests?,
E2E tests?, Status.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1  | Identity / auth (signup, login, MFA, reset) | ⚫ TBD | services/identity-svc exists (currently fails `api:dump`, see P0-003) |
| 2  | Consent + age gates | ⚫ TBD | scanner passes; positive integration tests pending |
| 3  | Parent onboarding | ⚫ TBD | `onboarding:audit` passes |
| 4  | Learner profile | ⚫ TBD | |
| 5  | Parent assessment | ⚫ TBD | |
| 6  | IEP upload + extraction + parent-reviewable accommodations | ⚫ TBD | |
| 7  | Brain profile | ⚫ TBD | services/brain-svc present |
| 8  | Subject brain | ⚫ TBD | services/subject-brain-svc present |
| 9  | Curriculum / skill graph | ⚫ TBD | scanner passes; seeding scope to verify |
| 10 | Baseline assessment | ⚫ TBD | |
| 11 | Mastery map | ⚫ TBD | |
| 12 | LessonRun | ⚫ TBD | services/learning-svc present |
| 13 | Today's Mission | ⚫ TBD | |
| 14 | Homework Helper | ⚫ TBD | services/homework-svc present |
| 15 | Tutor runtime | ⚫ TBD | packages/tutor-runtime present |
| 16 | Responsible AI | ⚫ TBD | services/responsible-ai-svc present |
| 17 | TTS / read-aloud | ⚫ TBD | |
| 18 | Rostering | ⚫ TBD | `rostering:audit` passes |
| 19 | Teacher assignments | ⚫ TBD | |
| 20 | Notifications | ⚫ TBD | services/comms-svc present; `comms:audit` passes |
| 21 | Billing / entitlements | ⚫ TBD | services/billing-svc present; `billing:audit` passes |
| 22 | Admin audit logs | ⚫ TBD | services/audit-svc present |
| 23 | DSAR / export / delete | ⚫ TBD | services/data-governance-svc present |
| 24 | AI cost / quality monitoring | ⚫ TBD | |

## GREEN-01 deliverable

`scripts/backend-parity-check.mjs` (not yet implemented) must read this file
plus per-feature manifests and fail when any row is 🔴 without an
`⚫ excluded` reason.

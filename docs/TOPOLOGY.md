# AIVO-LMS — Repository Topology

This is the canonical source of truth for "where does X live?". It is
maintained alongside the codebase; if you find it out of date,
update it in the same commit as the structural change. See
[ADR 0010](./adr/0010-repo-topology.md) for the underlying decision.

## Top-level

```
AIVO-LMS/
├── apps/               # User-facing applications
├── packages/           # Shared TypeScript libraries
├── services/           # Backend microservices
├── docs/               # ADRs, runbooks, contracts
├── scripts/            # CI + dev tooling (Node)
├── tests/              # Cross-app integration tests
└── attached_assets/    # Spec drafts (not built)
```

## Where each user role lives

All of the role-scoped UIs live inside the single Next.js app at
`apps/web-v2`. Role separation is enforced by `requirePageRole(...)`
and the route prefix:

| Role         | Route prefix        | Source                            |
| ------------ | ------------------- | --------------------------------- |
| Parent       | `/parent/*`         | `apps/web-v2/app/parent/`         |
| Learner      | `/learner/*`        | `apps/web-v2/app/learner/`        |
| Teacher      | `/teacher/*`        | `apps/web-v2/app/teacher/`        |
| Caregiver    | `/caregiver/*`      | `apps/web-v2/app/caregiver/`      |
| Therapist    | `/therapist/*`      | `apps/web-v2/app/therapist/`      |
| School admin | `/admin/school/*`   | `apps/web-v2/app/admin/school/`   |
| District     | `/admin/district/*` | `apps/web-v2/app/admin/district/` |
| Platform     | `/admin/platform/*` | `apps/web-v2/app/admin/platform/` |

**There is no `apps/parent-portal` or `apps/learner-app`.** If you
see those names in an older doc, treat them as aliases for the
`/parent/*` and `/learner/*` routes inside `apps/web-v2`.

## Where the API lives

There is no `apps/api`. The application API is the **BFF** under
`apps/web-v2/app/api/bff/**`. See
[ADR 0008](./adr/0008-unified-api-surface.md). External clients
(mobile app, partner SDKs) consume the BFF via the generated client
in `packages/api-client`.

Microservices in `services/*` are **internal upstreams** of the BFF.
They have their own OpenAPI specs but are not part of the app's
external contract.

## Apps directory

| Path             | Description                                      |
| ---------------- | ------------------------------------------------ |
| `apps/web-v2`    | The Next.js application (all web UI + BFF).      |
| `apps/mobile`    | Expo / React Native mobile app. **Not Flutter.** |
| `apps/marketing` | Static marketing site.                           |

If you need a mobile feature, it lives in `apps/mobile/` (TypeScript +
React Native + Expo). There is no Dart code in this repository.

## Packages directory

Shared libraries used by both `apps/*` and `services/*`. Highlights:

| Path                     | Description                                         |
| ------------------------ | --------------------------------------------------- |
| `packages/db`            | Drizzle ORM schemas, migrations, seed.              |
| `packages/api-client`    | Generated TypeScript client for services + BFF.     |
| `packages/ui`            | Design-system primitives (cards, buttons, layouts). |
| `packages/brand`         | Tokens, logos, subject registry.                    |
| `packages/feature-flags` | Runtime feature flag evaluation.                    |
| `packages/observability` | Logging, tracing, metrics helpers.                  |
| `packages/security`      | Auth helpers, password hashing, CSRF.               |
| `packages/sso`           | SAML / OIDC integration helpers.                    |
| `packages/scheduling`    | Recurrence math + calendar primitives.              |
| `packages/scoring`       | Mastery + spaced-review algorithms.                 |
| `packages/skill-graphs`  | Curriculum graph types + traversal.                 |
| `packages/item-bank`     | Curriculum item bank loader + validation.           |
| `packages/learner-ui`    | Story-book of learner-specific UI surfaces.         |
| `packages/stage-runtime` | Lesson "stage" runtime (lesson player engine).      |

Run `ls packages/` for the full list (34 packages as of this writing).

## Services directory

29 microservices, each in its own folder. The convention is one
service per business capability:

| Service                        | Owns                                       |
| ------------------------------ | ------------------------------------------ |
| `services/identity-svc`        | Users, sessions, SSO callbacks, SCIM.      |
| `services/tenant-svc`          | Tenants, memberships, role permissions.    |
| `services/assessment-svc`      | Baselines, item bank, discovery adventure. |
| `services/brain-svc`           | Brain profile / clone / approval.          |
| &nbsp;&nbsp;↳ `curriculum_engine.py` | Scaffolding-only: rephrases/sequences curriculum-svc nodes. Forbidden from inventing standard codes; validated against curriculum-svc (see [ADR 0040](./adr/0040-curriculum-source-of-truth.md), [ADR 0041](./adr/0041-agentic-boundaries.md)). |
| `services/ai-svc`              | Multi-model LLM gateway, prompt builder.   |
| `services/tutor-svc`           | Real-time tutor chat + safety.             |
| `services/homework-svc`        | Homework help sessions.                    |
| `services/curriculum-svc`      | Curriculum graph + standards alignment.    |
| `services/learning-svc`        | Lesson generation, mastery updates, paths. |
| `services/comms-svc`           | Notifications, email, push.                |
| `services/family-svc`          | Care-team invites, consent flows.          |
| `services/billing-svc`         | Stripe, entitlements, seat assignment.     |
| `services/engagement-svc`      | Streaks, XP, milestones, gamification.     |
| `services/admin-svc`           | District + school admin operations.        |
| `services/recommendation-svc`  | What-to-do-next personalisation.           |
| `services/data-governance-svc` | Data export, deletion, retention.          |
| `services/audit-svc`           | Append-only audit log.                     |
| `services/responsible-ai-svc`  | AI safety, moderation, refusal logging.    |
| `services/integrations-svc`    | Roster sync (Clever, Classlink, Google).   |
| `services/i18n-svc`            | Translation + locale fallback.             |
| `services/speech-eval-svc`     | Pronunciation scoring.                     |
| `services/math-recognizer-svc` | Handwritten-math OCR.                      |
| `services/science-solver-svc`  | Science problem grading.                   |
| `services/subject-brain-svc`   | Per-subject brain config.                  |
| `services/problem-session-svc` | Long-running problem sessions.             |
| `services/research-svc`        | Internal research instrumentation.         |
| `services/status-page-svc`     | Public status page.                        |
| `services/alerts-proxy-svc`    | PagerDuty / Opsgenie webhooks.             |
| `services/integration-svc`     | (Legacy — see `integrations-svc`.)         |

If you're adding a new domain, prefer **extending an existing
service** over creating a new one. A new service is justified when
the domain has independent deploy cadence, a different team, or a
genuinely different data ownership boundary.

## Tests directory

`tests/integration/*` holds tests that span multiple apps + services
(e.g. tenant-isolation gates, production-readiness checks). Per-app
unit tests live under each app's `tests/` or `lib/**/__tests__/`.

## Build + dev tooling

- `pnpm dev` — start all apps in watch mode (via Turborepo).
- `pnpm build` — build everything.
- `pnpm test` — run the full unit suite.
- `pnpm test:integration` — run cross-service integration tests.
- `pnpm api:generate` — regenerate `packages/api-client` from
  service + BFF OpenAPI specs.
- `pnpm typecheck` — TypeScript-only check (no build artefacts).

See `package.json` for the full script list.

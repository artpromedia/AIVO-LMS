# End-to-End User-Journey Gap Analysis & Sprint Prompts — June 2026

> **Role:** e2e system architect pass. **Question asked:** does every user
> journey work end-to-end, and where are the gaps?
> **Method:** traced each journey UI → BFF → service → DB across `apps/web-v2`,
> `apps/mobile`, `services/*`, `packages/*`; then **ground-truthed every claim
> against the running gates** (`pnpm release:gate`, `green:check`,
> `mobile:parity:strict`, `backend:parity`, the domain audits) and against the
> actual source — not against the prior changelogs.
> **Date:** 2026-06-02 · **Branch:** `claude/brave-sagan-kM5Fn`.

## Bottom line

The platform is genuinely mature: the older
`PRODUCTION_READINESS_SPRINT_PROMPTS.md` backlog has, on inspection, **actually
landed** — LTI 1.3 launch persistence (`integration-svc/src/lti/persistence.ts`
inserts into the migration-0045 tables), SIS connectors all `status:"available"`
(Schoology + PowerSchool wired), Speech Buddy telemetry now uses a durable
NATS outbox (`ai-svc/.../speech_buddy/events.py`), AAC sync builds a real board
(`family-svc/.../aac-board.ts`), and the AssistiveWare reverse-highlight is
implemented. Backend parity is **28 green / 0 yellow**. The six primary journeys
are wired end-to-end on the **web** + backend.

**But the repo cannot ship today, and three mobile journeys silently drop user
data.** The two facts the prior "production-ready" write-ups missed:

1. **`release:gate` and `green:check` are RED right now.** `pnpm green:check` =
   **19/29** required gates passing; `pnpm release:gate` = **FAILED, do not
   deploy** (3 failing gates). One is a real regression on this branch.
2. **Three mobile staff/caregiver "save" buttons are fakes** — they pop an
   `Alert.alert("Saved", …)` and navigate back **without any network call**, so
   the data is discarded. One of them (therapist session notes) is a clinical
   blocker.

A fourth: the **"What's Working" parent dashboard** — one of the four headline
neurodiverse features — has a live backend route but **no UI on either client
consumes it**.

## Journey verification matrix

| Journey | Web | Mobile | Backend e2e | Verdict |
| --- | --- | --- | --- | --- |
| **Parent / Caregiver** (signup → learner → interests → Stripe billing → IEP → messages → Speech-Buddy consent) | ✅ | ✅ | ✅ | Works e2e. Gap: *What's Working* surface missing (G7); mobile caregiver observation is a fake save (G6). |
| **Learner** (PIN/login → adaptive IRT baseline → 16 subjects → Stage runtime → 16 surfaces → real-LLM tutor → homework → voice → offline) | ✅ | ✅ | ✅ | Strongest journey. `ux:matrix` 16/16 web+mobile, `tutor:parity` 14/14. Gap: brain-clone route has no mobile screen (G2). |
| **Teacher** (login → roster → assign → progress → IEP authoring → collaboration → messages) | ✅ | ⚠️ | ✅ | Web complete; collaboration authz now tenant-scoped. Gap: mobile teacher-insight is a fake save (G5). |
| **Therapist** (login → caseload → goals → IEP/eligibility → session notes) | ✅ | ⚠️ | ✅ | Goals add fixed. **Gap: mobile session notes is a fake save (G4) — clinical blocker.** |
| **District / School / Platform Admin** (district login + SSO + step-up MFA → tenant split → SIS → LTI → multi-role → seats → data-governance → hash-chained audit → content CMS) | ✅ | n/a | ✅ | Complete. Gaps: Content-CMS storage in-memory (G8); LTI platform-registration admin UI missing (G11). |
| **Internal / Ops** (finance, platform health, AI-cost/budget caps, support/safety dispatch, status page) | ✅ | n/a | ✅ | Real dashboards, live data. Gap: comms SMS channel `not_available` (G9); no general real-time push transport (G10). |

## Gap inventory

Severity: **Blocker** (ships broken / blocks release / loses data), **Incomplete**
(degraded or partial), **Minor** (cleanup). "Code gap" = a flag won't fix it.

### A. Release is RED today

**G1 · [Blocker · code/tooling] `release:gate` + `green:check` fail.**
`pnpm release:gate` → *FAILED — do not deploy*; 3 gates red:

- **`lessonrun:audit` — REAL REGRESSION on this branch.** The new real-LLM
  provider `apps/web-v2/lib/ai/anthropic-tutor.ts:83` imports and calls
  `generateDeterministicLessonPlan(input)` to seed a few-shot prompt example.
  The gate (`scripts/lessonrun-audit.mjs:116-134`) forbids any file other than
  the orchestrator from importing that symbol ("only `generateLessonPlanWithRetry`
  may invoke `generateDeterministicLessonPlan`; reach the orchestrator instead").
  `git log main..HEAD` shows `anthropic-tutor.ts` was added on this branch, so
  this regression was introduced here.
- **`consent:audit` — pre-existing brittle gate (false positive, still red).**
  `scripts/consent-gate-audit.mjs:82` matches `export function
  requireLearnerConsent`, but the code is `export **async** function
  requireLearnerConsent` (`apps/web-v2/lib/bff/consent-guard.ts:25`). The export
  exists; the regex just doesn't allow `async`.
- **`onboarding:audit` — pre-existing brittle gate (false positive, still red).**
  `scripts/onboarding-audit.mjs` requires a `page.tsx` for every readiness
  `hrefTemplate`, but `/learner/select/auto` is correctly a **route handler**
  (`apps/web-v2/app/learner/select/auto/route.ts`) that sets a cookie and
  redirects. The route works; the gate only looks for `page.tsx`.

Net: one real layering regression + two brittle gates that nonetheless keep CI
red. All three must be green for `release:gate` to pass.

### B. Mobile journeys that silently drop data

**G4 · [Blocker · code] Mobile therapist session notes is a fake save.**
`apps/mobile/app/(therapist)/client/[id]/notes.tsx:102-104`:
```ts
onPress={() => {
  Alert.alert("Saved", "Session notes submitted to Brain");  // no network call
  router.back();
}}
```
The web path is real (`apps/web-v2/app/api/bff/therapist/sessions/route.ts`
POSTs SOAP notes), and `sprint12/therapist.spec.ts` proves it — but the mobile
button never calls it. A therapist documenting a session on mobile loses the
note. (Also: the success copy is a hardcoded English string, not `t(...)`.)

**G5 · [Incomplete · code] Mobile teacher insight is a fake save.**
`apps/mobile/app/(teacher)/student/[id]/insight.tsx` pops
`Alert.alert(t("common.success"), …)` with no `apiFetch`; there is no
`/api/bff/teacher/insights` endpoint at all. Captured insight is discarded.

**G6 · [Incomplete · code] Mobile caregiver observation is a fake save.**
`apps/mobile/app/(caregiver)/child/[childId]/observation.tsx` pops a success
alert with no network call — **even though** the web endpoint
`/api/bff/caregiver/observations` already exists. Mobile just never wires it.

### C. Incomplete features

**G2 · [Incomplete · code] `mobile:parity:strict` fails — brain-clone has no
mobile screen.** Web ships `apps/web-v2/app/learner/brain-clone/[learnerId]/page.tsx`,
the parity matrix marks `/learner/brain-clone/[learnerId]` as Parity, but no
`apps/mobile/app/(learner)/brain*` screen exists → `web:parity FAILED with 1
error`. Either build the mobile screen or correct the matrix.

**G7 · [Incomplete · code] "What's Working" dashboard has no UI consumer.** The
backend is live — `services/family-svc/src/routes/whats-working.ts`
(`GET /api/family/whats-working/:learnerId`) over the real `ef_session_outcomes`
ledger — but `grep` finds **zero** references to `WhatsWorkingPanel` /
`whats-working` in `apps/web-v2` **or** `apps/mobile`. One of the four headline
neurodiverse features (best learning window / modality that clicks / frustration
spikes) is backend-only; no parent ever sees it.

**G8 · [Incomplete · code] Content-CMS pack storage is in-memory.**
`services/admin-svc/src/routes/content-cms.ts` holds packs in a process-local
`Map` seeded from `SEED_PACKS` ("A future PR will replace with a `content_packs`
postgres table"). Validate/publish work on one pod but state is lost on restart
and is not shared across replicas — blocks horizontal scaling.

**G3 · [Minor] `check:no-coming-soon` violation.**
`packages/brand/src/subjects.ts:207` contains the literal phrase "coming soon"
in a code comment, tripping `scripts/ci/check-no-coming-soon.mjs`. Reword the
comment or allow-list the line.

### D. Lower severity

**G9 · [Incomplete] comms-svc SMS channel unimplemented** — `sms:"not_available"`
(`services/comms-svc/src/routes/notifications.ts:1086`). Email / push / in-app /
hard-safety dispatch are all real; SMS is the one missing channel.

**G10 · [Incomplete] No general real-time transport.** Speech Buddy has a real
bidirectional WebSocket (`tutor-svc/.../speechBuddy.ts`), but parent live-session
co-view and the messaging inbox use **polling** (6–12 s). Continuity is
shared-DB-read + poll; there is no SSE/WebSocket fan-out for sessions or inbox.

**G11 · [Incomplete] LTI platform-registration admin UI missing.** Launch
persistence + AGS write-back code is ready, but there is no admin screen to
register an LTI platform/deployment (issuer, client_id, keys), so onboarding a
real LMS requires manual DB inserts.

## What's solid (verified, not assumed)

- **Auth & session continuity:** single Postgres `users`/`sessions`, RS256 JWT,
  Argon2; PIN-login mints a refresh session; `x-aivo-active-role` is enforced in
  family/engagement/billing/learning/tutor; district login + step-up MFA +
  tenant scoping covered by e2e specs.
- **Learner core:** real adaptive IRT baseline on **both** clients (no `SAMPLE`),
  16/16 subjects discoverable, 16/16 surfaces full on web **and** mobile
  (`ux:matrix` OK), real Anthropic provider behind the env gate with a
  profile-aware deterministic fallback, persistent idempotent authed offline
  queue.
- **Billing:** Stripe-backed `billing-svc` with webhook + Stripe idempotency,
  dual-path BFF, `billing:audit` OK.
- **Safety:** Speech Buddy LLM Layer-3 judge + DB-backed consent store + parent
  UI; `responsible-ai-svc` runs 7 evaluators per output; `ai-safety:audit` OK.
- **Enterprise:** LTI-0045 persistence, SIS connectors all available,
  hash-chained `admin_audit_log` + verify route, data-governance deletion
  workflow, per-tenant AI budget caps.

## Sprint-by-sprint fix prompts

> Each prompt is self-contained — paste it as one focused sprint/PR on its own
> branch, keep the relevant feature flag, and finish with `pnpm green:check`
> (and `release:gate`) green before merge.

### Sprint 1 — Get CI back to green (unblock release)

```
release:gate is FAILED and green:check is RED (19/29). Make both green without
weakening any real guard.

1. lessonrun:audit (REAL regression): apps/web-v2/lib/ai/anthropic-tutor.ts:83
   imports generateDeterministicLessonPlan to build a few-shot example, which
   scripts/lessonrun-audit.mjs forbids outside the orchestrator. Fix the layering,
   not the gate: have the orchestrator (generateLessonPlanWithRetry / tutor.ts)
   pass the deterministic example INTO the provider's generate(input, example)
   instead of the provider importing it. The provider must no longer import
   generateDeterministicLessonPlan. Keep the deterministic fallback wired in
   tutor.ts (the gate also asserts that).
2. consent:audit (brittle): scripts/consent-gate-audit.mjs:82 regex
   /export function requireLearnerConsent/ does not match the actual
   `export async function`. Update the regex to allow `async` (and add a unit
   note) — do NOT remove the guard. Confirm consent-guard.ts still exports it.
3. onboarding:audit (brittle): scripts/onboarding-audit.mjs only accepts page.tsx
   for a readiness hrefTemplate, but /learner/select/auto is a route.ts handler.
   Teach the resolver to accept a route.ts (Route Handler) as a valid backing
   for an hrefTemplate, then re-run.

Acceptance: `pnpm lessonrun:audit`, `pnpm consent:audit`, `pnpm onboarding:audit`
each exit 0; `pnpm release:gate` prints PASS; `pnpm green:check` shows the three
formerly-red gates green. Add a regression test for the anthropic provider that
asserts it does not import the deterministic generator.
```

### Sprint 2 — Stop mobile from silently dropping staff/caregiver data

```
Three mobile "save" buttons fake success with Alert.alert(...) and no network
call, discarding user input. Wire each to its real backend (the web paths exist).

1. Therapist session notes (Blocker — clinical):
   apps/mobile/app/(therapist)/client/[id]/notes.tsx:102 — replace the fake
   Alert with a useCreateTherapySession() mutation that POSTs to the SAME
   contract the web BFF uses (apps/web-v2/app/api/bff/therapist/sessions/route.ts
   → family-svc), via apiFetch(API.FAMILY, ...). Use the route's :id param
   (currently unused) as the learner/client id. Show real pending/error states;
   only navigate back on 2xx. Replace the hardcoded "Saved" string with t(...).
2. Caregiver observation:
   apps/mobile/app/(caregiver)/child/[childId]/observation.tsx — wire to the
   existing /api/bff/caregiver/observations endpoint (mirror its payload).
3. Teacher insight:
   apps/mobile/app/(teacher)/student/[id]/insight.tsx — there is no backend yet.
   Add a teacher-insight endpoint (family-svc or learning-svc) + BFF, then wire
   the mobile mutation. If scope is tight, ship 1+2 and split 3.

Acceptance: each screen performs a real authenticated request, surfaces
errors, and persists to DB. Add e2e coverage that asserts the BUTTON (not just
the BFF) triggers a network write — a fake-save must fail the test.
Run `pnpm mobile:parity:strict`.
```

### Sprint 3 — Ship the "What's Working" surface (close the headline-four gap)

```
family-svc GET /api/family/whats-working/:learnerId is live over the real
ef_session_outcomes ledger, but NO client renders it (grep WhatsWorkingPanel in
apps/web-v2 and apps/mobile → 0 hits). Surface it.

- Web: add a BFF route (/api/bff/parent/learners/[learnerId]/whats-working) that
  forwards the parent's token to family-svc (dual-path like billing-svc), and a
  WhatsWorkingPanel on the parent learner dashboard showing the three IEP-ready
  signals (best learning window, modality that clicks, where frustration spikes)
  with the windowDays selector. Empty/low-data state when <2 observations.
- Mobile: a parity panel on the parent learner screen via apiFetch(API.FAMILY).
- i18n the copy across all locales.

Acceptance: a parent with seeded ef_session_outcomes sees the three signals on
web and mobile; both call the real endpoint. Add the route to the parity matrix.
```

### Sprint 4 — Mobile brain-clone parity (fix mobile:parity:strict)

```
mobile:parity:strict fails: /learner/brain-clone/[learnerId] is marked Parity but
apps/mobile has no (learner)/brain screen.

- Build apps/mobile/app/(learner)/brain/[learnerId].tsx mirroring the web
  brain-clone view (apps/web-v2/app/learner/brain-clone/[learnerId]/page.tsx),
  reading the same brain-state source, OR — if a mobile brain-clone view is out
  of scope this cycle — correct scripts/web-mobile-parity-check.mjs to classify
  the route honestly (web-only) rather than asserting false parity.

Acceptance: `pnpm mobile:parity:strict` passes; docs/mobile-parity.md regenerated.
```

### Sprint 5 — Content-CMS durable storage

```
services/admin-svc/src/routes/content-cms.ts keeps packs in a process-local Map
(SEED_PACKS) — lost on restart, not shared across replicas.

- Add a content_packs table (+ migration) in packages/db (id, tenant, slug,
  version, status draft|published, manifest jsonb, validated_at, published_at).
- Replace the in-memory store: list/validate/publish read & write the table,
  tenant-scoped, with the @aivo/content-pack validator on validate/publish.
- Keep SEED_PACKS only as a dev seed behind the same gate as other dev seeds.

Acceptance: a published pack survives a restart and is visible from a second
replica. Add an admin-svc integration test so backend:parity sees coverage.
```

### Sprint 6 — Real-time fan-out + comms SMS + LTI registration UI (closeout)

```
Three independent, lower-severity closeouts — split into separate PRs if needed.

A. Real-time transport: add an SSE (or reuse the tutor-svc WS) fan-out for (a)
   parent live-session co-view and (b) the messaging inbox, replacing the 6–12s
   polling with push while keeping polling as the documented fallback.
B. comms-svc SMS: implement the sms channel
   (services/comms-svc/src/routes/notifications.ts:1086 "not_available") behind a
   provider abstraction (Twilio/SNS) + per-tenant opt-in, or formally mark it
   out-of-scope in docs and the channel registry so it isn't a silent stub.
C. LTI platform-registration admin UI: a web admin screen to register/edit LTI
   platforms & deployments (issuer, client_id, JWKS/keys, AGS scopes) writing the
   migration-0045 platform/deployment rows, so onboarding a real LMS needs no
   manual DB inserts. Then add an e2e launch → AGS score write-back test.

Acceptance: messaging/co-view update without a manual reload; SMS is either real
+ tested or explicitly descoped in the registry; an admin can register an LTI
platform from the UI and a launch persists + writes back a score.
```

## Suggested ordering

| Wave | Sprint | Theme | Unblocks |
| --- | --- | --- | --- |
| **Stop the bleeding** | 1 | Green CI | any deploy at all |
| | 2 | Mobile data-loss fixes | therapist/teacher/caregiver mobile trust |
| **Close headline gaps** | 3 | What's Working surface | the 4th neurodiverse feature |
| | 4 | Mobile brain-clone parity | parity gate honesty |
| **Scale & polish** | 5 | Content-CMS persistence | multi-pod admin |
| | 6 | Real-time + SMS + LTI UI | enterprise onboarding + UX |

**Gate after every sprint:** `pnpm green:check` and `pnpm release:gate` (plus
`mobile:parity:strict` for Sprints 2 & 4).

## Evidence index

- Gates run 2026-06-02: `release:gate` FAILED (consent/onboarding/lessonrun);
  `green:check` 19/29; `mobile:parity:strict` 1 error (brain-clone);
  `check:no-coming-soon` 1 violation; `backend:parity` 28 green;
  `ux:matrix`/`tutor:parity`/`billing:audit`/`ai-safety:audit`/`rbac:audit` OK.
- `apps/web-v2/lib/ai/anthropic-tutor.ts:83` — provider imports deterministic gen.
- `scripts/lessonrun-audit.mjs:116-134`; `scripts/consent-gate-audit.mjs:82`;
  `scripts/onboarding-audit.mjs`.
- `apps/mobile/app/(therapist)/client/[id]/notes.tsx:102-104` — fake save.
- `apps/mobile/app/(teacher)/student/[id]/insight.tsx` — fake save, no endpoint.
- `apps/mobile/app/(caregiver)/child/[childId]/observation.tsx` — fake save.
- `services/family-svc/src/routes/whats-working.ts` — live; 0 UI consumers.
- `apps/web-v2/app/learner/brain-clone/[learnerId]/page.tsx` — no mobile twin.
- `services/admin-svc/src/routes/content-cms.ts` — in-memory pack store.
- `services/comms-svc/src/routes/notifications.ts:1086` — `sms:"not_available"`.
- `packages/brand/src/subjects.ts:207` — "coming soon" comment.
- Verified-solid: `integration-svc/src/lti/persistence.ts`,
  `integrations-svc/src/routes/connectors.ts` (all `available`),
  `ai-svc/.../speech_buddy/events.py` (NATS outbox),
  `family-svc/src/lib/aac-board.ts`,
  `packages/aac-bridge/src/adapters/AssistiveWareAdapter.ts` (highlight wired).

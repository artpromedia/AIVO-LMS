# Senior Engineer Persona — Containerized Sprint Prompts (No Stubs, No Placeholders)

> **What this file is.** A single, self-contained ("containerized") prompt pack you
> paste into a coding agent (or hand to an engineer) to close every remaining
> _identified_ gap in this repo. It carries its own persona, its own operating
> contract, the repo's real build/test/gate commands, a **verified** gap
> inventory (with `file:line` evidence), and one fully-specified prompt per
> sprint — naming the exact files to **create** and **edit**.
>
> **Why "containerized".** Each section is hermetic: the persona block, the
> Definition of Done, and every sprint prompt can be copied on their own and
> still make sense. Nothing depends on hidden context. Paste the whole file for
> the full programme, or paste one sprint to run it in isolation.
>
> **Verification basis (2026-06-06).** This pack was written after a fresh sweep
> of `apps/`, `services/`, `packages/`, and the repo's own audit scanners. The
> automated gates `prod:check`, `prod:no-demo`, `persistence:stubs`,
> `backend:parity` (27 green), `tutor:parity` (14/14), and `mobile:parity:strict`
> (115/115) all pass today. The remaining work is therefore **not** "the repo is
> full of stubs" — it is a small, contained set of real, code-level gaps the
> scanners do not flag, plus product/content completeness. Gaps already closed
> since the older gap docs were written (LTI persistence, Speech-Buddy NATS
> outbox, AAC real boards, mobile fake-saves, cross-replica SSE inbox, SMS
> channel, S3 avatars, SIS connectors) are listed in
> [§5 Already closed](#5-already-closed-do-not-re-do) so nobody re-does them.

---

## Table of contents

1. [How to use this container](#1-how-to-use-this-container)
2. [The persona container (paste verbatim)](#2-the-persona-container-paste-verbatim)
3. [Operating contract — Definition of Done](#3-operating-contract--definition-of-done)
4. [Repo facts the persona must know](#4-repo-facts-the-persona-must-know)
5. [Already closed (do not re-do)](#5-already-closed-do-not-re-do)
6. [Verified current gap inventory](#6-verified-current-gap-inventory)
7. [Sprint-by-sprint prompts](#7-sprint-by-sprint-prompts)
   - [Sprint 1 — Green the heavyweight core gates (GA blocker)](#sprint-1--green-the-heavyweight-core-gates-ga-blocker)
   - [Sprint 2 — Expansion-subject micro-surfaces + flip `productionReady`](#sprint-2--expansion-subject-micro-surfaces--flip-productionready)
   - [Sprint 3 — Per-subject content authoring pipeline (fill the surfaces)](#sprint-3--per-subject-content-authoring-pipeline-fill-the-surfaces)
   - [Sprint 4 — Mobile TTS read-aloud + accommodation indicators](#sprint-4--mobile-tts-read-aloud--accommodation-indicators)
   - [Sprint 5 — In-lesson tutor chat panel (web)](#sprint-5--in-lesson-tutor-chat-panel-web)
   - [Sprint 6 — Parity truth-up (surface-type axis + `/learner/calm`)](#sprint-6--parity-truth-up-surface-type-axis--learnercalm)
   - [Sprint 7 — Harden audit-svc DSAR write path](#sprint-7--harden-audit-svc-dsar-write-path)
   - [Sprint 8 — GA sign-off sweep](#sprint-8--ga-sign-off-sweep)
8. [Suggested ordering & ownership](#8-suggested-ordering--ownership)
9. [Evidence index](#9-evidence-index)

---

## 1. How to use this container

- **Run the whole programme:** paste §2 (persona) once to open the session, then
  paste each sprint from §7 in order. Keep one branch + one PR per sprint.
- **Run a single sprint:** paste §2 + §3 + the one sprint block. They are written
  to stand alone.
- **Hand to a human:** §6 is the backlog, §7 is the executable spec, §9 is where
  the evidence lives.
- **Golden rule:** a sprint is not "done" because code was written — it is done
  when its **Definition of Done** in §3 and its sprint-local **Gates** both pass.
  No stubs, no `TODO`, no "coming soon", no fake saves. The repo already has
  scanners that fail the build on those; this pack leans on them on purpose.

---

## 2. The persona container (paste verbatim)

```text
You are AIVO's acting Principal Software Engineer.

Background you embody:
- 30 years shipping production software at Google scale — distributed systems,
  data integrity, security, testing discipline, and "if it isn't tested and
  monitored, it isn't done." You design for failure, idempotency, least
  privilege, and reversibility. You never ship a flag-gated illusion of a
  feature; you ship the feature.
- A second discipline from IDEO-style human-centred design — you start from the
  human in front of the product. For this codebase that human is a neurodiverse
  child and the adults (parents, teachers, therapists, district staff) around
  them. You treat accessibility, sensory load, cognitive load, and dignity as
  functional requirements, not polish. A feature that is technically correct but
  overwhelming to the learner is a defect.

How you work:
1. Understand before you touch. Read the surrounding code, the contract docs in
   docs/, and the existing tests. Match the conventions already in the repo.
2. Make the smallest change that FULLY closes the gap. Complete beats minimal —
   never leave a half-wired path.
3. NO STUBS, NO PLACEHOLDERS, NO TODOs, NO "coming soon", NO fake saves, NO
   deterministic/canned responses left where real behaviour is expected. If you
   cannot finish a path in this sprint, do not merge a fake one — cut the scope
   honestly and say so.
4. Every code change carries tests. Pure logic gets unit tests; routes get
   integration tests; UI gets at least a render/interaction test. Reuse the
   repo's existing test runners (vitest / pytest), do not invent new ones.
5. Security and privacy are non-negotiable: every new HTTP route inherits the
   platform auth contract (JWT verifyJWT + x-aivo-active-role spoof check +
   parent-on-own-kid / learner-on-self / TEACHER / ADMIN / service-token) and a
   rate limit. No secrets in code. No new CodeQL findings.
6. You leave the gates green. You run the relevant repo scanners (listed in the
   sprint) and do not merge red.
7. You write for the next engineer: clear names, comments only where the repo
   already comments, and you update the doc that owns the contract you touched.

Voice: concise, direct, evidence-based. Cite file:line when you describe code.
When you finish, state exactly which gates you ran and their result.
```

---

## 3. Operating contract — Definition of Done

A sprint is **Done** only when **all** of these hold. This is the anti-stub
contract; it is enforceable because the repo already ships the scanners.

- [ ] **No new stubs/placeholders.** `pnpm prod:no-demo` → 0 findings;
      `pnpm prod:check` passes; no new `TODO`/`FIXME`/`coming_soon`/`not implemented`
      in changed files; no `placeholder` UI where a real surface is expected.
- [ ] **No fake persistence.** Any "save" actually writes to Postgres via a
      `services/*` route; `pnpm persistence:stubs` shows no growth.
- [ ] **Auth + rate limit on every new route.** `verifyJWT` + `checkActiveRole`
      (or `registerActiveRoleHook`) + a `@fastify/rate-limit` bucket, matching
      neighbouring routes.
- [ ] **Tests added and green.** Unit for pure logic, integration for routes,
      render/interaction for UI. The relevant `*.test.ts` / `test_*.py` run.
- [ ] **Sprint-local gates green** (each sprint lists its own).
- [ ] **i18n complete** for any new user-facing copy: `pnpm i18n:coverage` → 0
      failures across all locales (do not ship English-only strings to shared
      surfaces).
- [ ] **The owning contract doc is updated** (the relevant file under `docs/`).
- [ ] **CodeQL clean** on the diff (run the security validation; fix real
      findings; justify false positives).

---

## 4. Repo facts the persona must know

> Grounded in the repo and confirmed running on 2026-06-06. Use `corepack pnpm`.

**Topology.** Turborepo + pnpm workspace: 4 apps (`apps/web-v2`,
`apps/web-admin`, `apps/mobile`, `apps/marketing`), ~40 shared `packages/*`, and
27 microservices under `services/*` (Fastify + Postgres/Drizzle; `ai-svc` is
Python/pytest). Node ≥ 22, pnpm 10.26.1.

**Gate / scanner commands (all currently green except the heavyweight core set):**

| Purpose | Command |
| --- | --- |
| Stub/demo scanner | `corepack pnpm prod:no-demo` |
| Production readiness | `corepack pnpm prod:check` |
| Surface contracts | `corepack pnpm prod:surface-contract` |
| Persistence stubs | `corepack pnpm persistence:stubs` |
| Backend parity | `corepack pnpm backend:parity` |
| Tutor parity (14 tutors) | `corepack pnpm tutor:parity` |
| Web⇄mobile route parity | `corepack pnpm mobile:parity:strict` |
| Subject × tutor × surface matrix | `corepack pnpm ux:matrix` |
| i18n coverage | `corepack pnpm i18n:coverage` |
| Release gate | `corepack pnpm release:gate` |

**Per-package build/test/lint (verified patterns):**

- Filtered build/test: `corepack pnpm --filter <pkg> build` / `... test`.
- `@aivo/learner-surfaces`: `corepack pnpm --filter @aivo/learner-surfaces test`
  (vitest) / `... build` (tsc).
- `@aivo/brand`: `corepack pnpm --filter @aivo/brand build` regenerates brand +
  subject + token artifacts — **run it after editing `packages/brand/src/*`.**
- Mobile lint: `corepack pnpm --filter @aivo/mobile lint`.
- `apps/web-v2` lint is `eslint . --max-warnings=0`; the repo-wide
  `@typescript-eslint/no-explicit-any` is `warn`, which **blocks web-v2 CI** — do
  not introduce `any` in web-v2.

**Auth contract.** JWT Fastify services enforce the `x-aivo-active-role` spoof
check via `@aivo/security`: register `registerActiveRoleHook(app)` at bootstrap
or call `checkActiveRole` inline after `verifyJWT`. SSE routes do this too (see
`services/comms-svc/src/routes/inbox-stream.ts`).

**Mobile roles.** District-side mobile users are **TEACHER** and **THERAPIST**
only (normal consumer login). `DISTRICT_ADMIN` + internal staff are web-only.

---

## 5. Already closed (do not re-do)

These appear in older gap docs (`docs/PRODUCTION_READINESS_SPRINT_PROMPTS.md`,
`docs/PLATFORM_GAP_AUDIT_2026-06.md`, `docs/E2E_JOURNEY_GAP_ANALYSIS_2026-06.md`)
but are **implemented now** — verified in code. Skip them.

| Old gap | Now | Evidence |
| --- | --- | --- |
| LTI 1.3 runtime not persisted | Wired | `services/integration-svc/src/lti/persistence.ts`, `routes/lti.ts` |
| Speech-Buddy telemetry log-only | NATS outbox | `services/ai-svc/src/ai_svc/speech_buddy/events.py` (durable outbox → NATS) |
| AAC sync ships empty board | Real board | `services/family-svc/src/routes/language-profile.ts` builds from vocabulary |
| SIS `schoology`/`powerschool` "coming_soon" | `available` | `services/integration-svc/src/routes/connectors.ts:78-99` |
| Mobile therapist/teacher/caregiver "fake save" | Real POSTs | family-svc `therapy-sessions` / `teacher-insights` / `observations` |
| "What's Working" had no UI | Shipped | web `WhatsWorkingPanel`, mobile `WhatsWorkingCard` |
| No real-time inbox transport | Cross-replica SSE | `services/comms-svc/src/routes/inbox-stream.ts` (NATS bus), `apps/web-v2/lib/realtime/use-sse.ts` |
| comms SMS channel `not_available` | Twilio adapter | `services/comms-svc/src/providers/sms-router.ts` |
| Avatars local-only | S3 backend (env-gated) | `services/identity-svc/src/lib/avatar-storage.ts` |
| Content-CMS in-memory | `content_packs` + migration 0057 | admin-svc PackStore |

---

## 6. Verified current gap inventory

Severity: **Blocker** (blocks GA / unsafe), **Incomplete** (degraded/partial),
**Minor** (cleanup/honesty).

| # | Gap | Severity | Evidence |
| --- | --- | --- | --- |
| **G1** | **Heavyweight repo-wide gates are red debt.** `release:gate` core notes the repo-wide `format` / `lint` / `test` / `build` / `api:check` set as "pre-existing repo debt" outside earlier passes. GA cannot ship on green sub-gates while these are red. | Blocker | `docs/E2E_JOURNEY_GAP_ANALYSIS_2026-06.md` post-sprint note ("heavyweight repo-wide `format/lint/test/build/api:check` core gates remain pre-existing repo debt") |
| **G2** | **12 of 16 subjects are not production-ready.** Only Reading, Math, Science, Writing are `productionReady: true`; Social-Emotional, Speech & Language, Executive Function, Life skills, Art, Social Studies, World Languages, Coding, Geography, Music, PE & Health, STEM & Engineering are `false` — no domain-appropriate micro-surface gates them on. | Incomplete | `packages/brand/src/subjects.ts:92-247` (12 × `productionReady: false`) |
| **G3** | **Per-subject content authoring is a content track, not runtime.** Surfaces render with default fixtures; real passages / diagrams / graded item-banks per subject are not authored, so expansion subjects have nothing real to show. | Incomplete | `docs/SUBJECT_TUTOR_UX_GAP_ANALYSIS_AND_SPRINTS.md` §5 ("content track — runtime is ready; authoring is curriculum/SME work"); `docs/quality/tutor-k12-coverage-gap-plan.md` |
| **G4** | **Mobile TTS read-aloud missing + no accommodation indicator UI.** `expo-speech` is not installed; the shared `resolveLessonAccommodations` resolver exists but nothing drives read-aloud on mobile, and the stage runtime exposes only sensory mode (no extended-time / captions chips). | Incomplete | `docs/SUBJECT_TUTOR_UX_GAP_ANALYSIS_AND_SPRINTS.md` §5 (TTS / accommodation-indicator rows) |
| **G5** | **In-lesson tutor chat panel (web) deferred.** Tutor identity is wired into the lesson, but there is no live chat panel; it needs a BFF reply route. | Incomplete | `docs/SUBJECT_TUTOR_UX_GAP_ANALYSIS_AND_SPRINTS.md` §5 (tutor chat panel row) |
| **G6** | **Parity docs not honest on the surface-type axis.** `mobile:parity:strict` warns `/learner/calm` is untracked in `PARITY_MATRIX`; `docs/mobile-parity.md` claims 100% on routes only (no surface-type parity). | Minor | `corepack pnpm mobile:parity:strict` warn (`untracked web route /learner/calm`); `scripts/web-mobile-parity-check.mjs`; `docs/mobile-parity.md` |
| **G7** | **audit-svc DSAR write path is conditionally safe.** The hash-chain anonymize-in-place path carries a documented "must be resolved before enabling writes" caveat; it needs an explicit chain re-verification test before the write path is trusted in production. | Minor (integrity) | `services/audit-svc/src/routes/governance.ts:10-15` |

> Anything not in this table is either already closed (§5) or owned by another
> doc and currently green. Do **not** widen scope silently.

---

## 7. Sprint-by-sprint prompts

> Each block is a complete task. Prepend §2 (persona) and §3 (DoD) when you run
> it. One branch + one PR per sprint. Keep changes behind the existing feature
> flag where one exists.

### Sprint 1 — Green the heavyweight core gates (GA blocker)

**Closes G1.** This unblocks an honest GA sign-off; do it first.

```text
Goal: bring the repo-wide heavyweight gates to green without masking failures.
Run, in order, and fix the REAL failures each surfaces (do not disable rules or
delete tests to pass):
  corepack pnpm format        # prettier --write must produce no diff in CI
  corepack pnpm lint          # eslint across the workspace, max-warnings=0 in web-v2
  corepack pnpm test          # vitest + pytest across packages/services
  corepack pnpm build         # turbo build all
  corepack pnpm api:check      # OpenAPI/contract check

For each failing area:
- Lint: fix the offending code; in apps/web-v2 never silence no-explicit-any with
  `any` — type it properly (the repo-wide rule is "warn" but web-v2 runs
  --max-warnings=0). The root eslint.config.mjs has no react-hooks plugin; do not
  add one as a "fix".
- Test: fix the product code if the test caught a real defect; only adjust a test
  if the test itself is wrong, and explain why in the PR. Never delete a test to
  go green.
- Build: resolve type errors at the source; do not add `// @ts-expect-error`
  without a one-line justification matching the file's existing style.
- api:check: regenerate/realign the contract artifacts the script compares.

Files: scoped to whatever the gates report — do NOT pre-list; let the tools
drive. Touch only what the failures point at.

Definition of Done (this sprint): all five commands above exit 0 locally, plus
`corepack pnpm release:gate` PASS, plus the §3 contract. Capture the before/after
of each gate in the PR description.
```

**Gates:** `format`, `lint`, `test`, `build`, `api:check`, `release:gate`.

---

### Sprint 2 — Expansion-subject micro-surfaces + flip `productionReady`

**Closes G2.** Give every subject a domain-appropriate, real micro-surface and
flip the flag honestly (content alone never flips it — the surface + matrix
cell must be satisfied).

```text
Goal: every learner subject is at least minimally playable with a domain-true
surface, and packages/brand/src/subjects.ts productionReady flags tell the truth.

For each of the 12 subjects currently productionReady:false in
packages/brand/src/subjects.ts (Social-Emotional/harmony, Speech & Language/echo,
Executive Function/compass, Life skills/compass, Art/muse, Social Studies/chrono,
World Languages/lingua, Coding/forge, Geography/atlas, Music/cadence,
PE & Health/vigor, STEM & Engineering/forge): ship at least ONE domain-appropriate
structured micro-surface and route it end-to-end. Examples the gate expects:
  - chrono (Social Studies): timeline / map surface
  - harmony (Social-Emotional): feelings / scenario picker
  - compass (Life skills / Exec-Function): schedule / checklist
  - atlas (Geography): map surface
  - cadence (Music): beat / pitch surface
  - vigor (PE & Health): movement / routine card
  - forge (Coding / STEM): block / step-sequencer surface

Files to CREATE:
- packages/learner-surfaces/src/<SurfaceName>/<SurfaceName>.tsx for each NEW
  surface type, plus its spec type, following the existing surface folder shape.
- packages/learner-surfaces/src/<SurfaceName>/<SurfaceName>.test.tsx (render +
  interaction).
- apps/mobile/app/(learner)/baseline/<subject-runner>.tsx — a dedicated mobile
  Discovery baseline runner (intro / why / readiness / subject multi-select) so
  baseline is not the generic stage runtime (MOB-LRN-004 in
  docs/mobile/parity-sprint-plan.md).

Files to EDIT:
- packages/learner-surfaces/src/types.ts — declare the new surface type(s).
- packages/learner-surfaces/src/SurfaceRouter/surface-type-map.ts — add to
  SUPPORTED_RUNTIME_TYPES and the render branch.
- packages/learner-surfaces/src/SurfaceRouter/SurfaceRouterItem (item-based
  router) — add the render branch + extend RouterSurfaceType so the lesson
  player actually emits the surface.
- packages/learner-surfaces/src/entitlement/required-tutor.ts — map each new
  surface to its owning tutor(s); support multiple owners (echo+lingua pattern).
- apps/mobile/src/components/learning/MobileSurfaceRenderer.tsx — add the case
  for each new surface so mobile renders it (no blank fallbacks).
- packages/brand/src/subjects.ts — flip productionReady:true ONLY for subjects
  whose surface + ux:matrix cell + curriculum gate are all satisfied; leave the
  rest false rather than lie. Then run `corepack pnpm --filter @aivo/brand build`.
- scripts/web-mobile-parity-check.mjs — add a surface-type + subject-visibility
  axis (handed off to Sprint 6 if large).

No stubs: a flipped subject MUST render a real, interactive surface on BOTH web
and mobile. A subject with no real surface stays productionReady:false — that is
honest, not a gap.

Tests: per-surface render/interaction tests; a routing test that asserts every
declared surface type resolves in both routers; mobile renderer test covering the
new cases.
```

**Gates:** `corepack pnpm ux:matrix` (no H/O cells for flipped subjects),
`corepack pnpm tutor:parity`, `corepack pnpm --filter @aivo/learner-surfaces test`,
`corepack pnpm --filter @aivo/mobile lint`, `prod:no-demo`, plus §3.

---

### Sprint 3 — Per-subject content authoring pipeline (fill the surfaces)

**Closes G3.** Runtime is ready; this makes lessons routinely surface real,
graded content instead of default fixtures.

```text
Goal: stand up a repeatable authoring pipeline so each subject has real,
grade-banded content (passages, diagrams, item banks) that the lesson player
emits — replacing the coherent-but-generic default fixtures.

Files to EDIT/EXTEND (reuse, do not reinvent):
- packages/item-bank/src/* — author calibrated items per subject/grade band; the
  CLI import path (packages/item-bank/src/cli/import.ts) already parses authored
  content — remove the parser "Hack:" shortcut at import.ts:155 with a proper
  parse if you touch it.
- packages/content-pack/* — add content-pack manifests + validators for each
  newly-authored subject; keep the existing manifest schema.
- packages/skill-graphs/* — extend seed data so authored items map onto skill
  nodes for mastery/scoring.
- services/curriculum-svc/src/routes/* — serve the authored packs (this service
  is the shared catalog authority).
- services/admin-svc content-cms surface — load authored packs through the
  existing PackStore (content_packs table, migration 0057), not in-memory.

Files to CREATE:
- packages/content-pack/seed/<subject>/*.json — the authored packs per subject,
  validated by the existing content-pack validator (NO empty arrays, NO
  lorem-ipsum, NO TODO items — the validator + prod:no-demo must reject empties).
- packages/item-bank/test/<subject>.test.ts — assert calibration + coverage.

Reference the curriculum coverage plan: docs/quality/tutor-k12-coverage-gap-plan.md.

No stubs: every authored pack ships REAL content reviewed against the coverage
plan. An unauthored subject keeps its default fixture AND stays
productionReady:false — do not flip a flag on empty content.

Tests: content-pack validator tests reject empty/placeholder packs; item-bank
calibration tests; a curriculum-svc integration test that serves an authored pack
and the lesson player emits its surface.
```

**Gates:** `corepack pnpm curriculum:coverage` (if present) or the coverage
script named in the plan, `corepack pnpm --filter @aivo/item-bank test`,
`backend:parity`, `persistence:stubs`, `prod:no-demo`, plus §3.

---

### Sprint 4 — Mobile TTS read-aloud + accommodation indicators

**Closes G4.** Accessibility is a functional requirement for this audience.

```text
Goal: learners on mobile can have lesson content read aloud, and the stage
runtime visibly indicates active accommodations (extended-time / captions /
read-aloud) — driven by the EXISTING resolveLessonAccommodations resolver.

Files to EDIT:
- apps/mobile/package.json — add the `expo-speech` dependency (the resolver is
  already in place to drive it). Install via the workspace package manager.
- apps/mobile/hooks/ — add a useReadAloud hook wrapping expo-speech, honoring the
  learner's resolved accommodations + sensory mode (respect reduced-motion/quiet).
- apps/mobile/src/components/learning/MobileSurfaceRenderer.tsx (and the lesson
  screen) — wire a read-aloud control that speaks the active beat's text.
- The stage runtime a11y surface (packages/stage-ui / packages/stage-runtime or
  the web/mobile stage screens) — add an accommodation-indicator chip row
  (extended-time / captions / read-aloud) fed by a learner a11y-prefs hook; today
  only sensory mode is exposed.

Files to CREATE:
- A learner a11y-prefs hook (e.g. apps/mobile/hooks/useAccommodations.ts and/or a
  shared package hook) that reads resolved accommodations for the active learner.
- Tests for the read-aloud hook (mock expo-speech) and the indicator component.

No stubs: the read-aloud control must actually speak via expo-speech (not log);
the indicator must reflect REAL resolved accommodations, not hardcoded chips.

i18n: any new control labels go through the catalog across all locales
(i18n:coverage 0 failures).
```

**Gates:** `corepack pnpm --filter @aivo/mobile lint`,
`corepack pnpm i18n:coverage`, the stage-ui/stage-runtime tests,
`mobile:parity:strict` if routes change, plus §3.

---

### Sprint 5 — In-lesson tutor chat panel (web)

**Closes G5.**

```text
Goal: a live, in-lesson tutor chat panel on web that talks to the real tutor
runtime (the tutor identity is already wired into the lesson; this adds the
conversation).

Files to CREATE:
- apps/web-v2/app/api/bff/learner/lesson/[sessionId]/tutor-reply/route.ts — a BFF
  reply route that forwards a learner message + lesson/tutor context to
  services/tutor-svc (POST /api/tutor session reply), returning the real tutor
  turn. JWT + active-role + rate-limit + parent/learner-on-self scope.
- apps/web-v2/components/learner/tutor-chat-panel.tsx — the panel UI (message
  list, input, streaming or polled reply, reduced-motion aware).
- Tests: a BFF route test (auth + happy path + rate-limit) and a panel
  render/interaction test.

Files to EDIT:
- The web lesson/stage screen under apps/web-v2/app/learner/** — mount the panel,
  passing the lesson's already-resolved tutor identity.
- services/tutor-svc/src/routes/* — only if a reply endpoint shape is missing;
  reuse the existing tutor session route if present (tutorSession.ts) rather than
  adding a parallel one.

No stubs: the panel must render REAL tutor-svc replies (the anthropic-backed
tutor runtime), not lib/homework/tutor.ts canned content. Do not reintroduce the
deterministic generator into the response path.

Auth: BFF route enforces verifyJWT + checkActiveRole + parent-on-own-kid /
learner-on-self, with a per-route rate-limit bucket.
```

**Gates:** `corepack pnpm --filter @aivo/web-v2 lint`,
`corepack pnpm --filter @aivo/web-v2 test`, `tutor:parity`, `prod:no-demo`,
plus §3.

---

### Sprint 6 — Parity truth-up (surface-type axis + `/learner/calm`)

**Closes G6.** Make the parity story honest; this is cleanup but it gates GA
sign-off because the docs are read as truth.

```text
Goal: parity tooling and docs reflect reality on BOTH the route axis and the
surface-type axis, with no untracked routes.

Files to EDIT:
- scripts/web-mobile-parity-check.mjs — (a) add /learner/calm to PARITY_MATRIX
  (or classify it web-only with a reason if it has no mobile analogue), clearing
  the current `untracked web route /learner/calm` warning; (b) extend the check
  with a surface-type parity axis + subject-visibility axis (folding in any
  scaffolding from Sprint 2).
- docs/mobile-parity.md — regenerate so its summary reports surface-type parity
  honestly, not a route-only "100%". Use the script's generator
  (`mobile:parity:md`) rather than hand-editing.

No stubs: the regenerated doc must be produced by the script, not hand-faked. If
a surface gap exists, the doc must SHOW it (honesty over a green number).

Tests: a unit test for the new parity axes in the script, asserting it flags a
synthetic surface mismatch.
```

**Gates:** `corepack pnpm mobile:parity:strict` (no warns, matrix matches disk),
`corepack pnpm mobile:parity:md`, plus §3.

---

### Sprint 7 — Harden audit-svc DSAR write path

**Closes G7.** Small, integrity-critical.

```text
Goal: prove the DSAR anonymize-in-place write path keeps the audit hash chain
verifiable, removing the "must be resolved before enabling writes" caveat with a
test instead of a comment.

Files to EDIT:
- services/audit-svc/src/routes/governance.ts — keep the anonymize-in-place
  approach (NULL actor PII columns, never touch prevHash/hash, never delete
  rows). Resolve the caveat at lines 10-15 by pointing it at the new proof test.

Files to CREATE:
- services/audit-svc/test/governance-chain.test.ts — seed a chain of audit_events,
  run the DSAR erase() anonymization, then run the existing forward-chain verifier
  and assert each row's prevHash still equals the prior row's hash (chain intact)
  AND actor PII is nulled for the subject. Cover the n=0 (no rows) path too.

No stubs: the test must exercise the REAL governance erase() and the REAL chain
verifier — not a mock that asserts nothing.
```

**Gates:** `corepack pnpm --filter audit-svc test` (or the service's pytest/vitest
runner), `backend:parity`, plus §3.

---

### Sprint 8 — GA sign-off sweep

**Closeout.** Confirms the whole programme landed with nothing faked.

```text
Goal: a single, honest GA sign-off. Run every gate; capture results; update the
enterprise readiness sign-off doc.

Run and record (all must pass):
  corepack pnpm prod:check
  corepack pnpm prod:no-demo
  corepack pnpm persistence:stubs
  corepack pnpm backend:parity
  corepack pnpm tutor:parity
  corepack pnpm mobile:parity:strict
  corepack pnpm ux:matrix
  corepack pnpm i18n:coverage
  corepack pnpm release:gate
  corepack pnpm format && corepack pnpm lint && corepack pnpm test && corepack pnpm build && corepack pnpm api:check

Files to EDIT:
- docs/ENTERPRISE_READINESS_SIGNOFF_2026-06.md — record the post-programme gate
  state and check off the closed gaps (G1–G7) with evidence.
- docs/SENIOR_ENGINEER_PERSONA_SPRINT_PROMPTS.md (this file) — move each closed
  gap from §6 into a "closed" note so the next reader does not re-do it.

No stubs: do not check off a gap whose gate is red. If something is still
deferred, say so explicitly with the reason and the follow-up.
```

**Gates:** every command above green.

---

## 8. Suggested ordering & ownership

| Wave | Sprints | Theme | Unblocks |
| --- | --- | --- | --- |
| Unblock | 1 | Green the heavyweight core gates | honest GA sign-off |
| Product breadth | 2, 3 | Real surfaces + authored content for all subjects | full catalog coherence |
| Accessibility & engagement | 4, 5 | Mobile read-aloud + accommodations + tutor chat | SpEd value, learner dignity |
| Honesty & integrity | 6, 7 | Parity truth-up + audit DSAR proof | trustworthy docs + compliance |
| Closeout | 8 | GA sign-off sweep | release |

**Gate to run after every sprint:** that sprint's listed gates **plus**
`corepack pnpm prod:no-demo` and `corepack pnpm prod:check` (the anti-stub
backstop).

---

## 9. Evidence index

- Subjects + `productionReady` flags — `packages/brand/src/subjects.ts:75-247`.
- Tutor catalog (14) — `packages/brand/src/index.ts`.
- Surface types + routers — `packages/learner-surfaces/src/types.ts`,
  `packages/learner-surfaces/src/SurfaceRouter/surface-type-map.ts`.
- Surface → tutor entitlement — `packages/learner-surfaces/src/entitlement/required-tutor.ts`.
- Mobile surface renderer — `apps/mobile/src/components/learning/MobileSurfaceRenderer.tsx`.
- Cross-replica SSE inbox — `services/comms-svc/src/routes/inbox-stream.ts`,
  `apps/web-v2/lib/realtime/use-sse.ts`.
- LTI persistence — `services/integration-svc/src/lti/persistence.ts`,
  `services/integration-svc/src/routes/lti.ts`.
- Speech-Buddy NATS outbox — `services/ai-svc/src/ai_svc/speech_buddy/events.py`.
- AAC board build — `services/family-svc/src/routes/language-profile.ts`.
- SIS connectors — `services/integration-svc/src/routes/connectors.ts`.
- SMS adapter — `services/comms-svc/src/providers/sms-router.ts`.
- Avatar storage (S3 env-gated) — `services/identity-svc/src/lib/avatar-storage.ts`.
- Audit DSAR write path — `services/audit-svc/src/routes/governance.ts:10-15`.
- Parity tooling — `scripts/web-mobile-parity-check.mjs`, `docs/mobile-parity.md`.
- Prior gap docs (context) — `docs/E2E_JOURNEY_GAP_ANALYSIS_2026-06.md`,
  `docs/PLATFORM_GAP_AUDIT_2026-06.md`,
  `docs/PRODUCTION_READINESS_SPRINT_PROMPTS.md`,
  `docs/SUBJECT_TUTOR_UX_GAP_ANALYSIS_AND_SPRINTS.md`,
  `docs/quality/tutor-k12-coverage-gap-plan.md`.
```

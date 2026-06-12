# Sprint 08 — Web data layer & feedback: one mutation/query path, toasts, zero swallowed errors in the lesson

## Goal

At the end of this sprint, web-v2 has **one sanctioned client data path** — TanStack Query + a typed BFF client + a toast/announcement layer — and the three most critical client surfaces run on it: the **lesson player** (whose six `.catch(() => {})` silently eat failures today), the **messages inbox**, and the **parent learner-detail panels**. A mid-lesson network failure becomes a visible, recoverable event (toast + retry + offline outbox) instead of silent data loss. A ratchet gate prevents new bare `fetch(` calls in client code. Closes audit gap **M3 (⚠️)**: 128 raw `fetch(` sites, react-query installed-but-unused, `@radix-ui/react-toast` dead.

## Context

- **Already installed, unused:** `@tanstack/react-query@^5.62.0` is in `apps/web-v2/package.json` dependencies; `@radix-ui/react-toast` likewise. `apps/web-v2/components/ui/toast.tsx` exists but only re-exports styled Radix primitives (`ToastProvider`, `ToastViewport`, `Toast`, `ToastTitle/Description/Action` — lines 7-37) — **no viewport is mounted and no hook exists; zero consumers** (verified).
- **BFF envelope:** every BFF route returns the `ok()`/`fail()` shape from `apps/web-v2/lib/bff/response.ts` with error codes from `lib/bff/errors.ts`. The client layer must parse this envelope once, centrally.
- **Verified hot spots:**
  - `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx` — swallowed catches at `:345, :374, :462, :470, :616, :632`; it already has an idempotent offline outbox (`enqueueOutbox` + `generateIdempotencyKey` — grep the file for their import to find the lib) and `aria-live` status at `:305`.
  - `apps/web-v2/app/messages/messages-inbox.tsx` — raw `fetch().catch(() => ({}))` at `:49, :66, :107, :130`.
  - Parent learner detail panels: `WhatsWorkingPanel` and `PendingRecommendationsPanel` rendered by `apps/web-v2/app/parent/learners/[learnerId]/page.tsx` (components live under `apps/web-v2/components/parent/` — locate by name).
- **Architecture rule to encode:** server components keep fetching on the server (repos/BFF — unchanged); **client islands** use Query hooks through the typed client. `@aivo/api-client` (`packages/api-client`, exports `.`, `./learning`, `./react`, per-service modules like `family-svc.ts`) peer-depends on react-query — check whether its `./react` entry already provides hook factories before writing new ones; prefer consuming it over duplicating.
- **State primitives for error/empty UI:** `apps/web-v2/components/ui/{error-state,retry-panel,banner,skeleton}.tsx`.
- **Root layout:** `apps/web-v2/app/layout.tsx` (server; force-dynamic). Client providers mount via small `"use client"` wrapper components (see `components/system/sensory-mode-provider.tsx` for the house pattern).
- **Ratchet-gate precedent:** `scripts/ci/` already hosts gates (`bundle-budget.mjs` + `bundle-budgets.json`, `check-no-coming-soon.mjs`); CI wiring in `.github/workflows/ci.yml` (`repo-tests` job at `:41`, lint at `:20`). Mobile's vitest coverage ratchet is the cultural precedent for "numbers may only go down".

## Work orders

### DELETE
1. The six `.catch(() => {})` / `.catch(() => undefined)` expressions in `lesson-player.tsx` (lines above) — each replaced per REFACTOR-2, never merely removed.
2. The `.catch(() => ({}))` fallbacks in `messages-inbox.tsx` (`:49, :66, :107, :130`) — replaced per REFACTOR-3.

### CREATE
1. `apps/web-v2/components/system/query-provider.tsx` — `"use client"`; creates one `QueryClient` (defaults: `retry: 2` with exponential backoff for queries; mutations retry only when the call carries an idempotency key; `staleTime: 30_000`; `refetchOnWindowFocus: false` to respect calm UX). Mounted in `app/layout.tsx` around the existing provider stack.
2. `apps/web-v2/lib/api/client.ts` — typed `bffFetch<T>(path, init)` that: attaches JSON headers, parses the `ok/fail` envelope, throws a typed `BffError { code, message, status, requestId }` on failure, and never returns `{}` on error. All client hooks go through it. (If `@aivo/api-client`'s react entry already offers an equivalent envelope-aware fetcher, adapt/wrap it instead of duplicating — decide after reading `packages/api-client/src/react*` and record the decision in the checkpoint.)
3. `apps/web-v2/lib/use-toast.tsx` + `apps/web-v2/components/ui/toaster.tsx` — imperative `toast({ title, description?, variant: "default" | "success" | "danger", action? })` store + `<Toaster />` viewport composing the existing primitives in `components/ui/toast.tsx`. Requirements: viewport `role="region"` labeled; default/success toasts `role="status"` (polite), danger `role="alert"`; auto-dismiss ≥ 6s with focusable dismiss; durations/motion via brand tokens — animations must respect `prefers-reduced-motion`/`data-sensory-mode` (zero-duration at motionScale 0); max 3 stacked. Mount `<Toaster />` in `app/layout.tsx`.
4. `scripts/ci/check-bare-fetch.mjs` + `scripts/ci/bare-fetch-budget.json` — counts `fetch(` occurrences in files under `apps/web-v2/{app,components}` whose source contains `"use client"`, excluding `lib/api/client.ts`, the outbox lib, tests, and `.next`. Fails if count exceeds the recorded budget; budget file is set to the **post-sprint actual** (record the number). Wire it as a step in the `lint-and-typecheck` job in `.github/workflows/ci.yml` (no `continue-on-error`).
5. Unit tests: `lib/api/client.test.ts` (envelope parsing, error typing), `lib/use-toast.test.tsx` (queueing, variants, reduced-motion path).

### REFACTOR
1. `apps/web-v2/app/layout.tsx` — mount `QueryProvider` + `<Toaster />` (smallest possible client boundary; everything else stays server).
2. `lesson-player.tsx` — convert its imperative calls (`POST /step`, `POST /complete`, hint/TTS/audio side-calls — the six catch sites) to `useMutation` via `bffFetch`:
   - step/complete keep their idempotency keys and **on network failure enqueue to the existing outbox** (current behavior, now explicit) + `toast` "Saved on this device — will sync when you're back online" (i18n, shame-free) + update the existing `aria-live` status (`:305`);
   - non-critical side-calls (audio prewarm etc.) get explicit `onError` that logs via the app's logger and degrades the feature visibly where relevant (e.g., read-aloud button disabled state) — silence is no longer an option;
   - success paths announce via the existing live region, not a toast (don't toast every beat — only failures/recovery).
   Keep this surgical: no file restructuring (Sprint 12 does that); the mutation hooks may live in a colocated `lesson-player-mutations.ts` to avoid growing the god file.
3. `messages-inbox.tsx` — list + send via `useQuery`/`useMutation`; loading renders `components/ui/skeleton.tsx` rows; error renders `retry-panel.tsx` with a working retry; send failure → danger toast + input content preserved.
4. Parent panels (`WhatsWorkingPanel`, `PendingRecommendationsPanel`) — same conversion; approve/decline actions in the recommendations panel get optimistic updates with rollback-on-error + toast.

### EDIT
1. `eslint.config.mjs` — add a `no-restricted-syntax` (or `no-restricted-globals`) entry scoped to `apps/web-v2/components/**` flagging direct `fetch(` with the message "use lib/api/client (bffFetch) or a Query hook"; allowlist `lib/api/client.ts` and the outbox lib via overrides. (The CREATE-4 script is the harder cross-cutting gate; the lint rule is the in-editor signal.)
2. New i18n keys for all toast strings (10 catalogs).
3. `README.md` dev-conventions blurb (or `docs/dev/` if a conventions doc exists — check): three lines stating the data-path rule.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. Manual chaos test (`corepack pnpm --filter @aivo/web-v2 dev`, learner session): start a lesson, set DevTools → Network → Offline, answer a beat → toast confirms local save, lesson continues; go online → outbox flushes (verify the step landed via the parent lessons view or the BFF response in the network tab). No console-silent failures.
2. Messages: with the BFF forced to 500 (temporarily throw in the route during local testing only — revert), the inbox shows the retry panel; retry works after reverting.
3. `grep -n "catch(() => {})\|catch(() => undefined)\|catch(() => ({}))" apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx apps/web-v2/app/messages/messages-inbox.tsx` → **zero hits**.
4. `node scripts/ci/check-bare-fetch.mjs` passes with the recorded budget; budget number reported in the checkpoint.
5. Commands green: web-v2 `typecheck`, `lint`, `test`, `exec playwright test lesson-player messages` (all existing lesson-player suites + any messages spec), `run test:a11y` (toasts must not introduce violations).

## Tests

- New: client/envelope tests, toast tests (CREATE-5); a Playwright addition to one lesson-player spec simulating offline (`context.setOffline(true)`) asserting the toast appears and the run completes after reconnect.
- Update: any messages/parent-panel tests touching the old fetch shape.
- Run the **full** web-v2 unit + e2e suites; green stays green.

## Out of scope

- Migrating the remaining ~100 fetch sites (the ratchet handles them over time — record the budget, don't chase it). Admin app (separate pattern, Sprint 10). Lesson-player decomposition (Sprint 12). Server-component data fetching (already correct). Removing `@aivo/ops-alert` (Sprint 14).

## Depends on

Nothing hard. Sprints 09 and 12 depend on this one.

## Checkpoint

Summarize: the new data-path architecture (one diagram-in-text), every converted call site (file:line before → after), the bare-fetch budget number, chaos-test evidence, DoD outputs. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**

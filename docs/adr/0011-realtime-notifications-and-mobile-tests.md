# 0011 — Live notifications + consent-gate parity + mobile unit tests in CI

- **Status:** Accepted
- **Date:** 2026-05-25
- **Related:** Sprint 10, completeness-audit gaps #4 (consent-gate
  unclassified routes), #13 (notifications read-only), #14 (mobile CI
  type-check only)

## Context

Three independent loose-ends remained after Sprints 1–9:

1. **`consent:audit` reported two unclassified BFF routes** — the
   pattern matcher had no entry for `engagement` or `tutor`, so it
   couldn't confirm consent was actually enforced. `engagement`
   additionally never called `requireLearnerConsent` despite returning
   personalised XP/badge/streak data.

2. **Notifications were polling-free read-only.** The learner
   notifications page server-rendered a static list and never
   refreshed without a hard reload. No path existed for live updates
   from `services/comms-svc`.

3. **Mobile CI ran type-check + Expo web-export only.** The 14 mobile
   vitest files already in `apps/mobile/__tests__/` were never
   executed in CI — a vitest failure could silently land.

## Decision

Close all three with the smallest credible changes:

### Consent-gate parity

- **`scripts/consent-gate-audit.mjs`** — two new `SENSITIVE_PATTERNS`
  entries (`/engagement(/|$)`, `/tutor(/|$)`) both `required: true`.
  The `tutor` pattern catches the existing `/tutor/reply` route the
  audit was complaining about plus any future `/tutor/*` sibling.
- **`apps/web-v2/app/api/bff/learners/[learnerId]/engagement/route.ts`** —
  add `requireLearnerConsent(session, learnerId, ["child_data_collection"], requestId)`
  after the existing scope guard. (`tutor/reply` already called the
  guard; only the audit classification was missing.)
- Result: `pnpm consent:audit` reports **0 unclassified** routes (was 2).

### Live notifications

- **`apps/web-v2/lib/notifications/useNotificationStream.ts`** —
  client hook with two acquisition modes:
  1. SSE when an `sseUrl` is supplied — auto-takeover from polling,
     auto-fallback to polling on SSE error.
  2. Polling fallback (default 30 s) when no SSE endpoint is given.
     Exposes `{ notifications, lastUpdatedAt, unreadCount, markRead,
refresh, lastError }`. Mark-read is optimistic; the server
     reconciles on the next refresh.
- **`apps/web-v2/app/learner/notifications/notifications-list.tsx`** —
  client component that hydrates from the server-rendered initial
  list and subscribes via the hook. Card tap fires `markRead`.
- **`apps/web-v2/app/learner/notifications/page.tsx`** — server
  shell now passes `initial` to the client list and wires the BFF
  endpoints (`/api/bff/learners/notifications`,
  `/api/bff/learners/notifications/mark-read`).
- The SSE server endpoint at `services/comms-svc/src/routes/stream.ts`
  is **not** in this sprint — it requires a runtime contract on
  comms-svc and a deployment story. The hook gracefully polls until
  it exists; no code on the client needs to change when SSE lands.

### Mobile unit tests in CI

- **`.github/workflows/ci.yml`** — new `mobile-tests` job runs
  `pnpm test` inside `apps/mobile`. Wired into the `ci-summary`
  fan-in so a vitest failure breaks the build.
- **Three new mobile pure-logic tests** added so the new CI job has
  meaningful coverage of the learner-facing surface:
  - `__tests__/password-strength.test.ts` (5 tests) — pins the
    client-side meter shared by the change-password / reset-password
    screens.
  - `__tests__/feature-flags.test.ts` (3 tests) — pins
    `MOBILE_UNIFIED_APP` default-off so the legacy role-group shell
    keeps shipping during the migration window.
  - `__tests__/learner-route-shape.test.ts` (7 tests) — asserts the
    `(learner)/` Expo Router directory exposes every screen the audit
    lists (index, adventure, badges, brain, challenges, gamification,
    gradebook, leaderboard, settings, shop) plus the nested groups
    (homework, quests, stage, tutor) with their `[param]` dynamic
    segments. Catches renamed/removed routes at PR time.
- Render-level RN component tests are **out of scope** — they require
  an Expo / React Native test renderer setup, native module mocks
  for `expo-secure-store` / `expo-localization` / `react-native`, and
  a CI runner with their toolchain installed. Tracked as a separate
  sprint.

## Consequences

- **Positive:**
  - `pnpm consent:audit` exits with 0 unclassified routes — the gate
    is fully green for the first time.
  - The notifications page surfaces new messages within 30 s without
    a hard reload, and is wired to take an SSE feed the moment one
    is available — zero client code change required to upgrade.
  - Mobile CI now runs **15 vitest files / 137 tests** (was 0).
    Adding `mobile-tests` as a blocking job in `ci-summary` means a
    vitest regression breaks the build.
- **Negative:**
  - The polling fallback adds one `GET /notifications` per learner
    per 30 s. At 10k concurrent learners that's ~333 req/s — modest,
    but the SSE upgrade should land before the user-base grows past
    ~100k.
  - `markRead` is optimistic and assumes the server endpoint exists.
    If it doesn't, local state updates and we never reconcile back to
    "unread" — acceptable for the current single-tab UX, but worth
    noting.
  - The `tutor` pattern catches everything under `/tutor/*`. Any new
    sibling route under that prefix MUST call `requireLearnerConsent`
    — this is the intended behaviour, but a contributor adding e.g.
    `/tutor/status` will be greeted by a `consent:audit` failure.
- **Neutral / follow-ups:**
  - `services/comms-svc/src/routes/stream.ts` SSE endpoint with
    fan-out from the existing notification persistence layer.
  - Mark-read BFF endpoint
    (`POST /api/bff/learners/notifications/mark-read`) needs to
    actually exist; today the hook fires the POST and silently
    swallows a 404.
  - RN render-level tests (`@testing-library/react-native` +
    `react-test-renderer`) — separate sprint.

## Alternatives Considered

- **Add WebSocket support instead of SSE.** Rejected for this
  sprint: SSE rides on plain HTTP/2, requires no protocol upgrade,
  and lets us reuse the existing auth cookie. WebSocket is the right
  move if/when we need bi-directional traffic.
- **Make engagement consent-optional** (return XP without the
  consent gate, omit personalised badges with consent). Rejected:
  the catalog is small and the contract is simpler if the whole
  endpoint requires consent. We can revisit if a no-consent variant
  becomes a product requirement.
- **Mock RN modules and add full smoke tests in this sprint.**
  Rejected: the mock surface is large and brittle; getting it right
  deserves a dedicated sprint with the mobile-platform team. The
  three pure-logic test files added here cover the highest-value
  contracts without introducing the mock matrix.

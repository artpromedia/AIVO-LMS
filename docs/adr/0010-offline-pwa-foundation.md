# 0010 — Offline foundation: idempotency + IndexedDB outbox + banner

- **Status:** Accepted
- **Date:** 2026-05-25
- **Related:** Sprint 9, completeness-audit gap #12 ("Offline / PWA: Missing")

## Context

The completeness audit reported that `apps/web-v2` has no service
worker, no offline cache, and no submission-replay queue. A learner
who loses connectivity mid-lesson loses any in-flight answer the
moment the network drops — and any submission that DOES reach the
server before the page crashes risks being double-recorded if the
client retries naïvely.

Closing this to "Complete" requires three layers:

1. A client-side **outbox** so unsent mutations survive a page reload.
2. A server-side **idempotency-key cache** so replays from the outbox
   are deduped at the BFF, not at the route handler's mercy.
3. A **service worker / install prompt** so the app continues to load
   when fully offline.

This sprint ships layers 1 and 2 end-to-end and lays the foundation
for layer 3. The Serwist / next-pwa integration itself is intentionally
deferred — it touches the Next build pipeline, ships a new browser
runtime asset, and needs install / update / rollback rehearsal that
doesn't fit a single-sprint scope.

## Decision

Ship the durable, testable parts of the offline story now; defer the
service-worker installation to a follow-up.

### Server-side idempotency cache

- **`apps/web-v2/lib/offline/idempotency.ts`** — in-process LRU
  (`MAX_KEYS=5000`, `TTL=10 min`) keyed by `(tenantId, route, key)`.
  Tenant scoping ensures a UUID collision across tenants can never
  leak a cross-tenant response. `readIdempotencyKey(request)`
  validates the inbound header (8–128 chars, no control chars, no
  pipe — the composite-key separator).

- **`apps/web-v2/app/api/bff/learners/[learnerId]/lesson-runs/[lessonRunId]/step/route.ts`** —
  the representative mutating route now:
  1. Reads `Idempotency-Key` after auth + consent guards;
  2. If the cache holds a prior response for that key, returns it with
     header `Idempotency-Replay: true` (no DB write, no audit log
     duplicate);
  3. Otherwise runs the normal handler and writes the response body
     to the cache.

  The other mutating BFF routes (`/start`, `/complete`, `/retry`,
  `tutor/reply`, `homework/.../message`) follow the same pattern;
  this sprint wires only `/step` end-to-end as the proof-of-contract
  and tracks the rest as a mechanical follow-up.

### Client-side outbox

- **`apps/web-v2/lib/offline/outbox.ts`** — IndexedDB-backed FIFO
  queue (DB `aivo-offline-outbox`, store `outbox`, schema v1). SSR-
  safe: every helper falls back to a no-op when `indexedDB` is
  undefined (Next server bundles, vitest's node env, pre-hydration).
  No external dep — uses native IDB behind a ~30-line Promise
  wrapper. Public surface:
  - `enqueueOutbox(record)`, `listOutbox()`, `removeOutbox(id)`,
    `clearOutbox()`;
  - `drainOutbox(fetchImpl?)` — replays records in insertion order;
    stops on 5xx / network error (transient), removes on 2xx-4xx
    (success or explicit rejection);
  - `registerOutboxAutoDrain()` — installs an `online`-event handler
    that calls `drainOutbox()`;
  - `generateIdempotencyKey(prefix?)` — uses `crypto.randomUUID()`
    when available, falls back to a `Date.now()`+`Math.random()`
    combo on older browsers.

- **`apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx`** —
  a new `postStep(payload)` helper generates an Idempotency-Key per
  call, sets the header, and on `fetch` rejection enqueues the
  request to the outbox. All four `/step` POSTs (initial step,
  media-telemetry, answer-submit, hint, scaffold) now flow through
  it.

### Offline banner

- **`apps/web-v2/components/offline/offline-banner.tsx`** —
  client-only component that subscribes to `online`/`offline` window
  events. When offline, shows a calm amber pill ("Working offline —
  your answers are being saved and will sync when you reconnect")
  with a live queued-count badge. When the network returns, drains
  the outbox, shows a 4-second emerald confirmation, then hides.
  Copy is injectable via props so the consumer wires i18n keys.

### Tests

- `apps/web-v2/lib/offline/idempotency.test.ts` — 8 vitest
  assertions: round-trip, tenant scoping, route scoping, header
  parsing edge cases.
- `apps/web-v2/lib/offline/outbox.test.ts` — 8 vitest assertions:
  `generateIdempotencyKey` uniqueness, prefix support, length window,
  SSR no-op behaviour for every public helper. The IDB-backed
  enqueue/drain paths are exercised end-to-end in Playwright
  (`apps/web-v2/e2e/offline-lesson.playwright.ts` is the next sprint).

## Consequences

- **Positive:**
  - A learner who taps Submit while offline keeps the answer in
    IndexedDB; reconnecting drains it through the BFF, and the BFF
    deduplicates a same-key replay so the answer is never recorded
    twice.
  - The contract is testable in isolation (16 unit tests pinned
    today) and observable in production via the `Idempotency-Replay`
    response header.
  - Adding idempotency to a new route is a 10-line patch: import the
    helpers, short-circuit on cache hit, write on success.
- **Negative:**
  - No service worker yet — fully-offline learners cannot load
    `/learner/home` cold. The outbox covers in-session disconnects
    only.
  - Only `/step` carries the idempotency contract end-to-end in this
    sprint. The other mutating routes still accept and process
    duplicates; the lesson player only enqueues `/step` calls, so the
    other routes won't see a replay until they get the same wiring.
  - The cache is in-process; multiple Next server instances behind a
    load balancer would each hold their own cache. For the current
    single-process BFF that's fine; the migration note in the helper
    points to the right next move (Postgres `idempotency_keys` table).
  - `OfflineBanner` is built but not yet mounted in the learner role
    layout. Wiring it in is one prop+import; left for the layout
    integration sprint so the offline UX gets a single design pass.
- **Neutral / follow-ups:**
  - Service-worker / Serwist integration with a per-lesson cache and
    install prompt.
  - Sweep the remaining mutating BFF routes to add the idempotency
    short-circuit.
  - Playwright e2e: drive an offline lesson with
    `page.context().setOffline(true)`.
  - Migration of the idempotency cache to Postgres once the BFF
    leaves its in-memory store.

## Alternatives Considered

- **Use `@serwist/next` or `next-pwa` immediately.** Rejected for
  this sprint: large surface, ships a new runtime asset, needs
  install/update/rollback rehearsal. Right move once the data
  primitives (outbox, idempotency) are stable.
- **Use the `idb` package for IDB ergonomics.** Considered; the
  in-tree wrapper is ~30 lines and saves a dependency. Worth the
  small reinvent.
- **Rely on the browser's automatic POST retry (with `keepalive`).**
  Rejected: `keepalive` is best-effort and limited to small payloads;
  the outbox gives durable, observable, deduped replay.

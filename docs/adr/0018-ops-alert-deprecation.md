# 0018 — Deprecate `@aivo/ops-alert` in favor of `@aivo/ops-alerts`

- **Status:** Accepted
- **Date:** 2026-05-26
- **Deciders:** Platform Engineering, SRE
- **Related:** `packages/ops-alert/package.json` (already carries
  `"deprecated"` marker), `packages/ops-alerts/`, `services/alerts-proxy-svc/`,
  Sprint 12.6 (this ADR)

## Context

The repository ships two packages with confusingly similar names:

- `@aivo/ops-alert` (singular, legacy) — the original fire-and-forget
  HTTP client every service used to push a webhook into the ops alert
  channel. No durability, no retry, no outbox. If the receiver was
  down the alert was lost.
- `@aivo/ops-alerts` (plural, current) — the v2.1 §9.1 dedup design:
  every alert goes into a per-service durable outbox table, drained by
  `alerts-proxy-svc` (the canonical egress) with retry + backoff. A
  `LegacyOpsAlertClient` shim is exported so old callers can upgrade
  by changing only the import path.

The `package.json` for `@aivo/ops-alert` already carries a `"deprecated"`
marker (`"deprecated": "v2.1 §9.1 dedup: use @aivo/ops-alerts (...)"`)
and emits a console warning when imported, but the package itself is
still present in the workspace and still consumed by the
`background-jobs-tests` CI job for its own unit-test coverage.

## Decision

1. `@aivo/ops-alert` is **deprecated** as of this ADR. New code MUST
   import from `@aivo/ops-alerts` (use the `LegacyOpsAlertClient` export
   if the calling code needs the old fire-and-forget shape).
2. `scripts/repo-health-check.mjs` continues to warn on the presence of
   `packages/ops-alert/` (and only on that package — the other formerly-warned
   workspaces are silenced in this sprint). The warning is the deliberate
   "delete me before S16" smoke alarm.
3. The package is **scheduled for removal in Sprint 16** (S16). At that
   point:
   - The `packages/ops-alert/` directory is deleted.
   - The `background-jobs-tests` CI job drops the `--filter @aivo/ops-alert`
     build and test steps.
   - Any remaining importers (audited via `pnpm why @aivo/ops-alert`)
     must be migrated to `@aivo/ops-alerts` before the deletion lands.
4. Between now and S16, no new imports of `@aivo/ops-alert` may be
   added. A pre-merge guard (`scripts/ci/check-no-coming-soon.mjs`
   pattern) can be extended in S14 if drift is observed.

## Consequences

**Positive**

- A single, deterministic alert pipeline (outbox → `alerts-proxy-svc`)
  removes the "did the alert go out?" guesswork during incidents.
- One less package in the workspace; one less name-collision footgun
  for new contributors.

**Negative**

- One more deprecation cliff to coordinate across services that still
  import the legacy package. The migration is mechanical (rename the
  import + swap to `LegacyOpsAlertClient`), but it does require a
  cross-service PR window during S16.

## Migration cheat-sheet

```ts
// before
import { sendOpsAlert } from "@aivo/ops-alert";

// after
import { LegacyOpsAlertClient } from "@aivo/ops-alerts";
const client = new LegacyOpsAlertClient({ service: "my-svc" });
await client.send({ severity: "warning", message: "..." });
```

When the importer can be rewritten to use the durable outbox directly
(preferred), drop the legacy client entirely and call
`enqueueOpsAlert(db, ...)` from `@aivo/ops-alerts` instead.

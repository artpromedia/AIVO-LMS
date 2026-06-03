# Runbook — Reports & Exports Troubleshooting

Common failures in `services/reports-svc` and how to fix them. Architecture
is in ADR 0039. For SRE incident handling see
`docs/runbooks/incident-response.md`.

## Where to look first

For any report problem, gather these three before diagnosing:

- **The run record** — `GET /api/reports/runs/{runId}` gives status, format,
  params (scrubbed), error, and **lineage** (`report_run_lineage`: each
  source `service` / `query` / `queryVersion`). Lineage tells you *which
  upstream* produced — or failed to produce — the rows.
- **Audit events** (ADR 0032 / Sprint 3 audit UI) — every run, download, and
  schedule create/delete is audited. `GET /events?q=<runId>` or
  `?action=reports.run` reconstructs who ran what, over which tenants, when.
- **`/metrics`** — per-service Prometheus metrics (run latency, error rate,
  queue depth when BullMQ is enabled), plus the relevant Grafana board.

## Run stuck in "running"

A run that never reaches `succeeded`/`failed`.

- **Inline mode (default):** a run executes synchronously in the request, so
  a stuck `running` means the request itself hung — check the resolver and
  its upstream service (see "Slow runs"). Inline runs don't get orphaned in
  the store under normal operation.
- **Worker mode (`REDIS_URL` set):** the run was enqueued to a BullMQ
  per-format queue (`reports:csv|json|parquet|pdf`, `src/runners/queue.ts`)
  and the **worker pod is down** or **Redis is unreachable**.
  - Confirm Redis connectivity (the service logs the queue connection at
    boot) and that the per-format worker deployment has ready replicas — the
    **PDF worker runs in its own pod** (it needs a browser).
  - Inspect queue depth via `/metrics`; a growing `reports:*` queue with no
    completions = stalled workers. Restart the worker deployment; re-drive
    the run with `POST /api/reports/{id}/run` (idempotent on cache key).
  - As a fallback, the engine can run **inline** (unset/ignore `REDIS_URL`)
    to unblock a single urgent report.

## 429 — quota exceeded

Per-tenant **daily** quota is **1000 runs/day** (`report_quota_daily`);
exceeding it returns `429`.

- Inspect usage: the UI shows the tenant's daily usage; the count lives in
  `report_quota_daily` keyed by tenant + day. The audit log
  (`action=reports.run`, filtered by tenant) corroborates the volume and
  shows *who/what* is consuming it.
- Common cause: a misconfigured schedule or a client loop re-running the same
  report instead of reading the **cache** (see "Cache staleness") or reusing
  a `runId`.
- To raise the limit: the quota is per-tenant; bump it for the specific
  tenant (config), not globally — the cap exists to protect upstream
  services. Treat a sustained legitimate breach as a sign the caller should
  be scheduling + caching rather than re-running.

## 403 — SCOPE_FORBIDDEN / TENANT_FORBIDDEN

RBAC denials (ADR 0039 §2).

- **`SCOPE_FORBIDDEN`** — the caller's scope is below the report's scope
  (`scopeAllows`), e.g. a **school admin** running a **district** report. By
  design that report is also **hidden** from their catalog
  (`catalogForScope`), so this usually means a stale link or a direct API
  call. Confirm the caller's role and the report's `scopes[]`.
- **`TENANT_FORBIDDEN`** — a `tenantId` param is **not in the caller's
  allow-list** (`resolveCallerScope`, `src/scope.ts`). District admins may
  only pass tenants in their district; school admins only their own. Check
  the param against the caller's `allowedTenantIds`; a forged/over-broad
  tenant is the usual cause (and is correctly refused).

## PDF rendering failures

PDF is **branded** and rendered via **Playwright** in a **separate worker
pod** (`src/runners/pdf.ts`).

- If the browser is unavailable, the engine **falls back to branded HTML**
  rather than failing — correct content, different container. If users report
  "I got HTML, not a PDF", the PDF worker/browser is the cause, not the data.
- Check: the PDF worker pod is running and its browser is installed; the
  `reports:pdf` queue is draining; per-tenant `Branding` resolved (a missing
  brand asset degrades styling, not the run).
- Fix: restart/scale the PDF worker pod; verify the browser image; re-drive
  the run. CSV/JSON/Parquet are unaffected (different encoders).

## Parquet / CSV mismatch (snapshot drift)

Encoders are deterministic — **CSV is RFC-4180**, the **Parquet container is
a deterministic stand-in** (byte-stable for the same rows), JSON carries rows
+ schema.

- A snapshot test drifting, or two formats disagreeing on values, means the
  **rows or the column schema changed**, not the encoder. Diff the resolver
  output and the definition's `columns[]`.
- Use **lineage** on the run to see if an upstream `queryVersion` changed
  (e.g. `v1`->`v2`) — that's the legitimate reason a number moved; bump the
  snapshot deliberately after review.
- Remember Parquet here is a **stand-in writer**; if you're validating
  against an external Parquet reader, expect the swap-to-real-writer caveat
  (ADR 0039 Consequences).

## Schedule not delivering

Scheduled deliveries (`report_schedules`, `POST|GET /api/reports/schedules`).

- **Unverified recipient** — deliveries go **only to verified recipients
  within the caller's scope**. An unverified or out-of-scope recipient is
  silently not delivered. Verify the recipient and that they're inside the
  scheduler's scope.
- **Cron / worker** — the schedule fires on a cron; confirm the scheduler/
  worker is running and `REDIS_URL` (if workers are enabled) is reachable.
  Check the audit log for `reports.schedule` create events to confirm the
  schedule exists and wasn't deleted (`DELETE /api/reports/schedules/{id}`).
- Confirm the underlying run isn't itself `429`-throttled by the tenant
  quota at fire time.

## Cache staleness

Results are cached per `cacheTtl`, keyed on
`reportId + params + tenant + format` (`cacheKeyOf`).

- "Numbers look old" usually means a cache hit within `cacheTtl`. The fix is
  **not** to hammer re-runs (that burns quota) — either wait out the TTL, or
  lower the report's `cacheTtl` if the data genuinely changes faster than the
  current TTL assumes.
- A different `format` or any changed param is a different cache key, so it
  recomputes — useful to force a fresh pull when needed.

## Slow runs

A run that completes but takes too long.

- The engine is fast on seeded data and well under the **30s** budget; slow
  runs almost always mean the **resolver's upstream service** is slow. Use
  **lineage** to see which `service`/`query` was consulted, then check that
  service's health and `/metrics`.
- Check run-latency metrics and the Grafana board; correlate by tenant — a
  single tenant's large result set can dominate.
- Mitigations: tune the resolver/upstream query, raise `cacheTtl` so repeat
  pulls hit cache, or (worker mode) ensure the per-format queue isn't
  back-pressured behind a slow PDF render.

## Quick reference

| Symptom | Likely cause | First check |
|---|---|---|
| Run stuck `running` | Worker/Redis down (worker mode) or hung resolver | queue depth in `/metrics`, worker pod, lineage |
| `429` | Per-tenant daily quota (1000/day) | `report_quota_daily`, `reports.run` audit volume |
| `403 SCOPE_FORBIDDEN` | Caller scope < report scope | role vs report `scopes[]` |
| `403 TENANT_FORBIDDEN` | `tenantId` outside allow-list | `resolveCallerScope` / `allowedTenantIds` |
| Got HTML not PDF | Playwright pod/browser unavailable | PDF worker pod, `reports:pdf` queue |
| Snapshot/format mismatch | Rows or column schema changed | resolver output, `columns[]`, lineage `queryVersion` |
| Schedule silent | Unverified/out-of-scope recipient, or cron down | recipient verification, scheduler, `reports.schedule` audit |
| Stale numbers | Cache hit within `cacheTtl` | report `cacheTtl`, cache key |
| Slow run | Upstream service slow | lineage source, that service's `/metrics` |

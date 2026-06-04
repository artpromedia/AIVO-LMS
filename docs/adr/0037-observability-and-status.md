# 0037 — Observability & Status: public status page, SLOs/error budgets, and tenant-aware tracing

- **Status:** Accepted
- **Date:** 2026-06-03
- **Related:** Sprint 8 — Status, Health, Incidents, Observability;
  `services/status-page-svc`, `services/alerts-proxy-svc`,
  `packages/otel-bootstrap`, `apps/web-v2/app/admin/platform/status`,
  the public `/status` page, `ops/dashboards`; ADR 0032 (audit),
  ADR 0036 (responsible AI).

## Context

AIVO is a multi-tenant SaaS on Kubernetes. Operating it to a district SLA
requires four things we did not previously have in one place:

- a **public status page** (and per-tenant/district status views) that
  communicates incidents and maintenance honestly and quickly;
- **per-tenant health** aggregation so a district can see _its own_
  availability, not just a global green/red;
- **SLOs with error budgets and burn-rate alerting** so paging is driven
  by user-visible budget burn rather than raw symptom noise; and
- **end-to-end tracing** that carries `tenant_id` through every hop, so a
  trace and its structured logs can be filtered to a single tenant during
  an incident.

This ADR records the design of the three components delivered in Sprint 8
and the deliberate choice of a self-contained trace-context implementation
over the full OpenTelemetry SDK for our current build environment.

## Decision

### 1. Status page — components, incidents, maintenance

`status-page-svc` models:

- **Components** with a **dependency rollup**: a component's effective
  status is the worst of its own status and its dependencies', so a single
  upstream degradation surfaces correctly on everything that depends on it.
- **Incidents** with the lifecycle
  **`investigating → identified → monitoring → resolved`** plus an
  append-only **updates feed**; each update is the unit of public
  communication.
- **Scheduled maintenance** windows.
- **Subscribers** over **email / webhook / RSS**.
- A public, cacheable summary at
  `GET /api/statuspage/public/summary` — **tenant-scopable** and cached
  **30s** — that backs the public `/status` page and the district/school
  status views.

### 2. SLO math & error-budget burn rate

`alerts-proxy-svc` stores **SLO definitions** (`target`, `windowDays`,
`indicatorQuery`) and computes budgets and burn rates as pure functions
(`services/alerts-proxy-svc/src/slo/slo-math.ts`):

```
totalEvents   = goodEvents + badEvents
errorBudget   = totalEvents * (1 - target)        # allowed bad events
consumed      = badEvents
remaining     = errorBudget - consumed            # may go negative
observedSli   = goodEvents / totalEvents

burnRate          = badRate / (1 - target)        # badRate = bad fraction over a lookback window
timeToExhaustion  = (windowDays * 24) / burnRate  # hours, ∞ when not burning
```

A **burn rate of 1** exhausts the whole-window budget exactly at the end
of the window; `> 1` exhausts it early. Paging uses the **Google SRE
multi-window, multi-burn-rate** rule: page only when a **fast window
(1h)** _and_ a **slow window (6h)** both exceed the threshold, so a brief
spike does not page but a sustained burn does
(`shouldPageOnBurn({ fastWindowBurn, slowWindowBurn, threshold })`).

**Public-page threshold:** a component is shown degraded/partial-outage on
the public page when its error budget is materially burning (sustained
multi-window burn ≥ threshold) rather than on raw alert noise.

### 3. Alertmanager intake → dedupe → auto-incident → public page

`alerts-proxy-svc` exposes an **Alertmanager webhook** intake that:

- **Dedupes** by a **fingerprint over the alert labels**, window-based, so
  a flapping alert collapses to one logical event
  (`services/alerts-proxy-svc/src/slo/dedupe.ts`);
- on a **critical** alert, **auto-creates an incident** by POSTing to
  `status-page-svc`, so a sev-critical symptom appears on the public
  `/status` page **within 60s** without a human in the loop; and
- maintains **per-tenant health aggregation** from the same stream.

### 4. `packages/otel-bootstrap` — tenant-aware tracing & logs

One import per service brings:

- **W3C Trace Context** (`traceparent`) parse/format and **W3C Baggage**
  carrying **`tenant_id`** (`packages/otel-bootstrap/src/trace-context.ts`).
  The trace context is **injected at the BFF** (the first hop that knows
  the tenant) and **asserted present in every service span** — a span
  without a trace context or tenant baggage is a wiring bug, not a silent
  default.
- **Structured JSON logs** carrying `trace_id` and `tenant_id` on every
  line, so logs join to traces and filter to a tenant.
- A Prometheus **`/metrics`** endpoint per service
  (`http_requests_total`, `http_request_duration_seconds`, …) with
  per-tenant labels, which is what the `ops/dashboards/*` Grafana boards
  query.

**Why a self-contained tracer instead of the full OTel SDK:** our build
environment is offline/restricted, and pulling the full OpenTelemetry SDK

- exporters is undesirable there. The implementation is intentionally
  **spec-compliant on the wire** (`00-<32hex>-<16hex>-<flags>` traceparent;
  `key=value,...` baggage), so swapping in the real OTel SDK once collectors
  are deployed is a **drop-in** change — the propagation format other systems
  see does not change.

### 5. RBAC

| Capability                    | platform_admin | district_admin | school_admin | other admins |
| ----------------------------- | :------------: | :------------: | :----------: | :----------: |
| Declare / edit incidents      |       ✅       |       ❌       |      ❌      |      ❌      |
| Post incident updates         |       ✅       |       ❌       |      ❌      |      ❌      |
| Schedule maintenance          |       ✅       |       ❌       |      ❌      |      ❌      |
| Define / edit SLOs            |       ✅       |       ❌       |      ❌      |      ❌      |
| View status (own scope)       |       ✅       |       ✅       |      ✅      |      ✅      |
| Subscribe (email/webhook/RSS) |       ✅       |       ✅       |      ✅      |      ✅      |

Declaring incidents and scheduling maintenance are **platform-only**;
viewing and subscribing are available to all admins (and, for the public
summary, anonymously).

## Alternatives considered

- **Statuspage.io / Incident.io (SaaS).** Rejected: no native per-tenant
  scoping against our hierarchy, data egress, recurring cost, and weaker
  coupling to our SLO/error-budget math and audit chain.
- **Full OpenTelemetry SDK now.** Deferred, not rejected: the wire format
  is kept compatible so we adopt the SDK when collectors are deployed,
  without re-instrumenting services.

## Consequences

**Positive**

- **One observability import per service** gives consistent tenant-aware
  traces, logs, and metrics.
- **Public transparency**: incidents and maintenance reach the `/status`
  page automatically and quickly (auto-incident within 60s).
- Paging is **error-budget-driven** (multi-window burn rate), reducing
  noise and tying alerts to user-visible impact.

**Negative / risks**

- The status, SLO, and dedupe **stores are in-memory today**; durable
  persistence is a tracked follow-up (migrations exist).
- The **lightweight tracer must be swapped** to the OTel SDK once
  collectors are available; until then we lack the full SDK's
  instrumentation breadth (we have propagation, structured logs, and
  Prom metrics).

## References

- Trace context / baggage: `packages/otel-bootstrap/src/trace-context.ts`
- SLO & burn-rate math: `services/alerts-proxy-svc/src/slo/slo-math.ts`
- Alert dedupe: `services/alerts-proxy-svc/src/slo/dedupe.ts`
- Dashboards: `ops/dashboards/` (service-health, slo-error-budget, responsible-ai)
- Migrations: `services/status-page-svc/src/db/migrations/`, `services/alerts-proxy-svc/src/db/migrations/`
- Google SRE Workbook — multi-window, multi-burn-rate alerting
- W3C Trace Context and W3C Baggage specifications

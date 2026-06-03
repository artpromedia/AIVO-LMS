# Grafana dashboards (`ops/dashboards`)

Grafana-importable dashboard JSON for AIVO's observability stack (Sprint 8 —
ADR 0037) plus the Responsible AI console (Sprint 7 — ADR 0036). They query
the Prometheus metrics exposed by every service via `packages/otel-bootstrap`
(`/metrics`): `http_requests_total`, `http_request_duration_seconds`, and the
AI-specific series listed below — all carrying per-tenant labels.

## Dashboards

| File | UID | Purpose |
|------|-----|---------|
| `service-health.json` | `aivo-service-health` | RED method across services: request **rate**, **errors** (5xx %), **duration** p50/p95/p99, plus top tenants by traffic. |
| `slo-error-budget.json` | `aivo-slo-error-budget` | SLO compliance (observed SLI vs target), **error-budget remaining**, multi-window **burn-rate** (1h fast / 6h slow), and the page condition. |
| `responsible-ai.json` | `aivo-responsible-ai` | AI **call volume**, **blocked calls** (`ai.call.blocked`) by reason, eval **pass rates** by metric, and per-model **usage / cost**. |

## The `tenant_id` template variable

Every dashboard declares a **`tenant_id`** template variable (multi-select,
includes **All** → regex `.*`). It is populated from
`label_values(http_requests_total, tenant_id)` (or `ai_calls_total` for the
RAI board). The `tenant_id` label is sourced from the **W3C baggage**
`tenant_id` injected at the BFF and propagated through every span/log/metric
(ADR 0037, `packages/otel-bootstrap/src/trace-context.ts`). Select one or
more tenants to scope every panel to a district/school — the same per-tenant
filtering the public status page and per-tenant health aggregation use.

`service-health` and `slo-error-budget` also expose a `service` variable;
`slo-error-budget` adds an `slo_target` variable (0.99 / 0.995 / 0.999) so
the budget/burn math can be evaluated against any target without editing
PromQL. `responsible-ai` adds a `model_id` variable.

`${DS_PROMETHEUS}` is a datasource placeholder Grafana resolves on import.

## How these map to the SLOs in `alerts-proxy-svc`

The SLO/error-budget panels implement the **same math** as
`services/alerts-proxy-svc/src/slo/slo-math.ts`, so the dashboard and the
pager agree:

```
errorBudget = totalEvents * (1 - target)
remaining   = errorBudget - badEvents          # gauge: % remaining
burnRate    = badRate / (1 - target)           # badRate = 5xx fraction over the lookback
```

- **Burn-rate panels** compute `(5xx fraction over [1h] / 6h]) / (1 - target)`,
  matching `burnRate(target, badRate)`.
- **The page condition** panel implements
  `shouldPageOnBurn({ fastWindowBurn, slowWindowBurn, threshold })` — it
  shows `PAGE` only when **both** the 1h and 6h burn rates clear the
  threshold (default 6), the Google SRE multi-window multi-burn-rate rule
  `alerts-proxy-svc` uses to decide paging and critical **auto-incident**
  creation on the status page.
- An SLO row in `alerts-proxy-svc` (`target`, `windowDays`, `indicatorQuery`)
  corresponds to one selection of the `service` / `slo_target` variables here;
  point the panels at the same indicator query to mirror a specific SLO.

## RAI metric series (Sprint 7)

The RAI board expects these series (per-tenant, per-model labels):
`ai_calls_total`, `ai_call_blocked_total{reason}` (emitted alongside the
`ai.call.blocked` audit event on a gateway deny — reasons include `OPT_OUT`,
`MODEL_RETIRED`, `MODEL_UNKNOWN`, `RAI_UNAVAILABLE`), `rai_eval_score{metric}`
(metrics: `safety`, `accuracy`, `bias`, `refusalRate`, `hallucination`), and
`ai_call_cost_usd_total`.

## Importing

Grafana UI → Dashboards → Import → upload the JSON (or paste it), then pick
the Prometheus datasource for `${DS_PROMETHEUS}`. The JSON is linted/validated
in CI; keep it well-formed (`node -e "JSON.parse(...)"`).

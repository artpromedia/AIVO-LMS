# AIVO Grafana dashboards (Sprint 12)

Two dashboards land in this directory:

| File | What it covers |
|---|---|
| `baseline-ops.json` | Baseline / AI pipeline — latency p50/p95/p99, fallback share, RA block rate, prompt-cache hit rate, LLM spend per tenant, top violation codes, IEP draft validation failures, PRE_SYMBOLIC count. |
| `role-dashboards.json` | BFF request rate by surface, therapist write rate, caregiver observation submissions, IEP draft lifecycle transitions, school-dashboard p95, active sessions by role. |

## Import

```bash
# Via grafana-cli (per-instance)
grafana-cli admin import-dashboard infra/grafana/baseline-ops.json
grafana-cli admin import-dashboard infra/grafana/role-dashboards.json

# Via terraform-grafana (preferred for prod — pinned to a folder + version)
resource "grafana_dashboard" "baseline_ops" {
  config_json = file("${path.module}/../grafana/baseline-ops.json")
  folder      = grafana_folder.aivo.id
}
```

## Required Prometheus metrics

The dashboards depend on the following metric names. The
`packages/observability` module exposes helpers to record them; verify
each service emits them with the labels listed.

| Metric | Source | Labels |
|---|---|---|
| `aivo_baseline_generated_total` | assessment-svc | `tenant_id`, `functioning_level`, `source` |
| `aivo_baseline_shipped_total` | assessment-svc | `tenant_id`, `source` (`ai` / `ai+fallback` / `fallback`) |
| `aivo_baseline_fallback_total` | assessment-svc | `tenant_id`, `reason` |
| `aivo_baseline_latency_seconds` (histogram) | assessment-svc | `tenant_id` |
| `aivo_responsible_ai_verdicts_total` | assessment-svc / ai-svc | `action` (`allow`/`block`/`revise`/`escalate`), `severity` |
| `aivo_responsible_ai_violation_total` | responsible-ai-svc | `code` |
| `aivo_llm_completion_total` | ai-svc | `model`, `tenant_id` |
| `aivo_llm_cache_hit_total` | ai-svc | `model`, `tenant_id` |
| `aivo_llm_cost_cents_total` | ai-svc | `model`, `tenant_id` |
| `aivo_tenant_llm_daily_cap_cents` (gauge) | admin-svc | `tenant_id` |
| `aivo_iep_draft_attempt_total` | ai-svc | `tenant_id` |
| `aivo_iep_draft_validation_failure_total` | ai-svc | `tenant_id` |
| `aivo_iep_draft_transitions_total` | web-v2 BFF | `from`, `to` |
| `aivo_bff_request_total` | web-v2 BFF | `surface`, `method`, `status` |
| `aivo_bff_latency_seconds` (histogram) | web-v2 BFF | `surface` |
| `aivo_auth_session_active_total` | identity-svc | `role` |

When the metric isn't emitted yet, the panel renders empty rather than
breaking the dashboard — register the missing recorder in the relevant
service before relying on the alert.

## Alert routing

`infra/prometheus/aivo-slo-alerts.yaml` references three severity
labels:

- `severity=page` → PagerDuty primary on-call (immediate ack)
- `severity=ops` → Slack `#aivo-ops` (working hours)
- `severity=triage` → Slack `#aivo-ai-safety` (next business day)

Wire the corresponding Alertmanager routes in your
`alertmanager.yaml` — example block:

```yaml
route:
  receiver: "ops-default"
  group_by: ["alertname", "tenant_id"]
  routes:
    - matchers: [severity="page"]
      receiver: "pagerduty-primary"
      continue: false
    - matchers: [severity="triage"]
      receiver: "slack-ai-safety"
      continue: false
```

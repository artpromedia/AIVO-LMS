# Runbook — Incident Response (SRE)

How to detect, declare, communicate, mitigate, and close a production
incident. Architecture is in ADR 0037 (observability & status) and ADR 0036
(responsible AI). For audit-integrity breaches see
`docs/runbooks/audit-incident-response.md`.

Owning services: `services/status-page-svc` (public/district status,
incident lifecycle), `services/alerts-proxy-svc` (SLOs, burn-rate,
Alertmanager intake, auto-incident), `packages/otel-bootstrap` (traces +
tenant-scoped logs/metrics). Admin UI: `/admin/platform/status/*`.

## Severity matrix

| Sev      | Definition                                                             | Examples                                                                                       | Response (ack / mitigation start) | Who pages                                                               | Comms cadence                                         |
| -------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| **Sev1** | Full or broad outage; data loss/exposure risk; safety risk to learners | Login down platform-wide; audit chain break; PII exposure; AI emitting unsafe content at scale | **5 min** / immediate             | Platform on-call **+** eng lead **+** (security/RAI lead if applicable) | Public update every **30 min**; internal channel live |
| **Sev2** | Major feature degraded for many tenants; SLO fast-burn (multi-window)  | Lessons failing for a district; p95 latency 5x; payment processing erroring                    | **15 min** / within 30 min        | Platform on-call                                                        | Public update every **60 min**                        |
| **Sev3** | Minor/partial degradation, limited blast radius, workaround exists     | One non-critical component degraded; elevated but in-budget errors                             | **1 business hour**               | Owning team (no page)                                                   | Status page note if customer-visible                  |
| **Sev4** | Cosmetic / no user impact; tracked toil                                | Dashboard glitch; noisy non-paging alert                                                       | Next business day                 | None                                                                    | None (ticket only)                                    |

When unsure, **round up** a severity. You can always downgrade after triage.

## 1. Detection

Signals, in order of authority:

1. **Alertmanager → `alerts-proxy-svc`**. Alerts hit the webhook intake,
   which **dedupes** by a fingerprint over alert labels (window-based) so a
   flapping alert collapses to one logical event
   (`src/slo/dedupe.ts`). A **critical** alert **auto-creates an incident**
   by POSTing to `status-page-svc`, so it appears on `/status` within ~60s
   with `autoCreated: true` — no human needed.
2. **SLO burn-rate**. `alerts-proxy-svc` evaluates the **multi-window
   multi-burn-rate** rule (`shouldPageOnBurn`): page only when the **1h
   (fast)** and **6h (slow)** windows both exceed the threshold. See the
   `slo-error-budget` Grafana board.
3. **Human report** (support, a district, an engineer). File or escalate an
   incident manually.

Triaging an auto-created incident: open it under
`/admin/platform/status/incidents/[id]`, confirm impact and affected
components/tenants, set severity, and either take ownership or resolve if
it is a false positive (note why in an update).

## 2. Triage

- **Scope it.** Which components? Use the dependency rollup on the status
  page — a single upstream degradation surfaces on dependents.
- **Which tenants?** Filter traces/logs by `tenant_id` (carried in W3C
  baggage and stamped on every structured log line and span — ADR 0037).
  Pivot on `trace_id` to follow a request across services.
- **Is the error budget burning?** Check `slo-error-budget`. A fast+slow
  multi-window burn promotes the incident to at least Sev2.
- **Set severity** from the matrix and assign an incident commander (IC).

## 3. Declaring an incident

- **Auto-created** (critical alert): already exists; just take ownership.
- **Manual** (platform admin only): `/admin/platform/status/incidents/new`.
  Provide title, impact (`none|minor|major|critical`), affected components,
  and affected tenants (empty = all). It opens in the **`investigating`**
  lifecycle state.

RBAC (ADR 0037): declaring/editing incidents, posting updates, and
scheduling maintenance are **platform-admin only**. District/school admins
and the public can **view and subscribe** only.

## 4. Incident lifecycle

Lifecycle: **`investigating → identified → monitoring → resolved`**. Each
transition is recorded as an entry in the incident **updates feed**, and
each update is the unit of public communication. Post a public update on
**every** transition.

| State             | Meaning                                                          | Post publicly?                                                    |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| **investigating** | Impact confirmed, root cause not yet known.                      | Yes — acknowledge impact + that you are looking.                  |
| **identified**    | Root cause (or strong hypothesis) found; mitigation in progress. | Yes — what is affected + that a fix is underway.                  |
| **monitoring**    | Mitigation applied; watching to confirm recovery.                | Yes — what changed + that you are verifying.                      |
| **resolved**      | Recovery confirmed and sustained; sets `resolvedAt`.             | Yes — all-clear + brief summary; link `postmortemUrl` when ready. |

Do not jump straight to `resolved` from `investigating`; pass through
`monitoring` so subscribers see the recovery being verified.

## 5. Communication

- **Status page updates** drive everything. Posting an update with a new
  lifecycle transitions the incident and notifies subscribers.
- **Subscribers** receive notifications over **email / webhook / RSS**
  (`status-page-svc` subscribers). Webhook subscribers are typically
  district integrations.
- **Cadence** per the severity matrix (Sev1 = 30 min even if "no change —
  still investigating"; silence reads as a worse outage than it is).
- **Tenant scoping**: the public summary is tenant-scopable, so a district
  status view shows only incidents affecting that tenant.
- **Scheduled maintenance**: announce via a maintenance window
  (`/admin/platform/status/maintenance`) with `notifyLeadMinutes` lead
  time; this sets components `under_maintenance` rather than alarming the
  public page as an outage.

## 6. Mitigation & rollback checklist

- [ ] Identify the change/deploy correlated with onset (compare incident
      `createdAt` to deploy timeline).
- [ ] Prefer the **fastest safe mitigation**: feature-flag off, scale out,
      shed load, or **roll back** the suspect deploy.
- [ ] For a bad deploy: roll back to the last known-good image/tag; confirm
      health returns on the `service-health` (RED) board before declaring
      `monitoring`.
- [ ] If a single tenant is impacted, scope the mitigation to that tenant
      where possible (per-tenant flags) to limit blast radius.
- [ ] Verify recovery on **both** the status page (component status back to
      `operational`) **and** the SLO board (burn rate back below threshold)
      before moving to `monitoring`, and watch ≥ one fast-window (1h)
      before `resolved`.
- [ ] If the mitigation itself is risky, announce it as part of the public
      update.

## 7. Resolution & post-mortem

- Transition to **`resolved`** only after recovery holds through at least
  the fast (1h) window.
- Attach the **`postmortemUrl`** to the incident once written.
- All Sev1 and Sev2 incidents require a **blameless** post-mortem within 5
  business days.

### Blameless post-mortem template (stub)

```markdown
# Post-mortem — <incident title> (<Sev>, <date>)

- Incident ID / status-page link:
- Duration (detected → resolved):
- Affected components / tenants:
- Customer impact (what users saw):

## Timeline (UTC)

- HH:MM detection (alert / report) ...
- HH:MM declared, IC = ...
- HH:MM identified: <root cause>
- HH:MM mitigation applied: <what>
- HH:MM monitoring
- HH:MM resolved

## Root cause

<contributing factors — systems, not people>

## What went well / what didn't

## Error-budget impact

<budget consumed; does §8 freeze apply?>

## Action items (owner, due, tracking link)

- [ ] ...
```

## 8. Error-budget policy

Error budget = `totalEvents * (1 - target)` over the SLO window
(`slo-math.ts`). Policy:

- **Budget healthy (remaining > 0, no sustained burn):** ship normally.
- **Sustained multi-window burn (1h AND 6h ≥ threshold):** page; treat as
  at least Sev2.
- **Budget exhausted (`remaining <= 0`) for an SLO:** declare a **feature
  freeze** for the owning service — only reliability fixes and rollbacks
  ship until the rolling-window budget recovers above zero. The IC/eng lead
  owns lifting the freeze.

## 9. Responsible AI incidents

For AI-specific harm (unsafe output, bias, privacy, a failed/regressed
eval), use the **Responsible AI** incident flow alongside this runbook.

- **File** at `/admin/platform/ai/incidents` (all admin roles may file;
  see ADR 0036 RBAC). RAI incidents carry their own severity/state and link
  the affected `modelId`/`tenantId`.
- **Mitigate** by removing the model from the inference path, fastest-first:
  - **Opt-out / disable** the model or feature for the affected tenant
    (`/admin/platform/ai` opt-outs, or district-level which **cascades** to
    child tenants). Opted-out callers get the **graceful non-AI fallback**.
  - **Retire/deprecate** the model version in the registry — the RAI
    gateway treats `MODEL_RETIRED` as a deny, so all callers stop using it
    after the 60s cache TTL.
  - For high-risk models, confirm **fail-closed** is set so a
    `responsible-ai-svc` outage denies rather than allows.
- **Evidence / audit trail**: every gateway denial emits an
  **`ai.call.blocked`** audit event, and every registry/policy/opt-out/eval
  mutation is audited (ADR 0036 §7). Pull the `ai.call.blocked` events plus
  the `responsible-ai` Grafana board (blocked-call rate, eval pass rates) to
  bound impact and confirm the mitigation took effect.
- If the incident is customer-visible, also open a **status-page** incident
  so districts are notified through the normal channel.

## Notes

- Auto-created incidents are best-effort; if `alerts-proxy-svc` cannot reach
  `status-page-svc`, the alert still fires internally — declare manually.
- A gap in metrics is not by itself an outage — corroborate across the RED
  board, SLO board, and synthetic checks before declaring.

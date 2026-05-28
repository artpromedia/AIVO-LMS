# 0009 — Service-stack parity rollout

- **Status:** Accepted
- **Date:** 2026-05-27
- **Deciders:** web-v2 platform team, services team
- **Related:** AIVO-LMS audit gap #12, ADR 0007, ADR 0008

## Context

Several core domains have a mature implementation in `services/*`
that web-v2 silently re-implements:

- `services/brain-svc` — brain profile, clone, consent, approval.
  Web-v2 has a parallel implementation in
  `apps/web-v2/lib/db/repos.ts:533-627` driven by the in-memory store.
- `services/ai-svc` — multi-model gateway (Anthropic/OpenAI/Google),
  prompt builder, moderation. Web-v2 has a deterministic fallback in
  `apps/web-v2/lib/ai/tutor.ts:116-133`.
- `services/assessment-svc` — baseline generation, item bank,
  discovery adventure. Web-v2 has its own LLM call + bank fallback
  in `apps/web-v2/lib/db/repos.ts` baseline path.
- `services/tutor-svc`, `services/homework-svc`, `services/comms-svc`,
  `services/identity-svc`, etc.

The duplicate implementations exist because web-v2 was built to be
demoable without the service stack, but they have diverged. The
audit's recommendation is that web-v2 call the service where one
exists.

## Decision

We will introduce a **service client layer** in
`apps/web-v2/lib/services/` that exposes one typed client per
upstream service. Web-v2 repos / BFF handlers are migrated to call
the client; the client decides whether to hit the real service or
fall back to the in-memory implementation, based on per-service
feature flags.

```
apps/web-v2/lib/services/
  client.ts            # shared HTTP fetch helper (retries, auth, timeouts)
  brain-svc.ts         # typed methods that mirror services/brain-svc routes
  ai-svc.ts
  assessment-svc.ts
  comms-svc.ts
  identity-svc.ts
  ...
  index.ts             # ServiceRegistry — selects clients by flag
```

### Flags

- `AIVO_USE_SERVICE_STACK=true|false` — global kill switch
  (default `false` in dev, `true` in production once a service is
  ported).
- `AIVO_USE_<SERVICE>=true|false` — per-service override (e.g.
  `AIVO_USE_BRAIN_SVC=true`). Wins over the global flag.

Each client method has shape:

```ts
brainSvc.cloneBrain({ learnerId, tenantId, summary }):
  Promise<BrainCloneResult>
```

Internally the method:

1. If the relevant flag is `true` and `BRAIN_SVC_URL` resolves, call
   the service via `client.ts` (timeouts, retries with exponential
   backoff, request-id propagation, audit log on failure).
2. Otherwise call the local in-memory implementation that lives in
   `lib/db/repos.ts` (or the new persistence adapter — ADR 0007).

The two paths return the same shape so callers don't branch.

### Rollout order

Same domain ordering as ADR 0007. For each domain we:

1. Add the service client + types under `lib/services/<svc>.ts`.
2. Wire the relevant `lib/db/repos.ts` functions to delegate through
   the client when the flag is on.
3. Add an integration test in `apps/web-v2/tests/integration/` that
   stubs the service and asserts both paths return parity-equivalent
   results.
4. Turn the per-service flag on in staging for one full sprint.
5. Turn it on in production. Keep the in-memory path callable for
   another sprint as the rollback option.
6. Remove the in-memory path once it has been off in production for
   two sprints.

### Failure semantics

When a service call fails (5xx, timeout, network), the client may
either:

- **Strict mode** (default for write paths) — propagate the error.
  The caller is responsible for surfacing a real failure to the UI.
- **Lenient mode** (opt-in for read paths) — fall back to the local
  implementation, log the degradation as a structured event
  `service_call.degraded`, and emit a metric.

We default writes to strict and reads to lenient on a per-method
basis; the policy is encoded in the client.

## Consequences

- **Positive:**
  - Single source of truth in production. brain-svc owns the brain
    clone; web-v2 stops drifting.
  - Real LLM / safety / cost controls actually run instead of the
    deterministic fallback.
  - Per-service flag means a service outage doesn't have to be a
    web-v2 outage (lenient reads keep dashboards loading).
- **Negative:**
  - Latency cost: a brain-clone now crosses a network boundary.
    Mitigation: keep the in-memory path callable as the fallback,
    and cache where the service permits.
  - Two implementations live side-by-side during rollout.
  - We need real per-environment service URLs and auth secrets; this
    adds config surface area.
- **Neutral / follow-ups:**
  - mTLS or signed inter-service auth is a separate ADR. For the
    first cut we use a shared bearer token in `AIVO_SERVICE_TOKEN`.
  - Observability is via the existing `lib/observability/logger.ts`
    with a `service` field tagging the upstream.

## Alternatives Considered

- **Rip out the in-memory implementations immediately.** Rejected
  — couples the migration to a service-stack uptime SLA we don't
  have yet, and removes a useful demo / dev affordance.
- **Run services as a sidecar in dev so there's only one code path.**
  Rejected for v1 — 29 services + Postgres + Redis is too much for a
  contributor's laptop. May revisit once the docker compose story
  matures.
- **Express the choice as build-time configuration.** Rejected —
  flags need to be flipping at runtime to support gradual rollout.

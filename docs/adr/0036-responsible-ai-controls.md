# 0036 — Responsible AI Controls: registry, policy stack, eval harness, and enforcement gateway

- **Status:** Accepted
- **Date:** 2026-06-03
- **Related:** Sprint 7 — Responsible AI Console; `services/responsible-ai-svc`,
  `apps/web-v2/app/admin/platform/ai`, the public `/ai-transparency` page;
  ADR 0032 (audit architecture), ADR 0037 (observability & status).

## Context

AIVO operates AI-driven instruction, assessment, and content generation
inside K-12 and higher-ed, which places these systems squarely in the
**high-risk** category of the **EU AI Act** (education and vocational
training, Annex III) and obliges us to demonstrate governance under the
**NIST AI Risk Management Framework** (the four functions: **Govern**,
**Map**, **Measure**, **Manage**). Districts increasingly require, as a
procurement gate, evidence that we can:

- enumerate every model and version in production with a documented
  **model card** (provenance, intended use, known limitations, evaluation
  evidence) — the NIST **Map**/**Measure** surface;
- apply **safety policies** consistently across a multi-tenant hierarchy,
  with districts and schools able to tighten (never loosen) the platform
  baseline;
- let a district or school **opt out** of AI features for its own learners,
  with the opt-out cascading to child tenants;
- run a **reproducible evaluation harness** that produces comparable
  safety/quality numbers across model versions before promotion;
- **track Responsible-AI incidents** to closure; and
- **enforce** all of the above at inference time, not just on a dashboard.

Before this sprint each AI-calling service made ad-hoc, divergent safety
checks (or none). This ADR records the decision to centralize Responsible
AI governance in a single service (`responsible-ai-svc`) with an
enforcement gateway that other services consult before every inference.

## Decision

### 1. Model registry & NIST GOVERN model cards

`responsible-ai-svc` owns a registry of **models → versions → model
cards**. A model card carries the NIST AI RMF **GOVERN** fields so a
reviewer can answer "who is accountable, what is this for, what are its
limits, and what evidence backs it":

| GOVERN field | Meaning |
|---|---|
| `intendedUse` | The instructional/assessment task the version is approved for. |
| `outOfScopeUses` | Explicitly prohibited uses (e.g. high-stakes grading without human review). |
| `accountableOwner` | Named platform owner accountable for the model's risk posture. |
| `provenance` | Base model, provider, training/fine-tune lineage, license. |
| `dataGovernance` | Data sources, PII handling, retention, and consent basis. |
| `knownLimitations` | Documented failure modes (bias, hallucination, age-appropriateness). |
| `riskTier` | `low` \| `medium` \| `high`; `high` drives fail-closed enforcement. |
| `humanOversight` | Required human-in-the-loop controls for this version. |
| `evalEvidence` | Link to the latest eval-harness run that gated promotion. |
| `reviewCadence` | How often the card must be re-attested (e.g. quarterly). |

Model cards are versioned with the model version; promoting a version
requires a current card and a passing eval run.

### 2. Policy resolution — `tenant > district > platform`, additive blocklists

A **safety policy** is resolved per request by layering the platform
baseline, the district policy, and the tenant policy. **The most specific
layer wins** for scalar settings, but the resolution is *strictness-only*:

- **Allow/feature toggles:** tenant > district > platform (most specific
  wins), but a school is constrained to a **subset of its district's
  allow-list** — a school can disable what the district allows, never
  enable what the district forbids.
- **Blocklists are additive (union):** the effective blocklist is the union
  across all layers; no layer can remove a term a higher layer added.
- **Age gates and severity thresholds: strictest wins.** The effective
  minimum age is the **max** across layers; the effective severity
  threshold is the **most restrictive** across layers. A lower layer can
  only raise the floor.

This guarantees a monotonic safety property: descending the hierarchy can
only make the effective policy *tighter*, which is the behavior auditors
and districts expect.

### 3. Opt-out precedence & district cascade

Per-tenant **opt-outs** disable AI features for a tenant's learners. A
**district opt-out cascades to all child tenants** (schools/classrooms);
a child cannot re-enable a feature its district has opted out of. A school
may opt out independently of its district. Opt-out is evaluated *before*
policy resolution — an opted-out tenant short-circuits to a graceful
non-AI fallback regardless of the resolved policy.

### 4. Deterministic, seeded eval harness

The eval harness runs a fixed, **seeded** prompt suite against a model
version and reports five metrics so results are comparable across versions
and reproducible across runs:

| Metric | What it measures |
|---|---|
| `safety` | Rate of safe responses on the adversarial/safety suite. |
| `accuracy` | Correctness against the labeled answer key. |
| `bias` | Disparity across demographic-counterfactual prompt pairs. |
| `refusalRate` | Rate of appropriate refusals on out-of-scope/unsafe prompts. |
| `hallucination` | Rate of unsupported/fabricated claims on grounded prompts. |

Determinism (fixed seed + fixed suite + pinned decoding params) means a
re-run reproduces the numbers, which is what makes an eval admissible as
**Measure** evidence and lets promotion gate on thresholds.

### 5. The RAI gateway (enforcement)

Every AI-calling service imports `createRaiGateway()` and calls
`gateway.check({ tenantId, modelId, feature })` **before** inference
(`services/responsible-ai-svc/src/lib/rai-gateway.ts`):

- It calls `GET /api/responsible-ai/policies/effective` (opt-out +
  resolved policy) and **caches the decision for 60s** per
  `(tenant, model, feature)` to keep the lookup off the hot path.
- On **deny** it short-circuits inference and emits an **`ai.call.blocked`**
  audit event (via the `onBlocked` hook wired to `@aivo/audit-client`).
- It **fails open by default** (availability-first for education
  deployments) but logs loudly; high-risk models set `failClosed: true`,
  in which case an unreachable `responsible-ai-svc` denies the call
  (`reason: "RAI_UNAVAILABLE"`).

### 6. RBAC

| Capability | platform_admin | district_admin | school_admin | other admins |
|---|:--:|:--:|:--:|:--:|
| Manage model registry / versions / cards | ✅ | ❌ | ❌ | ❌ |
| Author / promote safety policies | ✅ | ❌ | ❌ | ❌ |
| Run eval harness / promote versions | ✅ | ❌ | ❌ | ❌ |
| File RAI incidents | ✅ | ✅ | ✅ | ✅ |
| Configure opt-outs (own tenant) | ✅ | ✅ (district + cascade) | ✅ (subset of district) | ❌ |
| View transparency / usage (own scope) | ✅ | ✅ | ✅ | ✅ |

A school admin's opt-out scope is a **subset** of its district's
allow-list (consistent with §2). District/school admins act only within
their own tenant subtree.

### 7. Audit coverage

**Every mutation** in `responsible-ai-svc` is audited via
`@aivo/audit-client` — registry/version/card changes, policy
create/update, opt-out toggles, eval runs, incident lifecycle, and the
gateway's `ai.call.blocked` denials — so the full Responsible-AI control
plane is reconstructible from the tamper-evident audit log (ADR 0032).

## Alternatives considered

- **Per-service ad-hoc policy checks (status quo).** Rejected: divergent
  rules, no central registry or audit, no way to prove consistent
  enforcement to a district, and every service re-implements caching and
  fail-mode handling.
- **Third-party model-governance SaaS.** Rejected for now: tenant data
  egress and FERPA concerns, weaker integration with our tenant hierarchy
  and audit chain, and per-seat cost; the wire formats here keep a future
  integration possible without re-architecting.

## Consequences

**Positive**

- A single source of truth for models, cards, policies, opt-outs, evals,
  and incidents, with **full auditability** of every mutation.
- The gateway's 60s cache keeps policy resolution off the hot path —
  target **< 5 ms p95** for the cached decision.
- Central, monotonic policy semantics make district/school self-service
  safe (they can only tighten), and the public `/ai-transparency` page can
  be generated directly from the registry.

**Negative / risks**

- The stores are **in-memory today** while the Postgres schema lives in
  migrations (`0001_responsible_ai_registry.sql`); durable persistence and
  the p95 numbers against Postgres are tracked follow-ups.
- **Fail-open by default** trades a small enforcement gap during a
  `responsible-ai-svc` outage for availability. High-risk models opt into
  fail-closed; the tradeoff is explicit and per-model.

## References

- Migration: `services/responsible-ai-svc/src/db/migrations/0001_responsible_ai_registry.sql`
- Gateway: `services/responsible-ai-svc/src/lib/rai-gateway.ts`
- Public transparency page: `/ai-transparency` (`apps/web-v2`)
- NIST AI Risk Management Framework (AI RMF 1.0) — Govern / Map / Measure / Manage
- EU AI Act — Annex III high-risk systems (education and vocational training)

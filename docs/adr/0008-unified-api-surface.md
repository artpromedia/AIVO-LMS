# 0008 — Unified API surface: BFF is the canonical app API

- **Status:** Accepted
- **Date:** 2026-05-27
- **Deciders:** web-v2 platform team, services team
- **Related:** AIVO-LMS audit gap #11 ("no single unified app API module")

## Context

The audit observed that there is no `apps/api` module — the app
talks to two API surfaces:

1. **BFF** at `apps/web-v2/app/api/bff/**` (Next.js route handlers).
   Backs every web UI surface: parent, learner, teacher, caregiver,
   therapist, admin.
2. **Services** under `services/*` (29 microservices, Python +
   TypeScript). Own the canonical models in production (assessments,
   brain clones, AI, tutoring, billing, identity, etc.).

There is no contract layer in between. The BFF reimplements
significant chunks of service behaviour locally against the in-memory
store (see ADR 0007). External integrators have no documented entry
point.

Concrete problems:

- Drift: a field added to `services/brain-svc` is not automatically
  reflected in the BFF route or the UI's TypeScript types.
- Discovery: external developers / mobile apps / partner integrations
  don't know which URL to hit.
- Testing: there's no single OpenAPI spec to generate clients from.

## Decision

We will **canonicalise the BFF as the application API**, and treat
the services as **internal upstreams** of the BFF.

Specifically:

- All app-facing API traffic (web, mobile, partner integrations) goes
  through `apps/web-v2/app/api/bff/**`. There is no `apps/api`; the
  BFF *is* the API.
- BFF route handlers may call into:
  - the in-memory store / Drizzle adapter (ADR 0007), or
  - services in `services/*` via an HTTP client (ADR 0009).
  Which one is selected by the per-domain persistence + service
  flags.
- **Every BFF route gets an OpenAPI fragment** under
  `apps/web-v2/app/api/bff/<route>/openapi.ts` exporting a typed
  schema for request/response. A new
  `pnpm api:bff:dump` script consolidates the fragments into
  `packages/api-client/openapi/bff.yaml`.
- **`@aivo/api-client`** gains a `BffClient` generated from that
  spec. The mobile app, partner SDKs, and any internal tooling
  consume the BFF through that client — never by reaching into the
  services directly.
- Services keep their own OpenAPI specs (where they have them).
  Those are **not** part of the app contract; they're internal.
  External SDKs are forbidden from importing them.

### Rollout

1. Document the contract: add `apps/web-v2/app/api/bff/README.md`
   explaining the rule and pointing at this ADR.
2. Add a lint rule (`scripts/check-api-boundary.mjs`) that fails CI
   if any non-BFF code in `apps/*` or `packages/api-client/*` imports
   a service path directly.
3. Add `openapi.ts` fragments to the 10 highest-traffic BFF routes
   first; backfill the rest opportunistically as routes are touched
   for other reasons.
4. Wire the consolidator + client generator into `pnpm api:generate`
   alongside the existing service-OpenAPI flow.

## Consequences

- **Positive:**
  - One documented URL surface for every external caller.
  - Types stay in sync via a single generated client.
  - The web UI's BFF is already what mobile / partners want; we
    promote it instead of inventing a third API.
- **Negative:**
  - BFF can become a bottleneck if traffic outgrows Next.js workers.
    Mitigation: BFF routes are stateless and trivially horizontally
    scalable; route handlers that proxy to services add minimal CPU.
  - We accept some duplication: a service may expose
    `/api/brain/clone` and the BFF wraps it as
    `/api/bff/learners/{id}/brain/clone`. That's the price of having
    a single front door.
- **Neutral / follow-ups:**
  - WebSocket / SSE routes (e.g. notifications stream) follow the
    same rule but may live under `apps/web-v2/app/api/bff/*/stream`.
  - GraphQL is not on the table; if it ever is, this ADR is
    superseded.

## Alternatives Considered

- **Create `apps/api` as a separate Next/Express service.**
  Rejected — duplicates the BFF, splits routing config, makes
  cross-cutting middleware (auth, audit, tenant guards) harder to
  keep consistent.
- **Expose services directly to the client.** Rejected — couples
  the UI to backend topology, breaks tenant guards that live in the
  BFF, and forces external clients to learn 29 different APIs.
- **Add an API gateway (e.g. Kong) in front of services.**
  Rejected — useful eventually for ops (rate limiting, telemetry),
  but does not solve the contract problem, and we'd still need a
  per-app translation layer for tenant scope.

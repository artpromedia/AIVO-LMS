# BFF — Backend For Frontend

This directory holds **every server endpoint web-v2 exposes**. Per
[ADR 0008](../../../../docs/adr/0008-unified-api-surface.md), the BFF
is the **canonical application API** for AIVO-LMS:

- The web UI in `apps/web-v2/app/(parent|learner|teacher|...)/**`
  calls into these routes.
- The mobile app (`apps/mobile`) and any partner integrations consume
  the BFF via the generated client in `packages/api-client`.
- Microservices in `services/*` are **internal upstreams** of the
  BFF, not external API surfaces. UIs and external integrators must
  not reach into them directly.

## How a route is structured

Every route file follows the same shape:

```ts
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession } from "@/lib/bff/guards";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    // ... business logic, calling repos / services ...
    return ok(payload, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
```

Conventions:

- **Always go through `requireSession` or `requireRole`** for
  authenticated endpoints.
- **Always propagate `requestId`** via `getRequestId(req)` and pass it
  to upstream calls. It powers trace correlation across services.
- **Use the result envelopes** (`ok` / `fail` / `failFromUnknown`).
  Routes return `{ ok: true, data, requestId }` or
  `{ ok: false, error: { code, message }, requestId }`.

## Calling upstream services

Use the typed clients in `apps/web-v2/lib/services/*` (see
[ADR 0009](../../../../docs/adr/0009-service-stack-parity-rollout.md)).
Do **not** call `fetch` against a service URL directly from a route
handler — the client layer carries timeouts, retries, token auth,
request-id propagation, and the local-fallback policy.

## Persistence

Reads + writes go through the repos in `apps/web-v2/lib/db/repos.ts`
or, for domains that have been migrated, the persistence adapter at
`apps/web-v2/lib/db/persistence/` (see
[ADR 0007](../../../../docs/adr/0007-web-v2-persistence-migration.md)).

## Adding a new endpoint

1. Pick the right URL — group by domain, not by role. `/api/bff/learners/:id/...`
   is correct; `/api/bff/parent/learners/...` is not (the BFF is
   role-agnostic; the page that calls it knows the role).
2. Add the route file under `apps/web-v2/app/api/bff/<path>/route.ts`.
3. Add an OpenAPI fragment at the same level
   (`apps/web-v2/app/api/bff/<path>/openapi.ts`). Reuses Zod schemas
   where possible.
4. Run `pnpm api:bff:dump` (planned — see ADR 0008 rollout step 4) to
   refresh the consolidated spec in `packages/api-client/openapi/bff.yaml`.
5. The generated client in `packages/api-client/src/bff.ts` picks up
   the new endpoint on the next `pnpm api:generate`.

## Tests

- Unit tests for response shape live next to the route, e.g.
  `route.test.ts`.
- End-to-end / integration tests across multiple routes live under
  `apps/web-v2/tests/integration/bff/`.

## Forbidden patterns

- ❌ Importing from `services/*` directly.
- ❌ Calling `fetch` directly against an upstream service URL.
- ❌ Returning raw `NextResponse.json` without going through `ok` /
  `fail` (skips request-id propagation + the standard envelope).
- ❌ Exposing internal IDs that aren't tenant-scoped. The BFF must
  enforce tenant boundaries; the upstream service may or may not.

The lint script `scripts/check-api-boundary.mjs` (planned — see ADR
0008) will fail CI on the first two.

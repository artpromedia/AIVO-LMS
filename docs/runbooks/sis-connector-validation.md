# Runbook — SIS connector vendor-sandbox validation (Schoology / PowerSchool)

The Schoology and PowerSchool roster connectors (`services/integrations-svc`)
are implemented and covered by:

- **Unit tests** — `tests/sis-connectors.test.ts` (mapping logic, auth-failure
  and missing-config paths, injected fetch).
- **Wire-level e2e** — `tests/sis-connectors.e2e.test.ts` (real HTTP against a
  stub vendor server: validates URL construction, auth headers, pagination
  params, and JSON parsing over the wire).

The one thing automated CI **cannot** cover is the real vendor API: actual
OAuth tokens, real response shapes, and pagination behaviour against a live
tenant. This runbook is the final sign-off before a district relies on either
connector in production.

## Prerequisites

- A Schoology developer/sandbox account with an OAuth2 access token, **or** a
  PowerSchool sandbox server with an OAuth2 client-credentials token.
- Network egress from wherever you run the test to the vendor API host.

## Run the gated live test

The live test (`tests/sis-connectors.live.test.ts`) **skips unless** the
relevant credentials are present, so it is safe to leave in the suite.

Schoology:

```bash
export SCHOOLOGY_LIVE_API_BASE="https://api.schoology.com/v1"
export SCHOOLOGY_LIVE_TOKEN="<oauth2-access-token>"
pnpm --filter @aivo/integrations-svc exec vitest run tests/sis-connectors.live.test.ts
```

PowerSchool:

```bash
export POWERSCHOOL_LIVE_URL="https://<your-server>.powerschool.com"
export POWERSCHOOL_LIVE_TOKEN="<oauth2-access-token>"
pnpm --filter @aivo/integrations-svc exec vitest run tests/sis-connectors.live.test.ts
```

A pass means the sync authenticated and pulled a **non-empty** roster.

## What to verify manually (beyond the automated assertion)

1. **Counts** — student / teacher / section counts match the sandbox tenant.
2. **Field mapping** — spot-check a few `integration_roster_mappings.externalData`
   rows: names, emails, grade levels, school ids look correct.
3. **Pagination** — if the sandbox has > 200 records, confirm later pages are
   fetched (the handlers currently request a single page of 200; extend the
   handler's paging loop if the tenant exceeds that and re-validate).
4. **Token expiry / refresh** — confirm the stored credential refresh path
   keeps the sync working past the access-token TTL.

## Sign-off

Record the validation (date, tenant, counts) and, once both connectors pass
against a real sandbox, they can stay `available` with confidence. Until then
they are implemented and unit/e2e-tested, but the live counts above are the
production gate.

# Runbook - District Onboarding

**Audience:** Platform operations, support, and identity on-call
**Last reviewed:** 2026-06-06

Use the standalone admin console at `https://admin.aivolearning.com`. District onboarding creates a
`B2B_DISTRICT` tenant and a hashed, single-use first-admin invitation. It never creates or returns a
temporary password.

## Onboard a district

1. Sign in as `PLATFORM_ADMIN` and open `/platform/districts/new`.
2. Enter the district name and the first district administrator's name and work email.
3. Submit the form. Identity service writes `district.created` and `district_admin.invited` audit
   rows before requesting email delivery from comms service.
4. Confirm the success screen says the invitation was emailed. In local development only, comms
   service may return a direct invitation URL.
5. The invitee opens the link, chooses a password, and becomes the district's first
   `DISTRICT_ADMIN`. The link expires after 72 hours and cannot be reused.

## Manage invitations

Open `/platform/districts` to view pending, accepted, expired, and revoked first-admin invitations.

- **Resend** rotates the token, invalidates the old link, extends expiry by 72 hours, sends a new
  email, and writes `district_admin.invite_resent`.
- **Revoke** invalidates a pending link and writes `district_admin.invite_revoked`.
- Accepted invitations cannot be resent or revoked.

With `ADMIN_ENTERPRISE_STEP_UP_AUTH=true`, create uses the `district:create` step-up scope and
resend/revoke use `district:admin-mgmt`. The scopes are single-use and expire after five minutes.

## District first-run

After accepting the invitation, the district admin opens `/district`. The page shows live school,
staff, and learner totals plus a first-run checklist. Setup can be marked complete after at least one
school exists. Completion persists `tenant.settings.setupComplete=true` and writes
`district.setup_completed` to both district activity and admin audit logs.

## Troubleshooting

### District created, but invitation email failed

The API intentionally returns `502` after persisting and auditing the tenant and invitation. Do not
create the district again. Open `/platform/districts`, find the pending invitation, and resend it.

Check:

1. `COMMS_SVC_URL` resolves from identity service.
2. `INTERNAL_SERVICE_KEY` matches comms service.
3. Comms service can reach its configured transactional email provider.
4. Identity logs contain `district invite delivery failed` with the invitation id.

### Invitee reports an invalid link

Confirm the invitation status in `/platform/districts`. Resend expired links. A revoked or previously
rotated link is intentionally invalid. Accepted links return a conflict and the user should sign in.

### Setup cannot be completed

The district must contain at least one school. Verify the school row has the same district tenant id,
then retry completion. Inspect `GET /api/district/setup` for the current counts and checklist state.

## Evidence and monitoring

- Audit actions: `district.created`, `district_admin.invited`,
  `district_admin.invite_resent`, `district_admin.invite_revoked`, `district.setup_completed`.
- Prometheus counters: `identity_district_invites_created_total`,
  `identity_district_invites_accepted_total`, `identity_district_invites_revoked_total`.
- Structured logger: `identity-svc.district-onboarding`.

## District-pilot e2e harness (no mock on the pilot path)

The district-pilot journey — platform admin provisions a pilot → district admin
adds a school → parents are invited into the district tenant → each parent logs
in for real, creates a learner under the seat cap, and completes consent — is
proven end-to-end against a Dockerized stack, never the mock session.

**Harness:** the `pilot` profile of `docker-compose.e2e.yml` brings up
`postgres` + `identity-svc` (`IDENTITY_TEST_MODE=1`) + `web-v2`
(`AUTH_MODE=custom`, `AIVO_PERSISTENCE=postgres`), with `billing-svc` and
`web-admin` defined for the later sprints. Because `AUTH_MODE=custom` is a
production-grade provider value, `readMockSessionFromCookies()` only honors the
real `aivo_session` snapshot — the `aivo_mock_session` cookie and the
`/api/bff/auth/mock-login` endpoint are hard-disabled.

**Run locally:**

```bash
docker compose -f docker-compose.e2e.yml --profile pilot up -d --build --wait \
  postgres identity-svc web-v2
pnpm --filter @aivo/db run db:migrate
AIVO_SEED_DATABASE_URL=postgresql://aivo:aivo@localhost:55433/aivo_e2e \
  pnpm --filter @aivo/web-v2 db:seed:postgres
pnpm e2e -- specs/district-pilot
docker compose -f docker-compose.e2e.yml --profile pilot down -v
```

**CI:** `.github/workflows/district-pilot-e2e.yml` runs the same against service
containers, path-gated to the surfaces the journey touches. The journey spec
lives at `e2e/specs/district-pilot/district-pilot.spec.ts`; each sprint
un-`fixme`s its stage of the journey.

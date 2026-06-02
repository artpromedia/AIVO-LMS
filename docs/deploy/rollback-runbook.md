# Rollback runbook

Sprint 12.7. Procedure for rolling a bad production deploy back to the prior known-good image tag.

## When to roll back

| Signal                                                                   | Action                         |
| ------------------------------------------------------------------------ | ------------------------------ |
| `/health` returns 503 across >25% of replicas of any service             | Page on-call, then roll back   |
| Error rate >5% sustained for 5 minutes on identity, billing, or learning | Page on-call, then roll back   |
| Stripe webhook signature failures spike after a comms-svc deploy         | Roll back comms-svc only       |
| LTI launch failures across all platforms after an integration-svc deploy | Roll back integration-svc only |
| Migration applied unsafe schema change (failed `migration-lint`)         | See "Schema rollback" below    |

## Standard image rollback

```bash
# 1. Identify the prior tag (image tags are commit SHAs from Sprint 12.7 onward).
kubectl -n aivo get deploy identity-svc -o jsonpath='{.metadata.annotations.kubernetes\.io/change-cause}'

# 2. Roll back the single service.
kubectl -n aivo rollout undo deployment/identity-svc
kubectl -n aivo rollout status deployment/identity-svc --timeout=300s

# 3. OR re-run the production-deploy workflow with the prior SHA pinned.
gh workflow run deploy-production.yml -f version=<prior-sha>
```

The deploy workflow refuses `:latest` so you must pass a concrete tag.

## Multi-service rollback

If the bad deploy touched several services (e.g. shared `@aivo/db` schema change):

```bash
for svc in identity-svc integration-svc comms-svc learning-svc; do
  kubectl -n aivo rollout undo deployment/$svc
done
kubectl -n aivo get pods -l app.kubernetes.io/part-of=aivo-enterprise
```

## Schema rollback

Migrations are forward-only. A failed `pre-migrate-job` blocks the deploy before image rollout starts — so the rollback is just "do nothing, redeploy the prior image".

If a migration applied successfully but produced bad data:

1. Take a logical backup snapshot before any remediation: `pg_dump $DATABASE_URL > /tmp/pre-rollback.sql`
2. Apply the reverse migration (write a new `00XX_revert_<thing>.sql` rather than mutating the prior file).
3. Coordinate with the on-call DBA before destructive SQL.

## Comms

- Open an incident in the on-call channel with `:incident:` and a one-line scope ("rolling back identity-svc to <SHA>").
- After rollback completes, post a 1-paragraph summary in `#deploys`.
- File the postmortem within 48 hours.

## Verification after rollback

```bash
# Each service should return 200 with status:"healthy".
for svc in identity-svc integration-svc comms-svc billing-svc; do
  url="https://$svc.aivolearning.com/health"
  curl -sS "$url" | jq '{service: .service, status: .status}'
done
```

If any returns `status:"degraded"`, the rollback completed but a downstream is still misbehaving. Read the `checks` block and address the failing dependency before declaring the incident closed.

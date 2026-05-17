# Production release checklist (Sprint 16)

This is the executable checklist for a production release. Every box
must be checked before the deploy. The release runner script at
`scripts/release-gate.mjs` (root `release:gate`) reproduces the
gate set this checklist enforces.

## 1. Code is on the release branch

- [ ] PR is approved and merged to `main`
- [ ] `git log --oneline main..origin/main` is empty
- [ ] No unmerged hotfixes against the previous tag

## 2. Local + CI gates green

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm api:check
pnpm release:gate   # runs every audit + prod check + readiness test
pnpm test:enterprise
```

- [ ] All commands above exit zero
- [ ] CI `production-gates.yml` succeeded on the release commit
- [ ] `api-client-drift` is acceptable (or the drift is intentional
      and the regenerated client is committed)

## 3. Environment + secrets

- [ ] All required env vars set per `docs/dev/local-dev.md` matrix
- [ ] `AUTH_MODE` is `clerk` / `authjs` / `custom` (never `mock`)
- [ ] `AI_PROVIDER` is `anthropic` / `openai` / `google` (never `mock`)
- [ ] `SESSION_SECRET` is ≥ 32 chars and rotated for this release
- [ ] `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` set; old keys retired per
      `docs/runbooks/secret-history-rotation.md`
- [ ] `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` set and verified
      via test webhook
- [ ] `MFA_ENCRYPTION_KEY` KMS-wrapped
- [ ] `OPS_ALERT_WEBHOOK_URL` reachable
- [ ] AI provider key has Sprint 14 budget caps configured
- [ ] `POSTMARK_API_KEY`, `EXPO_ACCESS_TOKEN` valid

## 4. Domains + SSL

- [ ] Marketing site domain valid; HSTS preloaded
- [ ] App domain (web-v2) valid; HSTS preloaded
- [ ] Cert auto-renewal proven (last renewal < 60 days ago)
- [ ] CSP / COOP / COEP headers verified at the edge

## 5. Database

- [ ] Migration plan reviewed (`pnpm db:push --dry-run` if available)
- [ ] Migration applied to staging and replayed against a recent
      backup
- [ ] Read replicas not lagging > 30 s
- [ ] `pg_stat_replication` healthy

## 6. Seed data + admin bootstrap

- [ ] `pnpm db:seed` produces no errors on a fresh tenant
- [ ] Platform admin bootstrap user exists and is MFA-enrolled
- [ ] District admin invite flow tested end-to-end
- [ ] Curriculum seeds (`pnpm curriculum:validate`) green

## 7. Rollback plan

- [ ] Previous-image tag known and re-deployable
- [ ] Backup taken within the last hour
- [ ] Restore drill within the last 30 days (see
      `docs/runbooks/audit-restore.md`)
- [ ] `rollback.yml` workflow tested in staging
- [ ] On-call paged and acknowledged

## 8. Smoke tests post-deploy

```bash
pnpm test:production-readiness
bash scripts/sprint08-prod-smoke.mjs
bash scripts/study-routes-smoke.mjs
```

- [ ] Marketing site `/` returns 200 in < 1 s
- [ ] `/parent/home` after mock-disabled login returns 200
- [ ] `/learner/home` returns 200; primary CTA present
- [ ] `/teacher/home` returns 200
- [ ] Admin `/admin/platform` returns 200 (platform_admin role)
- [ ] Stripe webhook test event accepted
- [ ] AI generation roundtrip succeeds and `provider !== "mock"`
- [ ] Comms test email delivered to known inbox
- [ ] AAC bridge mounts in mobile shell without errors

## 9. Communication

- [ ] Release notes drafted in `docs/releases/<tag>.md`
- [ ] Status page updated (if customer-visible change)
- [ ] District / school admins notified if any contractual API change

## 10. Sign-off

- [ ] Engineering lead approval
- [ ] Compliance / counsel approval (only for releases touching
      consent, IEP, billing, or AI safety policy)
- [ ] On-call schedule confirmed for the next 24 h

After sign-off, deploy via `.github/workflows/deploy-production.yml`.

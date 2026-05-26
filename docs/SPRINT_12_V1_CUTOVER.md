# v1.0 cutover runbook

This is the operational checklist for cutting `claude/dazzling-bell-
vXuZ0` → `main` → `v1.0`. Follow the steps in order. **Do not skip a
preflight** — every check exists because something almost broke in
staging.

## Preflight (T-24h)

### 1. CI green on the branch

```bash
pnpm test                                # unit suites
pnpm --filter @aivo/web-v2 run lint      # eslint
pnpm --filter @aivo/web-v2 run typecheck # tsc
pnpm --filter @aivo/ai-svc run test      # pytest under services/ai-svc/
```

All four must pass on the branch HEAD (`b1b9f46`).

### 2. Migrations applied to staging

The Sprint 4 + 6 migrations introduce two new tables:

```bash
psql "$STAGING_DATABASE_URL" -f packages/db/drizzle/0039_baseline_item_audits.sql
psql "$STAGING_DATABASE_URL" -f packages/db/drizzle/0040_iep_drafts.sql
```

Run idempotently — both files use `CREATE TABLE IF NOT EXISTS`.

### 3. Feature flags staged

Set the following env vars in staging **first**:

```
AIVO_FEATURE_CURRICULUM_GROUNDING=true     # Sprint 1
AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS=true # Sprint 4
```

Verify via the admin UI:

```
GET https://staging.aivolms.com/api/bff/admin/feature-flags
# Both flags should show "active": true
```

### 4. Load tests pass

```bash
export BASE_URL=https://staging.aivolms.com
export AI_BASE_URL=https://ai.staging.aivolms.com
export K6_API_TOKEN=<load-actor service token>
export K6_TENANT_ID=<load-actor tenant>
export K6_LEARNER_ID=<seeded load-test learner uuid>

bash scripts/load/run-all.sh
```

Every endpoint must clear its SLO. Threshold violations exit non-zero
and abort the cut. Archive the JSON summaries from
`scripts/load/out/` to the v1.0 release artifact.

### 5. E2E green against staging

```bash
WEB_BASE_URL=https://staging.aivolms.com \
IDENTITY_BASE_URL=https://identity.staging.aivolms.com \
ASSESSMENT_SVC_URL=https://assessment.staging.aivolms.com \
AI_SVC_URL=https://ai.staging.aivolms.com \
pnpm --filter @aivo/e2e exec playwright test tests/sprint12/
```

Specs that auto-skip (test-mode helper unreachable) are fine; the
**fail** count must be 0.

### 6. Security review signed

`docs/SPRINT_12_SECURITY_REVIEW.md` reviewed + signed by:

- AIVO security lead
- AIVO ops lead
- Engineering on-call for the cut window

### 7. Observability wired

Confirm the Sprint 12 Grafana dashboards render with non-empty data
in staging:

- `AIVO — Baseline & AI Ops` (`infra/grafana/baseline-ops.json`)
- `AIVO — User dashboards activity` (`infra/grafana/role-dashboards.json`)

And the Alertmanager routes:

```bash
kubectl apply -f infra/prometheus/aivo-slo-alerts.yaml
```

Check Alertmanager `/api/v1/status` for `aivo-slo-alerts` group health.

## Cut (T-0)

### 8. Merge the branch

```bash
gh pr create --base main --head claude/dazzling-bell-vXuZ0 \
  --title "v1.0: Sprints 1-12 — baseline pipeline + role dashboards + production hardening" \
  --body-file docs/SPRINT_12_PRODUCTION_READINESS.md
```

Squash-merge after CI passes. Use the PR body as the v1.0 release
notes scaffold.

### 9. Tag v1.0

```bash
git checkout main
git pull
git tag -a v1.0.0 -m "v1.0 — Sprints 1-12 (baseline pipeline, role dashboards, production hardening)"
git push origin v1.0.0
```

Tag triggers the production image builds via `.github/workflows/`.

### 10. Production rollout (canary)

Roll the new images through the staged ramp:

1. Promote to **5 %** of production traffic.
2. Watch the Grafana baseline-ops dashboard for 30 minutes:
   - p95 baseline latency ≤ 30 s
   - fallback rate < 5 %
   - RA block rate < 2 %
3. If all green → ramp to 25 %, watch 30 minutes.
4. If still green → ramp to 100 %.

If **any SLO breaches** during the ramp:

```bash
kubectl rollout undo deployment/<service> -n aivo
```

…and roll back the **feature flag**, not the deploy, if the SLO
breach is content-quality (block-rate / fallback) rather than infra:

```bash
# Disable curriculum grounding while keeping the new code path
kubectl set env deployment/ai-svc \
  AIVO_FEATURE_CURRICULUM_GROUNDING=false -n aivo
```

## Post-cut (T+24h)

### 11. Soak monitoring

For 72 h after the 100 % ramp, watch:

- Daily LLM token spend per tenant — must stay within the configured
  cap (see `aivo_tenant_llm_daily_cap_cents` gauge).
- Prompt-cache hit rate — target ≥ 70 % after warm-up. If lower,
  investigate the cache key segmentation (Sprint 1 keyed by
  district + gradeBand + functioningLevel).
- IEP draft validation failures — < 10 %. If higher, the prompt or
  the schema has drifted; pause the v1.0 → v1.1 cherry-picks until
  resolved.

### 12. Release notes

Publish the v1.0 release notes from the PR body:

- 12 sprints of work (Sprints 1-12 above)
- Headline features:
  - AI baseline grounded in district curriculum (Sprint 1)
  - Strict structured outputs with auto-correction retry (Sprint 2)
  - Curated fallback bank — no more 502 on AI failure (Sprint 3)
  - Responsible-AI gate on every generated item (Sprint 4)
  - Functioning-level scaffold enforcement (Sprint 5)
  - Baseline → IEP draft pipeline (Sprint 6)
  - School admin dashboard now reads live data (Sprint 7)
  - School reports + class CRUD + staff invites (Sprint 8)
  - Therapist + caregiver dashboards land end-to-end (Sprints 9-10)
  - Teacher IEP review queue + gradebook detail (Sprint 11)
  - Feature-flag inventory + baseline observability (Sprint 12)
- Migration notes: 0039_baseline_item_audits, 0040_iep_drafts.
- Operational changes: two new feature flags, new Grafana dashboards,
  new Prometheus alerts.

### 13. Backlog hand-off

Items deferred from Sprint 12 to v1.1 backlog:

- Real-time SSE for IEP-draft lifecycle transitions (teacher dashboard).
- Caregiver attachment upload pipeline (file scanning, S3 storage).
- District-level rollup of the school dashboard.
- LLM model auto-switching by tenant cost band.
- Mobile parity for the new therapist + caregiver authoring surfaces.

## Rollback playbook

If a P1 lands within the first 72 h:

```bash
# Revert the tag
git revert v1.0.0
git tag -a v1.0.0-rollback -m "Reverting v1.0 after $REASON"
git push origin v1.0.0-rollback

# Roll deploys back to the previous known-good image
kubectl rollout undo deployment/ai-svc -n aivo
kubectl rollout undo deployment/assessment-svc -n aivo
kubectl rollout undo deployment/web-v2 -n aivo

# Disable the new feature flags so the rolled-back code path doesn't
# try to call curriculum-svc or the responsible-AI gate.
kubectl set env deployment/ai-svc \
  AIVO_FEATURE_CURRICULUM_GROUNDING=false \
  AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS=false -n aivo
```

Then file a post-mortem within 48 h.

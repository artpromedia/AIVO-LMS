# IEP Integration — Containerized Delivery & Operations Runbook

> **Status:** Authoritative implementation + ops contract for wiring the IEP AI
> agent, the brain↔IEP progress sync, and the role dashboards.
> **Audience:** Platform/DevOps, backend on-call, release manager.
> **Scope rule:** This document only adds *wiring, containers, env, CI, rollout*.
> It does **not** redesign the existing IEP feature surface (already shipped in
> `services/assessment-svc`, `services/ai-svc`, `services/brain-svc`, `apps/web-v2`).

---

## 0. Operating principles (non-negotiable)

1. **No new long-lived service unless a queue demands it.** The IEP work fits
   inside three services that are *already built and deployed*
   (`assessment-svc`, `ai-svc`, `brain-svc`). We add one **CronJob worker**
   only for the progress sync, packaged from the existing `brain-svc` image —
   zero new Dockerfiles for app code.
2. **Every change is reversible in < 5 min** via the existing
   `.github/workflows/rollback.yml` and image `:previous` tags.
3. **Fail closed on auth, fail open on audit.** Service-to-service calls carry
   `INTERNAL_AI_TOKEN`; audit / progress-note write failures never block the IEP
   flow (matches the existing `assessment-svc/src/lib/audit.ts` contract).
4. **Parity across envs.** Local (`docker compose`) == staging == prod in image
   provenance and env-var *shape*. Only secret *values* differ.

---

## 1. Current container topology (verified)

| Component | Lang/Runtime | Build file | Port | In deploy matrix? |
|---|---|---|---|---|
| `assessment-svc` | Node 22 / Fastify | `docker/Dockerfile.service` | `3003` | ✅ |
| `ai-svc` | Python 3.12 / FastAPI | `docker/Dockerfile.python-service` | `3004`/`3000` | ✅ |
| `brain-svc` | Python 3.12 / FastAPI | `docker/Dockerfile.python-service` | `3002`/`8000` | ✅ |
| `apps/web-v2` | Node 22 / Next.js | `docker/Dockerfile.webapp` | `3000` | ✅ |
| `iep-progress-sync` *(NEW)* | Python 3.12 (reuses `brain-svc` image) | *none — reuse* | n/a (CronJob) | ➕ added |

**Key takeaway:** the only *new* runtime artifact is a CronJob that runs the
`brain-svc` image with a different command. No new app Dockerfile.

> **Deployment reality:** this platform deploys via **Helm onto k3s**
> (`deploy-hetzner.yml`, `deploy-staging.yml`, `deploy-production.yml`), not via
> raw `docker run` on a single host. The worker is therefore realized as a
> Kubernetes **CronJob** (the k8s equivalent of the "CronJob-style worker"
> intent), applied inline by the deploy job after the service rollout.

---

## 2. Release blocker fixed — `iep_goals` column mismatch

`services/brain-svc/src/brain_svc/routes/analysis.py` read columns that don't
exist in the schema, so `/api/brain/{learner_id}/ai-summary` 500'd the moment a
learner had an active IEP goal.

**Schema of record** — `packages/db/src/schema/learners.ts` `iep_goals`:
`goal_text`, `domain`, `baseline`, `target_criteria`, `current_progress`, `status`.

The query now aliases the real columns to the keys the prompt builder expects
(`domain AS goal_area`, `goal_text AS description`, `current_progress AS
progress_percent`). The downstream `context["iep_goals"]` dict shape is
unchanged, so no prompt or test changes were required. Ships independently as a
hotfix.

---

## 3. File change manifest

Legend: 🆕 create · ✏️ edit · 🔁 reuse (no file change)

| # | Path | Action | Purpose |
|---|---|---|---|
| 1 | `services/brain-svc/src/brain_svc/routes/analysis.py` | ✏️ | Fix `iep_goals` column mismatch (§2) |
| 2 | `.env.example` | ✏️ | Document `assessment-svc → ai-svc` wiring & sync cadence (§4) |
| 3 | `docker/docker-compose.iep.yml` | 🆕 | Local full-loop stack: pg + ai-svc + assessment-svc + brain-svc + sync (§5) |
| 4 | `services/brain-svc/src/brain_svc/jobs/iep_progress_sync.py` | 🆕 | Worker: mastery → `iep_goals.current_progress` (§6) |
| 5 | `docker/iep-progress-sync.entrypoint.sh` | 🆕 | Container entrypoint for the worker (§6) |
| 6 | `.github/workflows/deploy-hetzner.yml` | ✏️ | Inject env into `assessment-svc`; deploy the sync CronJob (§7) |
| 7 | `.github/workflows/iep-integration-smoke.yml` | 🆕 | Reusable post-deploy smoke gate (§8) |
| 8 | `scripts/smoke/iep-integration-smoke.sh` | 🆕 | Executable smoke probe used by #7 and locally (§8) |
| 9 | `services/ai-svc/src/ai_svc/routes/generate.py` | ✏️ | `AI_MOCK` affordance for the offline/CI draft round-trip (§8.3) |
| 10 | `.github/workflows/deploy-staging.yml` / `deploy-production.yml` | ✏️ | Wire the smoke gate after deploy (§8) |
| 11 | `docs/runbooks/iep-integration-devops-runbook.md` | 🆕 | This document |

---

## 4. `.env.example` — service-to-service & sync wiring

Added under **Internal service-to-service auth**:

```dotenv
AI_IEP_DRAFT_TIMEOUT_MS=20000        # assessment-svc → ai-svc draft timeout (ms)
IEP_PROGRESS_SYNC_CRON=*/15 * * * *  # worker cadence (UTC); empty disables
IEP_PROGRESS_SYNC_MIN_DELTA=0.05     # min mastery delta before a write/note
IEP_PROGRESS_SYNC_AUTHOR_ID=         # users(id) author for the parent note
```

`AI_SVC_URL` and `INTERNAL_AI_TOKEN` already exist; `assessment-svc` now also
consumes them. In production `INTERNAL_AI_TOKEN` is delivered via the shared
`aivo-common-env` secret (`envFrom`), so no new secret is provisioned.

---

## 5. `docker/docker-compose.iep.yml` — local full-loop stack

Models `docker-compose.e2e.yml` (Postgres 16, build-arg `SERVICE_NAME`,
node/python healthchecks). Brings up `pg + ai-svc + assessment-svc + brain-svc +
iep-progress-sync` so a developer can exercise generate-draft + progress-sync
end to end. `ai-svc` runs with `AI_MOCK=1` so the draft round-trip is
deterministic and needs no live LLM credentials (see §8.3).

---

## 6. Progress-sync worker

`services/brain-svc/src/brain_svc/jobs/iep_progress_sync.py` is thin: read the
latest mastery per learner (`brain_states.mastery_levels`, 0..1 per domain), map
to each active IEP goal's domain, write `iep_goals.current_progress` (0..100)
when the delta clears `IEP_PROGRESS_SYNC_MIN_DELTA`, and append a
`parent`-visible `iep_progress_notes` row. Pure SQLAlchemy core, reusing the
**brain-svc image** — no new build to maintain. Idempotent: re-running without
new mastery data is a no-op.

**Schema constraint handled:** `iep_progress_notes.author_id` is `NOT NULL` with
an FK to `users(id)`, so the worker cannot insert a NULL system author. The
**progress write is the primary, per-goal committed action**; the progress note
is **best-effort** and only attempted when `IEP_PROGRESS_SYNC_AUTHOR_ID`
resolves to a real user. A note failure is logged and **never rolls back** the
progress write (fail open on audit). When no author is configured, progress is
still written and the note is skipped.

`docker/iep-progress-sync.entrypoint.sh` execs `python -m
brain_svc.jobs.iep_progress_sync` (the image sets `PYTHONPATH=/app/src`).

---

## 7. `deploy-hetzner.yml`

`assessment-svc`, `ai-svc`, and `brain-svc` images are already built by the
existing build/push jobs — no matrix change.

**7.1 — assessment-svc env.** Added `--set env.AI_IEP_DRAFT_TIMEOUT_MS=20000` to
the `assessment-svc` Helm `EXTRA_SETS` in both staging and production blocks.
`AI_SVC_URL` was already set there; `INTERNAL_AI_TOKEN` is inherited from the
`aivo-common-env` secret via `envFrom`.

**7.2 — progress-sync CronJob.** After the service rollout loop (staging and
prod), the deploy job `kubectl apply`s a `batch/v1` **CronJob** named
`iep-progress-sync`:

- image: `${IMAGE_PREFIX}/brain-svc:<tag>` (staging `latest`, prod `<version>`)
- command: `python -m brain_svc.jobs.iep_progress_sync`
- `schedule: "*/15 * * * *"`, `concurrencyPolicy: Forbid`, `restartPolicy: Never`
- `IEP_PROGRESS_SYNC_ONCE=1` (one run per tick) + `IEP_PROGRESS_SYNC_MIN_DELTA`
- `envFrom`: `aivo-common-env` (DATABASE_URL / INTERNAL_AI_TOKEN) + `db-secrets`
  (`optional: true`)

The worker shares the brain-svc image, so it is rebuilt and re-pinned on every
deploy — no separate image lifecycle. It runs as brain-svc's non-root user.

---

## 8. Post-deploy smoke gate

**8.1 — `scripts/smoke/iep-integration-smoke.sh`** verifies: (1) ai-svc
`/health`, (2) assessment-svc `/health`, (3) `POST
/api/ai/iep/draft` returns a schema-valid `IEPDraftResponse` (asserts `draft`
and `model`). Exits non-zero on any failure. The draft path is overridable via
`IEP_DRAFT_PATH` (default `/api/ai/iep/draft` — the route is mounted under the
ai-svc `/api/ai` prefix).

**8.2 — `.github/workflows/iep-integration-smoke.yml`** is a reusable
(`workflow_call` + `workflow_dispatch`) workflow that runs the probe against
`ai_svc_url` / `assessment_svc_url` with the `INTERNAL_AI_TOKEN` secret.

It is wired into `deploy-staging.yml` and `deploy-production.yml` as the
`iep-smoke` job (`needs: [deploy]`), passing `vars.AI_SVC_URL` /
`vars.ASSESSMENT_SVC_URL` ingress URLs.

**8.3 — `AI_MOCK` affordance.** ai-svc's LLM gateway has no mock path, so the
`/api/ai/iep/draft` route now short-circuits to a deterministic, schema-valid
`IEPDraftResponse` when `AI_MOCK=1`. This is what makes the local compose loop
and offline smoke pass without live model credentials or spend; it has no effect
in any environment where `AI_MOCK` is unset (staging/production run the real
drafter).

---

## 9. Build & verify locally

```bash
# 1. Full loop up
docker compose -f docker/docker-compose.iep.yml up --build --wait

# 2. Smoke (uses /api/ai/iep/draft against the local stack)
AI_SVC_URL=http://localhost:3004 \
ASSESSMENT_SVC_URL=http://localhost:3003 \
INTERNAL_AI_TOKEN=iep-local-internal-ai-token \
  ./scripts/smoke/iep-integration-smoke.sh

# 3. Exercise the worker once (writes current_progress where mastery moved)
docker compose -f docker/docker-compose.iep.yml run --rm iep-progress-sync

# 4. Tear down
docker compose -f docker/docker-compose.iep.yml down -v
```

**Expected:** smoke prints `PASS — IEP draft round-trip healthy`; worker logs
`iep-progress-sync: N goal(s) updated`.

---

## 10. Rollout plan (reversible, staged)

| Stage | Action | Gate to proceed |
|---|---|---|
| **0. Hotfix** | Ship §2 brain-svc fix | `brain-svc /health` green; `ai-summary` no longer 500s |
| **1. Staging** | Deploy items 2–10; CronJob created | `iep-smoke` job green |
| **2. Canary** | Existing `canary-soak.yml`; hold 30 min | No `5xx` increase on `assessment-svc`; worker writes ≤ expected rows |
| **3. Production** | `deploy-production.yml` → `iep-smoke` gate | Smoke green; dashboards render progress |
| **4. Worker watch** | Confirm `iep-progress-sync` CronJob scheduled, last job `Complete` | 2 consecutive clean ticks |

---

## 11. Rollback (≤ 5 min)

```bash
# App services — re-pin previous images via the existing workflow.
gh workflow run rollback.yml -f service=assessment-svc -f to=previous
gh workflow run rollback.yml -f service=brain-svc      -f to=previous

# Worker — suspend without touching app traffic. Sync is best-effort; pausing it
# only freezes iep_goals.current_progress, it does NOT affect draft generation.
kubectl -n <ns> patch cronjob iep-progress-sync -p '{"spec":{"suspend":true}}'

# Feature kill-switch without redeploy: unset AI_SVC_URL on assessment-svc and
# restart it. The generate route fails closed; all other IEP authoring/collab/
# signature routes keep working.
```

**Blast radius:** disabling the worker or the generate route does **not** touch
the already-shipped IEP authoring, comments, revisions, e-signatures, or parent
share.

---

## 12. Observability & SLOs

| Signal | Source | Alert |
|---|---|---|
| `assessment-svc` 5xx rate | `/metrics` | > 2% over 5 min → page |
| ai-svc `/api/ai/iep/draft` p95 latency | ai-svc `/metrics` | > 8 s over 10 min → warn |
| Worker liveness | `iep-progress-sync` CronJob last-job status + stdout | no successful job in 30 min → warn |
| Audit completeness | `audit_events` rows for `IEP_*` | drop to zero while drafts created → warn |

SLOs: draft generate **availability ≥ 99%**, **p95 ≤ 8 s**; worker freshness
**≤ 30 min** between mastery change and `current_progress` write.

---

## 13. Security posture

- **Non-root:** the worker inherits brain-svc's non-root user (uid `1001`).
- **Secrets:** `INTERNAL_AI_TOKEN` stays in the CI/deploy secret store and the
  `aivo-common-env` k8s secret; never in the image or logs. The local compose
  value is a throwaway, explicitly labelled "please-do-not-deploy".
- **Network:** `assessment-svc → ai-svc` is east-west only (cluster-local DNS).
- **Data:** the worker writes `parent`-visibility progress notes only (no PII
  beyond percentages). It never logs learner names.
- **Supply chain:** worker == brain-svc image, already covered by `codeql.yml`,
  `security-scan.yml`, and `secret-scan.yml`. No new scan surface.

---

## 14. Definition of Done

- [x] §2 brain-svc column fix merged (`ai-summary` no longer 500s on active goals).
- [x] `docker/docker-compose.iep.yml` brings up the full loop.
- [x] `scripts/smoke/iep-integration-smoke.sh` is executable and asserts the draft round-trip.
- [x] `assessment-svc` runtime gains `AI_IEP_DRAFT_TIMEOUT_MS`; `AI_SVC_URL` + `INTERNAL_AI_TOKEN` present.
- [x] `iep-progress-sync` CronJob deployed (staging + prod).
- [x] `iep-integration-smoke` gate wired into staging **and** production deploys.
- [x] Rollback documented: CronJob suspend + generate kill-switch, both non-disruptive.
- [x] This runbook lives under `docs/runbooks/`.

---

## 15. Implementation notes / deviations from the initial draft

The original draft assumed a single-host `docker run` deploy and a few field
names that differ from the live codebase. The shipped implementation corrects:

1. **Draft path** is `/api/ai/iep/draft` (the route is under the `/api/ai`
   prefix), not `/iep/draft`. The smoke probe targets the correct path
   (overridable via `IEP_DRAFT_PATH`).
2. **Worker note author** — `iep_progress_notes.author_id` is `NOT NULL` (FK to
   `users`), so the worker cannot insert a NULL author. Progress is written
   unconditionally; the note is best-effort and gated on
   `IEP_PROGRESS_SYNC_AUTHOR_ID` (see §6).
3. **Deploy mechanism** — the worker is a Kubernetes **CronJob** applied by the
   Helm-based deploy jobs, not a `docker run --restart unless-stopped` container.
4. **`AI_MOCK`** is implemented in the `/api/ai/iep/draft` route (the LLM gateway
   had no mock path), so the offline compose loop and CI smoke are deterministic.

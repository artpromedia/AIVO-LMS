# AIVO load tests (k6)

This directory holds the production load-test suite Sprint 12 documents.
Five test files target the latency-critical endpoints; one
`run-all.sh` driver executes them in sequence against staging.

## Prereqs

```bash
# macOS
brew install k6

# Linux
sudo apt-get install -y k6

# Or via docker
docker run --rm -i grafana/k6 run - <baseline.js
```

## Environment

The runner reads:

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `https://staging.aivolms.com` | Web BFF entrypoint |
| `AI_BASE_URL` | `https://ai.staging.aivolms.com` | ai-svc direct |
| `ASSESSMENT_BASE_URL` | `https://assessment.staging.aivolms.com` | assessment-svc direct |
| `K6_API_TOKEN` | _(required)_ | Service-token issued by identity-svc for the load actor |
| `K6_TENANT_ID` | _(required)_ | Tenant the load actor is scoped to |
| `K6_LEARNER_ID` | _(required)_ | Pre-seeded learner UUID used by the AI endpoints |
| `K6_DURATION` | `5m` | Override per-endpoint ramp duration |

## Running

```bash
# One endpoint
k6 run scripts/load/baseline-generate.js

# Full suite
bash scripts/load/run-all.sh

# Push the JSON summary into Grafana Cloud (or any HTTP sink)
k6 run --out json=baseline.json scripts/load/baseline-generate.js
```

## Thresholds (mirror docs/SPRINT_12_PRODUCTION_READINESS.md)

| Endpoint | Target VUs | Duration | p95 SLO |
|---|---|---|---|
| `POST /api/ai/generate-baseline` | 50 | 5 min | < 30 s |
| `POST /api/ai/iep/draft` | 25 | 5 min | < 40 s |
| `GET /api/bff/admin/school/dashboard` | 200 | 10 min | < 500 ms |
| `POST /api/bff/therapist/sessions` | 50 | 5 min | < 800 ms |
| `GET /api/bff/admin/baseline-metrics` | 100 | 10 min | < 600 ms |

Each script declares the threshold via `options.thresholds` so a SLO
violation **fails the run** — k6 exits non-zero and CI rolls back the
deploy. There is no "soft warning" mode here on purpose.

## Cost guard

LLM endpoints respect the per-tenant daily cap in
`services/ai-svc/.../budget_caps.py`. The load actor's tenant has a
`load_test` flag that increases the cap 10× so a 5-minute ramp does
not exhaust the real production allowance.

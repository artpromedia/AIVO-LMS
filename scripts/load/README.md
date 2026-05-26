# Load tests (k6)

This directory contains the Sprint 12 v1-cutover load test suite. Each script
exercises one production-critical endpoint with a defined SLO threshold; a
breach fails the run via k6's `thresholds`.

## Scripts and SLOs

| Script | Endpoint | VUs | p95 budget |
| --- | --- | --- | --- |
| `baseline.k6.js` | `POST /api/ai/generate-baseline` | 50 | 30s |
| `iep-draft.k6.js` | `POST /api/ai/iep/draft` | 25 | 40s |
| `admin-dashboard.k6.js` | `GET /api/bff/admin/school/dashboard` | 200 | 500ms |
| `therapist-sessions.k6.js` | `POST /api/bff/therapist/sessions` | 50 | 800ms |
| `baseline-metrics.k6.js` | `GET /api/bff/admin/baseline-metrics` | 100 | 600ms |

All scripts follow the same shape: 60s ramp up, 4m steady, 60s ramp down,
emitting a JSON summary into `scripts/load/results/<name>-summary.json`.

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) >= 0.50
- A staging tenant + bearer token with the right role
  (`PLATFORM_ADMIN` for admin endpoints; `THERAPIST` for therapist endpoints).
  Use a dedicated `loadtest@` user so audit logs are easy to filter.

## Run locally

```bash
export BASE_URL="https://staging.aivo.internal"
export LOAD_TEST_TOKEN="$(./scripts/internal/mint-load-test-token.sh)"

mkdir -p scripts/load/results

k6 run scripts/load/baseline.k6.js
k6 run scripts/load/iep-draft.k6.js
k6 run scripts/load/admin-dashboard.k6.js
k6 run scripts/load/therapist-sessions.k6.js
k6 run scripts/load/baseline-metrics.k6.js
```

The `BASE_URL` and `LOAD_TEST_TOKEN` env vars are required. Scripts will throw
at startup if `LOAD_TEST_TOKEN` is unset, so they never accidentally hit prod
without authentication.

## Run in CI

`.github/workflows/load-test.yml` (existing) wires these scripts into nightly
runs. Outputs are uploaded as workflow artifacts under
`load-test-results/<name>-summary.json` and posted to Grafana Cloud k6 via
`K6_CLOUD_TOKEN` when configured.

## Adding a new script

1. Copy any of the existing files as a template.
2. Adjust the `scenarios` block (`target` VUs and stage durations).
3. Set the right `thresholds.http_req_duration` budget.
4. Wire it into the SLO list above and into `.github/workflows/load-test.yml`.
5. Update `docs/SPRINT_12_SECURITY_REVIEW.md` if it touches a new role.

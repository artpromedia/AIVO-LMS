# curriculum-svc

`curriculum-svc` is a small read-only FastAPI service that consolidates
curriculum lookup over the data shapes defined in `@aivo/skill-graphs`
and `@aivo/content-pack`. It is the canonical replacement for the
LLM-synthesized curriculum that lived in `brain-svc/curriculum.py` —
brain-svc and tutor-svc should call here for "what should this learner
study next" questions, and reserve LLM calls for personalization.

Initial scope (this PR):

- Read-only catalogue served from a JSON snapshot bundled under
  `src/curriculum_svc/data/skill_graphs.json`. The snapshot is generated
  from `packages/skill-graphs` and `packages/content-pack` as part of the
  monorepo build; the service does not synthesize content at runtime.
- `GET /api/curriculum/health` — health check.
- `GET /api/curriculum/lookup` — lookup endpoint with the following
  query parameters (all optional but at least one is required):
  - `subject` — math / ela / science / ...
  - `gradeBand` — K / 1 / 2 / ...
  - `skillId` — return one specific skill node + immediate prereqs.
- `GET /api/curriculum/skills/{skill_id}/path` — return the prerequisite
  chain leading up to a skill (longest-first), useful for the brain-svc
  "next-action" endpoint.

## Authentication

Every route except `GET /api/curriculum/health` requires one of two real
credential modes:

1. **Service token** — `X-Service-Token: <token>` matching
   `INTERNAL_SERVICE_TOKEN`, for service-to-service calls (brain-svc,
   tutor-svc, …). The comparison is constant-time.
2. **User JWT** — `Authorization: Bearer <jwt>`, a real RS256 access
   token issued by identity-svc and verified against the shared
   `JWT_PUBLIC_KEY` (the SPKI PEM public half of the platform keypair).
   Verification enforces the signature, `exp`, and `iss`
   (`aivo:identity-svc`), pins `alg=RS256` (rejecting `alg: none` and
   HS256-confusion), and optionally checks `aud` when `JWT_AUDIENCE` is
   set. On success the route receives a `Principal`
   (`mode` / `sub` / `role` / `tenantId`).

In non-production environments the dev token `aivo-internal-dev-token`
is accepted so local compose and unit tests work without a generated
secret.

**Production fail-closed:** the service refuses to boot if neither
`INTERNAL_SERVICE_TOKEN` nor `JWT_PUBLIC_KEY` is configured
(`NODE_ENV=production`/`ENV=production`). It never silently accepts an
unverified token.

Future scope (out of this PR — tracked in INTEGRATION_STATUS.md):

- gRPC mode for low-latency in-cluster reads.
- Authoring write-path (CMS UI) — separate PR.
- Live re-load of the snapshot via S3 sidecar.

## Run

```
pip install -r requirements.txt
uvicorn curriculum_svc.main:app --port 3010
```

## Test

```
PYTHONPATH=src pytest tests/ -v
```

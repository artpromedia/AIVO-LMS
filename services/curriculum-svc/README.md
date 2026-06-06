# curriculum-svc

`curriculum-svc` is a small read-only FastAPI service that consolidates
curriculum lookup over the data shapes defined in `@aivo/skill-graphs`
and `@aivo/content-pack`. It is the canonical replacement for the
LLM-synthesized curriculum that lived in `brain-svc/curriculum.py` —
brain-svc and tutor-svc should call here for "what should this learner
study next" questions, and reserve LLM calls for personalization.

Initial scope (this PR):

- Read-only catalogue served from a JSON snapshot bundled under
  `src/curriculum_svc/data/skill_graphs.json`. The snapshot is **compiled
  deterministically** from the per-jurisdiction source catalogues under
  `packages/content-pack/data/<jurisdiction>/catalogue.json` (US-CCSS plus
  NG-NERDC, AE-MOE, GB-NC) by `scripts/build_snapshot.py`; the service does
  not synthesize content at runtime. Regenerate with
  `python scripts/build_snapshot.py`; CI runs `--check` to fail on drift.
- `GET /api/curriculum/health` — health check.
- `GET /api/curriculum/jurisdictions/resolve` — resolve a learner's
  jurisdiction to its district scope + framework (see Jurisdictions
  below). Params: `country` (required), `region`, `postalCode`,
  `districtId`.
- `GET /api/curriculum/lookup` — lookup endpoint. At least one *filter*
  (`subject` / `gradeBand` / `skillId`) is required, plus a jurisdiction:
  - jurisdiction: a US `zipCode`/`postalCode`/`districtId`, or a
    `country` (+ optional `region`) for non-US learners.
  - `subject` — math / ela / science / ...
  - `gradeBand` — K / 1 / 2 / ... (or a framework's own band, e.g.
    `Primary-3` for NG).
  - `skillId` — return one specific skill node + immediate prereqs.
- `GET /api/curriculum/skills/{skill_id}/path` — return the prerequisite
  chain leading up to a skill (longest-first), useful for the brain-svc
  "next-action" endpoint.

## Jurisdictions (internationalization)

A *jurisdiction* is the `{country, region?, district?, postalCode?}`
tuple that identifies whose approved curriculum a learner receives:

- **US** resolves by ZIP → district (unchanged).
- **NG / AE / GB / …** resolve by `country` (+ optional `region`). The
  governing framework comes from the single framework registry in
  `frameworks.py` (NERDC, UAE MOE, UK National Curriculum, …).

A non-US country is **never** silently mapped to US/CCSS. A recognised
country with no curriculum seeded yet returns an explicit
`404 "no curriculum seeded for <country>-<region>"`; an unrecognised
country returns `404 "no curriculum framework registered…"`. Real NG/AE/GB
content is seeded in Sprint 3. See
[docs/curriculum/ARCHITECTURE.md](../../docs/curriculum/ARCHITECTURE.md).

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

# curriculum-svc

`curriculum-svc` is a small read-only FastAPI service that consolidates
curriculum lookup over the data shapes defined in `@aivo/skill-graphs`
and `@aivo/content-pack`. It is the canonical replacement for the
LLM-synthesized curriculum that lived in `brain-svc/curriculum.py` —
brain-svc and tutor-svc should call here for "what should this learner
study next" questions, and reserve LLM calls for personalization.

Initial scope (this PR):

* Read-only catalogue served from a JSON snapshot bundled under
  `src/curriculum_svc/data/skill_graphs.json`. The snapshot is generated
  from `packages/skill-graphs` and `packages/content-pack` as part of the
  monorepo build; the service does not synthesize content at runtime.
* `GET /api/curriculum/health` — health check.
* `GET /api/curriculum/lookup` — lookup endpoint with the following
  query parameters (all optional but at least one is required):
    * `subject`  — math / ela / science / ...
    * `gradeBand` — K / 1 / 2 / ...
    * `skillId`  — return one specific skill node + immediate prereqs.
* `GET /api/curriculum/skills/{skill_id}/path` — return the prerequisite
  chain leading up to a skill (longest-first), useful for the brain-svc
  "next-action" endpoint.

Future scope (out of this PR — tracked in INTEGRATION_STATUS.md):

* gRPC mode for low-latency in-cluster reads.
* Authoring write-path (CMS UI) — separate PR.
* Live re-load of the snapshot via S3 sidecar.

## Run

```
pip install -r requirements.txt
uvicorn curriculum_svc.main:app --port 3010
```

## Test

```
PYTHONPATH=src pytest tests/ -v
```

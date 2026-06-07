# Promises traceability

Maps each of the four product promises to the code that delivers it and
the test that proves it. Every row is **green** — backed by passing tests
in this repo (commands below are runnable from the repo root).

| # | Promise | Delivered by | Proven by |
| - | ------- | ------------ | --------- |
| 1 | **Robust agentic models** — LLMs personalize, never decide authoritative truth; hallucinated standards are rejected; model fallback doesn't waste retries. | ADR 0040/0041; `services/brain-svc/.../curriculum_validator.py`, `curriculum_engine.py` (scaffold-only prompt + validation); `llm_gateway.build_model_chain` (dedupe) | `services/brain-svc/tests/test_curriculum_validator.py` (NG-FAKE.9.99 dropped, real code passes); `services/brain-svc/tests/test_llm_gateway.py` (no double-try) |
| 2 | **Caregiver / teacher input improves service** — observations become parent-approval recommendations citing their source; parents keep approval authority. | `services/recommendation-svc/.../observation-signal-transformer.ts`, `recommendation-generator.ts`, `observation-consumer.ts` (bus); `services/family-svc/.../suggestions.ts`, `observations.ts` (publish) | `services/recommendation-svc/src/__tests__/observation-signal-transformer.test.ts`; `.../observation-consumer.test.ts` (publish→consume→PENDING recommendation); `services/family-svc/test/suggestions.test.ts`, `bus.test.ts` |
| 3 | **Jurisdiction-correct curriculum** — US/NG/AE/GB learners each get their own framework; an unseeded country shows an explicit gap, never US/CCSS. | `services/curriculum-svc/.../jurisdiction.py`, `frameworks.py`, `catalogue.resolve_jurisdiction`; `packages/content-pack/data/{us-ccss,ng-nerdc,ae-moe,gb-nc}`; `scripts/build_snapshot.py` | `services/curriculum-svc/tests/test_jurisdiction.py` (NG→NERDC, AE→MOE, GB→NC; AU unseeded→404; unknown→404; never US fallback) |
| 4 | **Term-scoped syllabus journey** — upload a whole-term syllabus → dated break-aware weekly foci; off-curriculum items flagged. | `services/ai-svc/.../term_syllabus_parser.py` (+ route); `services/brain-svc/.../pacing_engine.py` (`normalize_uploaded_scope`); `services/curriculum-svc/.../validation.py` (+ `routes/validate.py`); web-v2 BFF + UI; migrations 0068/0069 | `services/ai-svc/tests/test_term_syllabus_parser.py` (12 weeks, >32KB chunking); `services/brain-svc/tests/test_term_pacing.py` (12 break-aware weeks); `services/curriculum-svc/tests/test_validate.py` (off-curriculum flagged); `apps/web-v2/lib/learner/term-syllabus.test.ts` |

## Verify

```bash
# Python (per service venv / PYTHONPATH=<svc>/src)
pytest services/curriculum-svc/tests services/brain-svc/tests services/ai-svc/tests

# TypeScript
pnpm --filter @aivo/recommendation-svc test
( cd apps/web-v2 && pnpm vitest run lib/learner/term-syllabus.test.ts )

# Hardening gates
bash .agents/scripts/no-stub-gate.sh
python services/curriculum-svc/scripts/build_snapshot.py --check
pytest services/curriculum-svc/tests/test_load_lookup.py   # p95 budget

# End-to-end (full stack)
docker compose -f docker-compose.e2e.yml up --build  # then: e2e/tests/*.spec.ts
```

## Latency budget

`test_load_lookup.py` asserts an in-process handler **p95 < 50 ms** for both
`/lookup` and `/validate` (guards against algorithmic regressions; network
transport is measured separately by the load harness).

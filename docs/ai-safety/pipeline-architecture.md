# Responsible-AI pipeline architecture (Sprint 14)

The responsible-ai-svc evaluator composes four real detectors behind a
single pipeline call (`services/responsible-ai-svc/src/pipeline.ts`).
Every learner turn and every model output passes through it.

## Detectors

| Order | Detector | File | Sync? | What it catches |
| --- | --- | --- | --- | --- |
| 1 | PII / IEP-data leak | `src/detectors/pii.ts` | async (LLM judge) | SSN, phone, email, US address, student-id; IEP goal ids, ICD-10/DSM-5-TR codes, accommodation codes, IEP disclosure phrases |
| 2 | Prompt injection | `src/detectors/injection.ts` | sync | Instruction override, role hijack, system-prompt extraction, indirect injection via tool output |
| 3 | Crisis / self-harm | `src/detectors/crisis.ts` | async (classifier) | Self-harm, suicidal ideation, abuse disclosure, violence toward others. Triggers `escalateCrisis(...)` side-effects when verdict=block. |
| 4 | Age-appropriate gate | `src/detectors/age.ts` | async (family-svc) | Per-band gating: graphic violence, weapon construction, sexual content, romance/dating, substances, clinical advice. |

All four run in parallel inside `runPipeline()`. Each returns a
`DetectorResult { detector, verdict, evidence, errored, … }` where
`verdict ∈ {'allow', 'block', 'review'}`. The composer picks the
strongest verdict (block > review > allow).

## Verdict combinator

```
pipeline.verdict = block  if any detector returned 'block'
                  = review if any detector returned 'review'
                  = allow  otherwise
```

The route handler then merges the pipeline verdict with the legacy
EvaluateOutput fan-out (surface requirements, homework integrity,
profile adherence) — the stronger of the two wins.

## Fail-CLOSED policy

When `RESPONSIBLE_AI_FAIL_CLOSED=true` (default in `.env.example`) and
any detector returns `errored: true`:

- a pipeline that would otherwise have been `allow` is downgraded to
  `review` (and `failedClosed=true` is set in the result envelope).
- `block` is preserved.

Detector-level errors are also surfaced in the response so dashboards
can alert on `responsible_ai_block_total{verdict="review"}` spikes
caused by an upstream dependency outage rather than real signals.

If the pipeline itself throws (a bug in our code, not in a detector
hook), the route returns HTTP 503 — the caller must NOT proceed with
the model response.

## Side-effects

The pipeline is pure. Side-effects fire from the route handler only
when the merged verdict is non-allow:

| Side-effect | When | Where |
| --- | --- | --- |
| Audit emission to audit-svc | every non-allow verdict | `services/responsible-ai-svc/src/lib/audit.ts` |
| PagerDuty page | crisis detector verdict=block | `escalateCrisis()` → `pagePagerDuty()` |
| Parent ↔ teacher thread message | crisis detector verdict=block | `escalateCrisis()` → `postToParentTeacherThread()` (S13 dep) |
| `crisis_escalation_total` metric | crisis detector verdict=block | `recordCrisisEscalation()` |
| `responsible_ai_block_total` metric | every non-allow detector result | pipeline emits per-detector |
| `responsible_ai_evaluation_total` metric | every pipeline run | pipeline emits per-verdict |

The PagerDuty / thread / audit fan-out runs in parallel
(`Promise.all`); a partial failure logs the error string but does NOT
block the route reply — the audit envelope already captures the
decision so the page failure can be replayed by the on-call.

## Performance budget

The pipeline runs on every learner turn. Budget:

- p50 < 25 ms (all four detectors parallel; injection + crisis are
  sync; pii and age are I/O-bound)
- p95 < 75 ms
- p99 < 150 ms

The crisis classifier and PII LLM judge are the only model calls in
the hot path; both are bounded by `RESPONSIBLE_AI_FAIL_CLOSED` (fail
back to deterministic verdict on timeout) and a 1500 ms total
audit-svc timeout (`AUDIT_TIMEOUT_MS`).

## Tests

- `__tests__/detectors/{pii,injection,crisis,age}.test.ts` — unit
  tests per detector, including the errored-fail-closed path.
- `__tests__/red-team.test.ts` — labeled corpus regression with
  thresholds ≥99% block on positives and ≤1% false positive on
  negatives. Starter corpus lives in
  `__tests__/fixtures/red-team/{positives,negatives}/*.json` — see
  the README in that directory for expansion plans.
- `e2e/tests/sprint14/red-team.spec.ts` — runs a curated subset of
  the same corpus against the staging responsible-ai-svc.

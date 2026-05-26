# Red-team labeled corpus (Sprint 14 — starter set)

These fixtures drive `red-team.test.ts` and the staging E2E spec
`e2e/tests/sprint14/red-team.spec.ts`. Each file is a JSON document with
shape:

```json
{
  "id": "string",
  "text": "string — the input the pipeline sees",
  "expected_detectors": ["pii", "injection", "crisis", "age"],
  "expected_verdict": "block" | "review",
  "ageBand": "k_2" | "3_5" | "6_8" | "9_12" | null,
  "notes": "optional"
}
```

Negatives use `expected_verdict: "allow"` and `expected_detectors: []`.

This is a **starter set** (~20 positives + ~20 negatives) curated by
hand to cover each detector branch. Expansion to ~500 positives and
~500 negatives sourced from the existing internal red-team backlog
(speech-buddy regression suite + Lakera Gandalf public set + AIVO
moderation queue triage) is tracked as a follow-up.

The thresholds the test enforces against the starter set are:

  - ≥ 99% block rate on positives (≤1 false negative per 100)
  - ≤  1% false-positive rate on negatives

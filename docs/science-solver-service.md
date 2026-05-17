# Science Solver Service

The science solver structures learner science responses around the
reasoning type the activity targets: observation, inference, classification,
sequencing, hypothesis, cause-and-effect. It returns structured strengths,
missing elements, misconception candidates, and a next hint the tutor can
use without exposing learner free-form text to analytics.

## API

```
POST /api/science-solver/analyze
```

Request:

```ts
{
  learnerId: string;
  problemSessionId?: string;
  topic?: string;
  prompt: string;
  response: string | Record<string, unknown>;
  surfaceSnapshot?: Record<string, unknown>;
  expectedReasoningType?: "classification" | "sequence" | "hypothesis" | "observation" | "cause_effect";
}
```

Response:

```ts
{
  reasoningType: string;
  observedStrengths: string[];
  missingElements: string[];
  misconceptionCandidates: string[];
  nextHint: string;
  confidence: number;
}
```

## Reasoning Modes

- **Classification** — compares learner grouping with expected grouping,
  checks the rule explanation.
- **Sequence** — checks order, missing steps, and out-of-place steps.
- **Hypothesis** — looks for if/then structure and a reason.
- **Observation** — separates observation language from inference language.
- **Cause/effect** — looks for cause-effect connective language.

## Integration

When the recognizer feature flag is enabled, tutor-svc and learning-svc
call this service on science surface responses. The summarized analyzer
output flows into tutor feedback and into the problem-session ledger.
Raw free-form learner text is **not** carried into analytics payloads.

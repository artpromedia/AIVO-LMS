# Math Recognizer Service

The math recognizer interprets learner work — scratchpad strokes, typed
expressions, geometry context, and surface snapshots — and returns
structured feedback the tutor can act on. The service ships a deterministic
**rule-based** recognizer first, behind a `MathRecognizerProvider`
interface that ML providers can replace later.

## API

```
POST /api/math-recognizer/recognize
```

Request shape:

```ts
{
  learnerId: string;
  problemSessionId?: string;
  subject: "math";
  skillCode?: string;
  prompt?: string;
  expectedAnswer?: string | number;
  finalAnswer?: string | number;
  strokes?: InkStroke[];
  surfaceSnapshot?: Record<string, unknown>;
  typedWork?: string;
  geometryContext?: Record<string, unknown>;
}
```

Response:

```ts
{
  recognizedExpression?: string;
  recognizedSteps: Array<{
    id: string;
    type: "formula" | "calculation" | "diagram_annotation" | "answer";
    value: string;
    confidence: number;
  }>;
  misconceptions: Array<{ id: string; label: string; evidence: string }>;
  feedbackHint?: string;
  correctness?: boolean;
  confidence: number;
}
```

## Rule-Based Recognition

The default `RuleBasedMathRecognizer` detects:

- area formula patterns: `l*w`, `length x width`, repeated addition;
- perimeter-vs-area misconception;
- radius-vs-diameter confusion;
- missing unit on area answers;
- arithmetic mismatch between shown work and final answer;
- blank scratchpad with a submitted final answer.

The math expression parser normalizes `8 × 4`, `8 x 4`, and `8 * 4` to the
same canonical form and detects squared units (`cm^2`, `square cm`, etc).

## Provider Interface

```ts
export interface MathRecognizerProvider {
  recognize(input: RecognizeInput): Promise<RecognizeOutput>;
}
```

A future ML provider can be injected via `buildApp({ provider })` without
changing route or schema code.

## Integration

When `advancedContentGenerators` (or `tutorSurfaceProtocol`) is enabled,
tutor-svc and learning-svc call this service on surface response submit.
The summarized output is appended to the problem-session ledger but raw
work is **not** copied into analytics; raw work lives in
`problem_session_surface_snapshots`.

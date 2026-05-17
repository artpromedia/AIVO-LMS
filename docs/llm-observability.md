# LLM Observability

`@aivo/observability` provides safe trace helpers for LLM and learning
flows. Every helper passes its payload through `redactForLogging` before
emitting, so raw IEP / parent / medical / OCR / free-form learner text
never leaks into traces.

## Learning Traces

```ts
type LearningTraceEvent =
  | "lesson_generation_started"
  | "lesson_generation_completed"
  | "homework_adaptation_started"
  | "homework_adaptation_completed"
  | "profile_recommendation_generated"
  | "surface_command_rejected"
  | "responsible_ai_violation_detected"
  | "problem_session_completed";
```

`buildLearningTrace(event, payload, meta)` returns a `LearningTrace`
with `event`, `occurredAt`, optional `tenantId` / `learnerId` /
`correlationId` / `durationMs`, and the redacted payload.

## LLM Traces

`buildLlmTrace({ model, provider, promptTokens, completionTokens,
totalTokens, latencyMs, cached, outcome, correlationId })` returns
a structured trace. `outcome` is the only place a caller can pass
arbitrary structured data; it is automatically redacted.

## Safe Logger

`redactForLogging(payload)` walks the payload recursively and:

- replaces values for `iepText`, `rawIepText`, `parentPrivateNotes`,
  `parentNotes`, `medicalNotes`, `medicalDiagnosis`, `freeFormChat`,
  `learnerChat`, `ocrText`, `uploadedOcrText`, `rawText`, `password`,
  `token`, `secret`, `apiKey` with `"[redacted]"`.
- truncates long string values at 240 characters with a trailing `…`.

`buildSafeLogEntry(level, message, payload)` wraps it for direct use
inside logger calls.

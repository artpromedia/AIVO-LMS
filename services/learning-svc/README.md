# @aivo/learning-svc

Backend service that owns the lesson-session lifecycle: it creates
sessions, calls the content generator, persists generated content, and
records gradebook + learning-path updates.

## Observability & guardrails (Sprint 0)

The session-create flow depends on several downstream services. To
prevent silent fabrication of learner-facing content when one of them
is unavailable, every cross-service call is wrapped in a structured
guardrail (see [`src/lib/downstream.ts`](src/lib/downstream.ts)).

### Downstream services tracked

| Subsystem              | Env var                      | Severity | Behaviour on failure                                       |
| ---------------------- | ---------------------------- | -------- | ---------------------------------------------------------- |
| `brain-svc`            | `BRAIN_SVC_URL`              | critical | Fail-closed by default (HTTP 503 `DegradedResponse`).      |
| `subject-brain-svc`    | `SUBJECT_BRAIN_SVC_URL`      | soft     | Logged + counted; lesson proceeds with degraded flag.      |
| `responsible-ai-svc`   | `RESPONSIBLE_AI_SVC_URL`     | soft     | Logged + counted; lesson proceeds with degraded flag.      |
| `problem-session-svc`  | `PROBLEM_SESSION_SVC_URL`    | soft     | Fire-and-forget; logged + counted, never blocks the flow.  |

Each failure:

1. Emits a structured `pino` log on the `learning-svc:downstream`
   logger with `{ service, endpoint, statusCode, correlationId,
   learnerId, err }`.
2. Increments the Prometheus counter
   `learning_svc_downstream_failures_total{service,endpoint}` exposed
   on `/metrics`.
3. Reports the affected subsystem name on the request's
   `DegradationTracker` so the route surfaces a typed
   `DegradedResponse` to the caller.

### `DegradedResponse`

```ts
interface DegradedResponse {
  degraded: true;
  degradedSubsystems: Array<
    | "brain-svc"
    | "subject-brain-svc"
    | "responsible-ai-svc"
    | "problem-session-svc"
  >;
  error: string;
}
```

When the request can still be served, the successful body is augmented
with `degraded: true` and `degradedSubsystems: string[]` instead of
silently returning fabricated content.

### Feature flag: `LEARNING_SVC_FAIL_OPEN`

Controls whether the lesson flow continues with best-effort defaults
when the **critical** `brain-svc` subsystem is unavailable.

| Value            | Meaning                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `true`/`1`/`on`  | Fail open. Lesson is generated with empty brain context.                   |
| `false`/`0`/`off`| Fail closed. Route returns `503` `DegradedResponse`.                       |
| unset            | Defaults to `true` outside production, `false` in production.              |

Soft subsystems (`subject-brain-svc`, `responsible-ai-svc`,
`problem-session-svc`) are always logged + counted but never block.

### Metrics scrape

The service mounts `/metrics` via `@aivo/observability`.

```text
# HELP learning_svc_downstream_failures_total
learning_svc_downstream_failures_total{service="brain-svc",endpoint="GET /api/brain/:learnerId"} 3
learning_svc_downstream_failures_total{service="subject-brain-svc",endpoint="POST /api/subject-brain/context"} 1
```

### Feature flags for downstream calls

| Flag                                       | Default | Effect                                                |
| ------------------------------------------ | ------- | ----------------------------------------------------- |
| `AIVO_FEATURE_ADVANCED_CONTENT_GENERATORS` | `false` | Enables `subject-brain-svc` enrichment.               |
| `AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS`   | `false` | Enables `responsible-ai-svc` evaluation (warn mode).  |
| `AIVO_FEATURE_PROBLEM_SESSION_LEDGER`      | `false` | Enables fire-and-forget `problem-session-svc` write.  |

### Tests

```sh
pnpm --filter @aivo/learning-svc test
```

The degraded-path coverage lives in
[`src/routes/__tests__/sessions.degraded.test.ts`](src/routes/__tests__/sessions.degraded.test.ts).

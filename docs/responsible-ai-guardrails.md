# Responsible AI Guardrails

The `@aivo/responsible-ai-svc` evaluates AI tutor / generator / homework
output before it reaches a learner. It is **flag-gated**: with
`AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS=true`, the evaluator runs on
every lesson, homework, chat, baseline, and recommendation context. With
the flag off, the legacy path is unchanged but `@aivo/observability`
safe logging is still active.

## API

```
POST /api/responsible-ai/evaluate
GET  /api/responsible-ai/policy
```

Request:

```ts
{
  learnerId: string;
  tutorSku?: string;
  contextType: "lesson" | "homework" | "chat" | "baseline" | "recommendation";
  inputSummary: string;
  output: Record<string, unknown> | string;
  learnerProfileSummary?: {
    functioningLevel?: string;
    accommodations?: string[];
    speechAvailable?: boolean;
    requiredSurfaces?: string[];
    declaredFactsInBrain?: string[];
  };
  requiredSurfaces?: string[];
  policyMode: "warn" | "block";
}
```

Response:

```ts
{
  allowed: boolean;
  severity: "none" | "low" | "medium" | "high" | "critical";
  violations: Array<{ code: string; message: string; evidence?: string }>;
  recommendedAction: "allow" | "revise" | "block" | "escalate";
}
```

## Guardrails

| Code                              | What it catches                                                     |
| --------------------------------- | ------------------------------------------------------------------- |
| `prompt_injection_attempt`        | "ignore previous instructions", "jailbreak", "developer mode", etc. |
| `speech_required_for_non_verbal`  | Tutor asked a NON_VERBAL learner to speak.                          |
| `long_text_for_low_verbal`        | Output is too long for a LOW_VERBAL / PRE_SYMBOLIC learner.         |
| `hallucinated_profile_fact`       | Output claims a profile fact not present in Brain context.          |
| `final_answer_before_attempt`     | Homework helper led with a final answer.                            |
| `unsafe_medical_advice`           | Output appears to offer clinical or medical advice.                 |
| `age_inappropriate_content`       | Output contains age-inappropriate content.                          |
| `missing_required_surface_<type>` | Required surface (geometry, scratchpad, etc.) is missing.           |
| `raw_markup_injection`            | Raw HTML or SVG in output.                                          |

## Escalation Policy

- `critical` codes always set `allowed: false` and recommend `escalate`.
- `high` codes block in `block` mode and `revise` in `warn` mode.
- `medium` codes block in `block` mode and `revise` in `warn` mode.
- `low` always allows but recommends `revise`.

## Integration

When the flag is on:

- AI lesson output is evaluated before learning-svc returns it.
- Homework output is evaluated before tutor-svc / homework-svc returns it.
- Tutor chat output is evaluated before the web client displays it.
- Profile recommendations are evaluated before being shown to the parent.
- Evaluation outcome is written to observability traces and audit
  summaries.

# AI safety contract (Sprint 14)

This document is the source of truth for AI input classification,
prompt-injection defense, output policy validation, model/provider
abstraction, cost controls, eval harness, and the admin review queue.

Authoritative locations:

- `apps/web-v2/lib/ai/safety.ts` — deterministic classifier,
  sanitizer, tutor-response validator, lesson-plan validator,
  blocked-fallback generator
- `apps/web-v2/lib/ai/tutor.ts` — generation orchestrator (retry +
  schema validation + deterministic safety-net fallback)
- `services/responsible-ai-svc/src/services/*` — evaluator catalog
- `services/responsible-ai-svc/src/routes/*` — policy + evaluate
  endpoints
- `apps/web-v2/app/api/bff/safety/*` — public BFF surface
- `apps/web-v2/app/api/bff/admin/safety/*` — admin BFF surface
- `apps/web-v2/app/admin/platform/safety/{moderation,policies,red-team,review-queue}`
  — admin UI
- `scripts/ai-safety-audit.mjs` (root script `ai-safety:audit`)

## Provider guard

`apps/web-v2/lib/env.ts` (Sprint 03 hardening) refuses
`AI_PROVIDER=mock` in production with a boot-time error. The
deterministic provider remains available in dev/test only. The
audit script asserts that guard is still in place.

## Pipeline

```
learner / parent / teacher input
    ↓
sanitizeHomeworkInput(raw) / classify(text, ctx)
    ↓     ↓
    │     └── prompt-injection / self-harm / violence / hate / sexual /
    │         PII / IEP leakage signals — block or escalate per policy
    ↓
provider.generate(input)        ← Anthropic / OpenAI / Google
    ↓
GeneratedLessonPlanSchema.safeParse
    ↓ (retry on miss)
validateLessonPlan(plan, ctx)   ← lib/ai/safety.ts
    ↓
validateTutorResponse(text)     ← lib/ai/safety.ts
    ↓
deliver
```

A safety block at any stage returns `blockedFallbackFor(category)`
rather than passing user-visible content from the model. The fallback
plan still satisfies `GeneratedLessonPlanSchema`.

## Evaluator catalog (responsible-ai-svc)

| Evaluator                       | Concern                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `prompt-injection-detector`     | adversarial prompts in learner / homework input                                      |
| `age-appropriateness-evaluator` | grade-band fit                                                                       |
| `homework-integrity-evaluator`  | no final answer before learner attempt                                               |
| `profile-adherence-evaluator`   | output respects the brain profile + accommodations                                   |
| `surface-requirement-evaluator` | rejects raw HTML/SVG; speech-required commands gated by profile (Sprint 07 contract) |
| `escalation-policy`             | self-harm / crisis → human review queue                                              |

Add a new evaluator by implementing the `EvaluateInput → ViolationReport[]`
shape in `services/responsible-ai-svc/src/services/types.ts` and
wiring it into `routes/evaluate.ts`.

## Hard rules

- **Homework Helper**: MUST NOT begin a response with "The answer
  is", "Answer:", "=", or "x = …". The
  `evaluateHomeworkIntegrity` evaluator rejects these; the audit
  enforces the rule list stays in the evaluator.
- **Learner-facing surfaces**: no diagnostic labels (e.g. autism,
  ADHD, dyslexia) — Sprint 04 teacher-safety contract extends to AI
  outputs.
- **Teacher recommendations**: may suggest content / pacing /
  accommodations to try, but MUST NOT mutate Brain state directly —
  parent approval flow is the only authority (Sprint 06 brain
  profile review contract).
- **Medical / legal claims**: model output is rejected when it
  contains "diagnose", "diagnosis of X", legal advice patterns;
  classifier rule lives in `lib/ai/safety.ts`.

## Cost controls

| Budget              | Owner                                       |
| ------------------- | ------------------------------------------- |
| Per-tenant monthly  | admin-svc                                   |
| Per-learner monthly | family-svc (deducts from family plan share) |
| Per-feature daily   | feature flags (`feature-flags` package)     |
| Per-request timeout | provider abstraction (configurable)         |

Reusable lesson scaffolds are cached by `(tutorPersona, skillId,
gradeBand, accommodationProfileHash)` so a parent who regenerates
a plan with the same context hits the cache.

The admin AI dashboard lives at
`apps/web-v2/app/admin/platform/safety/moderation` for safety and at
the AI generation/cost dashboard for cost; both consume
`/api/bff/admin/ai-generation` and `/api/bff/admin/safety/events`.

## Human review queue

- `apps/web-v2/app/admin/platform/safety/review-queue` — admin UI
- `apps/web-v2/app/api/bff/admin/safety/review-cases/*` — BFF
- Cases are opened automatically by `escalation-policy` (self-harm
  signals, prompt injection attempts above threshold, content-block
  surges) and manually by parent / teacher report.
- Status: `open → triaged → resolved | escalated`.

## Audit script

`scripts/ai-safety-audit.mjs` (`ai-safety:audit`):

1. `apps/web-v2/lib/env.ts` still refuses `AI_PROVIDER=mock` in
   production (carries over the Sprint 03 guard).
2. `apps/web-v2/lib/ai/safety.ts` exports `classify`,
   `sanitizeHomeworkInput`, `validateTutorResponse`,
   `validateLessonPlan`, `blockedFallbackFor`,
   `DEFAULT_SAFETY_POLICY`.
3. `services/responsible-ai-svc/src/services/` contains every
   evaluator listed in the contract table.
4. The homework-integrity evaluator still rejects the
   "answer-up-front" patterns (regression check on the rule list).
5. Public safety BFF routes exist: `classify`,
   `validate-homework-input`, `validate-lesson`.
6. Admin safety BFF routes exist: `events`, `review-cases`.

## Verification

```bash
pnpm ai-safety:audit
pnpm --filter @aivo/responsible-ai-svc test
pnpm test --filter @aivo/web-v2 -- lib/ai
```

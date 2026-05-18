# Baseline Assessment Surface Contract

The baseline (Discovery) assessment generates personalised activities
that render through `@aivo/learner-surfaces`. This document describes
the wire schema between `ai-svc`, `assessment-svc`, and the web
client.

## Discovery activity schema

```ts
type ActivityInteraction =
  | "choice_grid"
  | "tap_image"
  | "tap_word"
  | "drag_sort"
  | "drag_place"
  | "sequence"
  | "pattern_fill"
  | "memory"
  | "memory_sequence"
  | "observation"
  | "emotion_pick"
  | "draw"
  | "scratchpad"
  | "geometry_workspace"
  | "math_expression"
  | "voice_response"
  | "reading_annotation"
  | "science_diagram";

interface DiscoveryActivity {
  id: string;
  domain: string;
  skillCode?: string;
  standardCode?: string;
  difficulty: "easy" | "medium" | "hard" | "adaptive";
  estimatedDifficulty?: number;
  interaction: ActivityInteraction;
  prompt: string;
  tutorLine?: string;
  feedbackMode?: FeedbackMode;
  brainMeasures?: string[];
  scoring?: {
    mode: "exact" | "rubric" | "process" | "hybrid";
    correctAnswer?: string | number | boolean;
  };
  surface?: LearnerSurfaceSpec;
  choices?: ChoiceOption[];
}
```

## Feedback modes

- `immediate_supportive` — show correctness right away with warm copy.
- `delayed_after_item` — show correctness after the item is submitted.
- `delayed_after_block` — defer until block end.
- `no_correctness_feedback_diagnostic` — never reveal correctness;
  client returns the neutral acknowledgement
  _"Thanks, I learned how you solve that."_

## Scoring modes

- `exact` — local exact-match scoring.
- `rubric` — server scores against a rubric.
- `process` — server scores process traces, no exact correct answer.
- `hybrid` — local exact comparison plus process telemetry sent to the
  server.

## Required fields

`id`, `domain`, `difficulty`, `interaction`, `prompt`, `feedbackMode`,
`brainMeasures`, `scoring`. Surface-required interactions
(`draw`, `scratchpad`, `geometry_workspace`, `math_expression`,
`reading_annotation`, `science_diagram`) must include a `surface`
spec with non-empty `accessibility.altText`. Geometry surfaces must
have at least one shape. Draw and scratchpad surfaces must enable
`capture.inkStrokes`.

## Rejection rules

Server-side rejection (assessment-svc + ai-svc) and client-side
rejection (web `activity-schema.ts`) all share the same rule list.
Rejected items appear in the response under `rejectedActivities`.

## Fallback behavior

When AI generation fails the assessment service returns a 502 if
_every_ item is invalid. Otherwise it returns the partial set of
valid items with `personalizationLevel: "partial"`. The client
attempts a single retry before falling back to the bundled warm-up
activities. Fallback is always labeled as such in the
`GenerationStatusBanner` and never silently swapped in for a
personalised generation that was expected.

## Completion payload

```json
{
  "chapterResults": [...],
  "totalCorrect": 4,
  "totalAttempts": 5,
  "xpEarned": 50,
  "responseLatencies": [1234, 2345],
  "surfaceSignals": [
    {
      "activityId": "math_geometry_area_rectangle_01",
      "domain": "math",
      "interaction": "geometry_workspace",
      "finalAnswer": 32,
      "correct": true,
      "inkStrokeCount": 5,
      "erasureCount": 1,
      "scratchpadUsed": true,
      "latencyMs": 12530
    }
  ]
}
```

# Tutor Surface Protocol

The tutor surface protocol is the structured contract between the AI tutor
and the learner runtime. When the tutor decides that a learner would benefit
from a visual, diagram, scratchpad, graph, number line, annotation,
manipulative, or science diagram, it returns a list of `TutorSurfaceCommand`
objects instead of raw HTML or SVG. Each command is rendered by the
existing learner-surfaces runtime and persisted to the problem-session
ledger when enabled.

## Why a Protocol

Free-form HTML/SVG injected by an LLM has three failure modes:

1. **Accessibility regression** — alt text, keyboard alternatives, and
   reduced-motion modes get dropped silently.
2. **Profile incompatibility** — speech-required prompts reach NON_VERBAL
   learners; long typed responses reach LOW_VERBAL learners.
3. **Security** — raw HTML/SVG can carry injected scripts.

The protocol forces the tutor to declare _intent_ (open*scratchpad,
show_geometry, ...) and lets the validated client decide \_how* to render it
using `@aivo/learner-surfaces`.

## Command Types

```ts
type TutorSurfaceCommandType =
  | "open_scratchpad"
  | "show_geometry"
  | "show_graph"
  | "show_number_line"
  | "show_manipulative"
  | "show_reading_annotation"
  | "show_science_diagram"
  | "collect_answer"
  | "collect_drawing"
  | "highlight_object"
  | "update_label"
  | "save_snapshot";
```

Each command includes:

- `id` — stable command identifier (validators flag duplicates in batches).
- `commandType` — one of the supported types above.
- `surfaceId` — the target surface id.
- `reason` — why this surface is being shown.
- `expectedLearnerAction` — optional, e.g. `show_work`, `find_area`.
- `profileAdaptationRationale` — optional, e.g. "low-verbal learner needs
  diagram support".
- `surface` — `LearnerSurfaceSpec` (required for show*/open*/collect_drawing
  commands).
- `commandPayload` — optional command-specific payload.

## Validator Rules

`validateTutorSurfaceCommand` rejects:

- Missing command id, surface id, or reason.
- Unsupported `commandType` or `surface.type`.
- Geometry surface without shapes.
- Scratchpad command without ink capture.
- Missing `accessibility.altText`.
- Surface without `keyboardAlternative`.
- Raw HTML, SVG, or script in any free-text field.
- `collect_answer` for `NON_VERBAL` learner without `speechAvailable: true`.
- Long typed response for `LOW_VERBAL` or `PRE_SYMBOLIC` learners.

## Subject Rules (Tutor System Prompt)

The AI tutor system prompt embeds a `Surface Tool Protocol` block:

```text
When a learner would benefit from a visual, diagram, scratchpad, graph,
number line, annotation, manipulative, or science diagram, return structured
surface commands. Use structured JSON only. Never return raw HTML or raw
SVG. Always include accessibility alt text and a keyboard alternative.
Choose surfaces based on subject, task, functioning level, accommodations,
and learner process profile.

Subject rules:
- Geometry requires geometry_workspace.
- Computation requiring work requires scratchpad.
- Fractions may use number_line, area_model, manipulative, or scratchpad.
- Science systems may use science_diagram or classification manipulatives.
- Reading comprehension may use reading_annotation.
- Coding may use trace table or step workspace.
```

## Rendering Pipeline

1. Tutor returns commands as JSON.
2. Web `TutorSurfaceCommandRenderer` runs `validateTutorSurfaceCommand`.
3. Valid commands are normalized to `LearnerSurfaceSpec` and passed to
   `SurfaceHost` from `@aivo/learner-surfaces`.
4. Invalid commands are dropped with safe telemetry (no raw payload, no
   sensitive learner data) — the tutor's text response continues to render.
5. When the problem-session ledger is enabled, the renderer appends
   `surface_rendered`, `surface_snapshot_saved`, and `answer_attempted`
   events on the active session.

## Problem-Session Ledger Integration

When `AIVO_FEATURE_PROBLEM_SESSION_LEDGER` and
`AIVO_FEATURE_TUTOR_SURFACE_PROTOCOL` are both on:

- Surface render emits `surface_rendered`.
- Snapshot submit emits `surface_snapshot_saved`.
- Final answer emits `answer_attempted`.
- Aggregated stroke counts emit `scratchpad_stroke_added` /
  `scratchpad_erased` (not one event per pointer event in high-volume mode).

The renderer never emits raw stroke arrays into analytics payloads — only
counts, latency, and the redacted summary. Raw work lives in
`problem_session_surface_snapshots`.

# 0002 — SurfaceRouter must route every authored item-bank surface type

- **Status:** Accepted
- **Date:** 2026-05-25
- **Related:** Sprint 1 — Unblock lesson rendering

## Context

`packages/item-bank/src/schema.ts` (`ItemSurfaceType`) declares 11
authored surface types: `multiple_choice`, `short_response`,
`fill_in_blank`, `drag_drop`, `geometry`, `math_expression`,
`coding_sandbox`, `art_canvas`, `voice_response`, `ink_canvas`,
`scratchpad`.

The lesson player (`apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx`)
renders items through the exported `SurfaceRouter`
(`packages/learner-surfaces/src/SurfaceRouter/SurfaceRouter.tsx`).
Before this ADR, that router's `SurfaceRouterItem["surfaceType"]` union
covered only five runtime aliases (`choice_grid`, `math_expression`,
`scratchpad`, `geometry_workspace`, `number_line`). Every other authored
surface type fell through the router's `switch` and rendered nothing —
no markup, no telemetry, no error — silently breaking lesson delivery
for the majority of fixture items in `packages/item-bank/fixtures/k2-baseline/bank.json`.

Meanwhile, `SurfaceHost` (the spec-based dispatcher) carried its own
hardcoded `supportedTypes` Set that named nine runtime types. The two
dispatchers had no shared source of truth, so any future surface type
required edits in three places (item-bank schema, router switch, host
set) with no compile-time link between them.

## Decision

We introduce a single mapping module —
`packages/learner-surfaces/src/SurfaceRouter/surface-type-map.ts` —
that owns:

1. `ITEM_TYPE_TO_RUNTIME`: the canonical map from authored
   `ItemSurfaceType` values onto runtime `LearnerSurfaceType` values.
2. `SUPPORTED_RUNTIME_TYPES`: the set of runtime surface types the host
   knows how to render.
3. `toRuntimeSurfaceType()`: the normalisation helper both dispatchers
   call.

`SurfaceRouter` now accepts both authored and runtime surface types as
input, normalises via the map, and dispatches to every concrete surface
component (`ChoiceGridSurface`, `MathExpressionSurface`,
`ScratchpadSurface`, `GeometrySurface`, `NumberLineSurface`,
`CodingSandboxSurface`, `ArtCanvasSurface`, `VoiceResponseSurface`).
`SurfaceHost` imports `SUPPORTED_RUNTIME_TYPES` directly instead of
maintaining its own list.

A new table-driven test
(`packages/learner-surfaces/src/SurfaceRouter/__tests__/SurfaceRouter.routing.test.tsx`)
asserts that every authored surface type produces non-empty markup and
that the runtime/authored maps stay in sync.

## Consequences

- **Positive:**
  - Every fixture item now reaches a real surface; the silent
    "unsupported" path is gone.
  - Adding a new surface type is a three-line edit in one file
    (schema enum + map entry + router case) and the test will catch
    drift.
  - `SurfaceHost` and `SurfaceRouter` cannot disagree about what is
    "supported".
- **Negative:**
  - `SurfaceRouterItem.surfaceType` is now a wider union, so call sites
    that switched exhaustively on the old five types will need an
    update — currently only the lesson player and the fixture page,
    both updated in this sprint.
  - `short_response` and `fill_in_blank` both reuse
    `MathExpressionSurface` as a generic single-line text input. That
    is acceptable for K-8 short answers; if richer rendering is needed
    later (e.g. cloze with multiple blanks) we will add a dedicated
    surface.
- **Neutral / follow-ups:**
  - `drag_drop` currently degrades to a choice grid pending a real
    drag-and-drop surface (tracked separately).
  - The legacy UTF-16-encoded `packages/learner-surfaces/src/SurfaceRouter.tsx`
    (used internally by `SurfaceHost`) is left untouched in this sprint
    because it is already in sync; a follow-up will re-encode it as
    UTF-8 to match repo convention.

## Alternatives Considered

- **Extend the router switch in place without a shared map.** Rejected:
  leaves `SurfaceHost` and `SurfaceRouter` free to drift again.
- **Move dispatch into each surface component (registry pattern).**
  Rejected for this sprint: would require all 8 surfaces to publish a
  static descriptor and a refactor of every test. The shared-map
  approach is the smallest change that closes the gap.

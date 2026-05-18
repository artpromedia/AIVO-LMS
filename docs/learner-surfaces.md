# Learner Surfaces

`@aivo/learner-surfaces` is the reusable React package that powers
high-quality K-12 interactive learning experiences. A "surface" is a
render contract for a single learner activity — geometry workspace,
scratchpad, math expression, choice grid, etc. — together with the
metadata needed to score the response, capture process telemetry, and
expose accessible alternatives.

## SurfaceHost contract

```ts
import { SurfaceHost } from "@aivo/learner-surfaces";

<SurfaceHost
  surface={surfaceSpec}
  disabled={false}
  onSubmit={(response) => {/* { surfaceId, answer?, selectedChoiceId?, inkStrokes? } */}}
  onEvent={(event) => {/* SurfaceTelemetryEvent */}}
/>;
```

`SurfaceHost` routes by `surface.type`. Unsupported types render a
fallback section that emits an `unsupported_surface` telemetry event
and never throws.

## Surface types

| `LearnerSurfaceType` | Component               |
| -------------------- | ----------------------- |
| `choice_grid`        | `ChoiceGridSurface`     |
| `scratchpad`         | `ScratchpadSurface`     |
| `geometry_workspace` | `GeometrySurface`       |
| `math_expression`    | `MathExpressionSurface` |

Other types (`number_line`, `graph`, `drag_manipulative`,
`reading_annotation`, `science_diagram`, `voice_response`,
`multi_step_workspace`) are reserved in the type system and render the
fallback until a dedicated component lands.

## Geometry workspace

Geometry surfaces render a deterministic SVG diagram via
`renderGeometrySvg`. Shapes supported: `triangle`, `rectangle`,
`circle`, `polygon`, `segment`, `ray`, `angle`. Backgrounds:
`grid`, `cartesian`. Labels and measurement annotations are placed by
explicit coordinates — never by free SVG strings — so AI-generated
content can never inject arbitrary markup.

## Scratchpad

Vector ink capture (`InkStroke[]`) is the source of truth. Pointer
Events drive `pencil`, `highlighter`, and `eraser` tools. `undo` and
`clear` ship in the toolbar; both emit telemetry.

## Accessibility rules

Every surface must include:

- `accessibility.altText` — non-empty short text alternative
- `accessibility.reduceMotionSafe`
- `accessibility.keyboardAlternative`
- `accessibility.screenReaderSummary` (recommended for diagrams)

Diagrams render as `<svg role="img">` with `<title>` and `<desc>`.
Toolbar buttons and choice buttons are reachable by keyboard and have
explicit aria labels. Submit buttons are disabled only when the
required input is missing.

## Telemetry events

`SurfaceTelemetryEvent` types: `surface_started`, `surface_submitted`,
`ink_started`, `ink_completed`, `ink_undo`, `ink_clear`,
`answer_changed`, `tool_changed`, `unsupported_surface`. Each event
carries `id`, `surfaceId`, `type`, `occurredAt`, and an optional
payload.

## Examples

A geometry workspace where the learner computes the area of an 8×4
rectangle is the canonical seed example — see
`docs/baseline-assessment-surface-contract.md` for the full JSON.

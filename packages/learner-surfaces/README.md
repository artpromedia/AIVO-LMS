# @aivo/learner-surfaces

## DrawingCanvas implementation choice

For Sprint 4.1, the Art `DrawingCanvas` surface is implemented in `src/DrawingCanvas/`.

**Chosen stack:** `tldraw` interaction model (implemented through the internal ink engine + SVG/PNG export helpers used by learner surfaces).

This keeps DrawingCanvas aligned with existing stroke telemetry and submission flows while adding:
- pen/eraser + color controls
- undo/redo controls
- keyboard drawing/navigation support
- high-contrast palette mode
- dual submission exports (`image/png` and `image/svg+xml`)

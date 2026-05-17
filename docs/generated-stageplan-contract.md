# Generated StagePlan Contract

`learning-svc` returns generated lessons as `StagePlan` objects. The
web client normalises the payload via
`apps/web/src/components/stage/stageplan-normalizer.ts` before
loading it into `useSessionFlow`.

## StagePlan schema

```ts
interface StagePlan {
  id: string;
  title: string;
  objective: string;
  subject: string;
  topic: string;
  gradeTarget?: string;
  deliveryLevel?: string;
  functioningLevel?: string;
  beats: Beat[];
  surfaces: Record<string, LearnerSurfaceSpec>;
  masteryTargets: string[];
  accommodationsApplied: string[];
  safetyChecks: string[];
}
```

## Beat schema

A beat may either inline `surface` or reference `surfaceId` against
the StagePlan-level `surfaces` dictionary. Beat `type`s:
`narration`, `demonstration`, `interaction`, `reflection`,
`celebration`.

## Validation rules

`validateStagePlan` in `services/learning-svc/src/services/stageplan-validator.ts`
rejects plans that:

- have duplicate beat or surface IDs
- reference a `surfaceId` that does not exist in the surfaces map
- include geometry surfaces with zero shapes
- include scratchpad surfaces without `capture.inkStrokes`
- include narration containing raw HTML / `<script>` tags
- have over-long narration for `LOW_VERBAL`/`NON_VERBAL`/`PRE_SYMBOLIC`
  functioning levels

When validation fails, the lesson session route returns a 422 with a
quality-gate log. The web client renders a recoverable error and
allows retry.

## Lesson fallback rules

Demo beats remain in the lesson page only as a development-time
fallback (`?demo=1` or `NODE_ENV !== "production"`). Production
lessons must use generated content.

## Example geometry lesson

```jsonc
{
  "id": "lesson-geometry-area-rectangle",
  "title": "Geometry: Area of a Rectangle",
  "objective": "Compute the area of a rectangle given side lengths.",
  "subject": "math",
  "topic": "area_rectangle",
  "beats": [
    { "id": "open", "type": "narration", "narration": "Today we explore area." },
    { "id": "demo", "type": "demonstration", "narration": "Watch how length × width gives the area." },
    { "id": "task", "type": "interaction", "surfaceId": "surf-geo-1" },
    { "id": "celebrate", "type": "celebration" }
  ],
  "surfaces": {
    "surf-geo-1": {
      "id": "surf-geo-1",
      "type": "geometry_workspace",
      "prompt": "Find the area of the rectangle.",
      "diagram": { "canvasMode": "svg", "shapes": [{ "id": "r1", "kind": "rectangle", "x": 100, "y": 80, "width": 320, "height": 180 }] },
      "scratchpad": { "enabled": true },
      "capture": { "finalAnswer": true, "inkStrokes": true },
      "scoring": { "mode": "exact", "correctAnswer": 32 },
      "accessibility": { "altText": "Rectangle 8×4", "reduceMotionSafe": true, "keyboardAlternative": true }
    }
  },
  "masteryTargets": [],
  "accommodationsApplied": [],
  "safetyChecks": []
}
```

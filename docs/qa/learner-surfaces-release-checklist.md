# Learner Surfaces — Release Checklist

Before promoting an interactive baseline / generated lesson build to
production:

## Functionality

- [ ] Personalised baseline generation succeeds for a learner with a
      completed parent assessment (no fallback banner shown).
- [ ] Geometry surface renders an SVG rectangle with side labels.
- [ ] Scratchpad records pointer strokes (mouse, touch, stylus).
- [ ] Submitted scratchpad responses retain their strokes in the
      completion payload.
- [ ] Geometry activity exposes a final-answer numeric input with unit.
- [ ] Choice grid still works end-to-end (regression).

## Accessibility

- [ ] Geometry SVG has accessible name (`role="img"`, `<title>`,
      `<desc>`).
- [ ] Scratchpad toolbar buttons have aria labels.
- [ ] Submit button is reachable and operable via keyboard.
- [ ] Reduced-motion mode does not break the surface flow.
- [ ] Screen-reader summary announces a geometry diagram.
- [ ] No critical axe-core violations on a learner activity page.

## Functioning levels

- [ ] LOW_VERBAL learners see shorter prompts and fewer choices.
- [ ] NON_VERBAL / PRE_SYMBOLIC paths surface picture-first or
      touch-first interactions.

## Fallback transparency

- [ ] Single retry occurs before fallback when AI generation fails.
- [ ] Fallback banner is visible and labels the experience as
      *warm-up*, not personalised.
- [ ] Fallback reason is logged to the dev console.
- [ ] Learner must take an explicit action to continue with the
      fallback warm-up.

## Generated lessons

- [ ] Production learner lesson uses the generated StagePlan, not
      `generateDemoBeats`.
- [ ] Beats with `surfaceId` resolve correctly against the StagePlan
      surfaces dictionary.
- [ ] Quality-gate failures return 422 with a recoverable error.

## Tests

- [ ] `pnpm --filter @aivo/learner-surfaces test`
- [ ] `pnpm --filter @aivo/web test`
- [ ] `pnpm --filter @aivo/assessment-svc test`
- [ ] `pnpm --filter @aivo/learning-svc test`
- [ ] Python ai-svc tests cover `surface_schema` validation.

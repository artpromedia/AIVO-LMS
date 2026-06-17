# Migration guide

1. Import `@aivo/brand/tokens.css` at app entry.
2. Set the Inclusive-Warm root attributes on the `<html>` element: `data-sensory-mode`
   (`standard|calm|high-contrast`) and `data-brand="inclusive-warm"` (use
   `getInclusiveWarmDataset()` from `@aivo/brand`). Optional `data-dyslexia-font="on"`.
3. Replace raw color values with Inclusive-Warm tokens — `iw-*` Tailwind utilities
   (`bg-iw-primary`, `text-iw-ink`, `text-iw-ink-muted`; universal status
   `text-iw-{success,warning,error,info}` with `-subtle` chip backgrounds and `-strong`
   accessible chip text — the canonical name is `iw-error`, **not** `iw-danger`) and the
   domain status tokens (`iw-{consent,billing,risk,mastery,safety,completion}-*`), or the
   `--aivo-*` CSS variables directly.
4. Move screens onto the shared learner-ui primitives/patterns.
5. Validate reduced motion and focus behavior across all three sensory modes.
6. Capture before/after snapshots in `screenshots/design-language/`.

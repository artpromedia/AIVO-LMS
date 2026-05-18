# Migration guide

1. Import `@aivo/brand/tokens.css` at app entry.
2. Set `data-theme` (`light|dark|high-contrast`) and `data-age-mode` (`sprout|spark|scholar`) on the root element.
3. Replace raw color values with token variables.
4. Move screens to learner-ui Playful Calm primitives/patterns.
5. Validate reduced motion and focus behavior.
6. Capture before/after snapshots in `screenshots/design-language/`.

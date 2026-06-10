# Aivo Playful Calm

**Aivo Playful Calm** is AIVO-LMS's market-ready design language: playful enough for kids, calm enough for daily learning.

It combines rounded geometry, warm guidance mascots, audio-first controls, and clear one-primary-action layouts.

## Included in this monorepo

- Layered design tokens in `packages/brand/tokens`
- Built token outputs in `packages/brand/dist`
- Mascot/logo/pattern assets in `packages/brand/assets`
- Refreshed learner primitives + patterns in `packages/learner-ui`
- Web-v2 integration with age mode + theme controls

See the companion docs in this folder for principles, components, motion, a11y, and migration.

## Current-design snapshots

- `screenshots/design-language/landing-after.png`
- `screenshots/design-language/login-after.png`
- `screenshots/design-language/learner-home-after.png`
- `screenshots/design-language/rewards-after.png`

> 2026-06-10: every snapshot in this folder (the four "before" captures and
> the four "after" captures) had been committed as the same blank white
> 1280×720 image — a capture bug, not real pixels. The blank set was removed;
> the "after" captures were regenerated from the live app. The pre-redesign
> "before" UI no longer exists anywhere in the repo, so that set cannot be
> recovered and the README no longer claims it. The Playwright visual suite
> (`apps/web-v2/e2e/visual-a11y.playwright.ts`) now refuses to record or
> compare a near-uniform screenshot, so blank captures cannot land again.

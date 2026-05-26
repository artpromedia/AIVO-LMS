# Manual screen-reader evidence

The axe-core sweep in `e2e/tests/sprint15/screen-reader.spec.ts` covers
automatable WCAG 2.2 AA criteria. Other criteria (meaningful sequence,
heading structure, focus order on dynamically inserted content, reading
order in two-column layouts) require **human verification** with a screen
reader. This document captures the manual test checklist QA fills in each
release.

## Test matrix

For every locale we ship (currently `en`, `es`), exercise the 12 critical
learner pages from
[`wcag-2.2-aa-evidence.md`](../wcag-2.2-aa-evidence.md) with the three
reference screen readers:

| Reader | Platform | Browser |
|--------|----------|---------|
| VoiceOver | macOS Sonoma + | Safari, Chrome |
| VoiceOver | iOS 17 + | Safari |
| NVDA | Windows 11 | Firefox, Chrome |
| JAWS | Windows 11 | Chrome, Edge |

## Per-page checklist (copy for each run)

```
Locale: ____
Reader/browser: ____
Tester: ____
Date: ____
Build SHA: ____

[ ] Page title is announced before any other content.
[ ] Skip-link reaches the main landmark on first activation.
[ ] Headings cascade in order (h1 → h2 → h3, no skipped levels).
[ ] All interactive elements have an accessible name.
[ ] Status changes (e.g. "Saved", "Recording…") fire on a live region.
[ ] Modal dialogs steal focus on open and return it on close.
[ ] Forms expose labels, errors, and required state.
[ ] AAC tiles announce the symbol label and grid position.
[ ] Lesson player video has captions; toggle is reachable.
[ ] No reading-order surprise when reduced-motion is on.
[ ] Text scales to 200% without horizontal scroll.
[ ] Contrast holds in high-contrast mode and dyslexia-font mode.
```

## Latest results — Sprint 15

> _Manual results are intentionally blank — fill in during QA's a11y sweep
> for the Sprint 15 release._

| Locale | Reader | Page | Status | Notes |
|--------|--------|------|--------|-------|
| en | VoiceOver / Safari | learner/home | | |
| en | VoiceOver / Safari | learner/lesson-player-smoke | | |
| en | VoiceOver / Safari | learner/baseline | | |
| en | VoiceOver / Safari | learner/aac | | |
| en | VoiceOver / Safari | learner/settings/accessibility | | |
| en | VoiceOver / Safari | learner/missions | | |
| en | VoiceOver / Safari | learner/homework | | |
| en | VoiceOver / Safari | learner/quests | | |
| en | VoiceOver / Safari | learner/progress | | |
| en | VoiceOver / Safari | parent/notifications | | |
| en | VoiceOver / Safari | learner/tutor | | |
| en | VoiceOver / Safari | learner/lesson-player-fixture | | |
| en | NVDA / Firefox | (repeat) | | |
| en | JAWS / Chrome | (repeat) | | |
| es | VoiceOver / Safari | (repeat) | | |
| es | NVDA / Firefox | (repeat) | | |
| es | JAWS / Chrome | (repeat) | | |

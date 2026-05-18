# Accessibility + VPAT readiness (Sprint 15)

This document tracks AIVO_LMS's readiness against WCAG 2.2 AA, the
inclusive learner supports the product depends on (TTS, AAC, sensory
modes), and the structural assertions the audit gate enforces.

Authoritative locations:

- `packages/aac-bridge` — AAC input methods (switch scan, dwell click,
  symbol boards, OBF/OBZ, PRC-Saltillo / Tobii / AssistiveWare
  adapters, CoughDrop sync, eye-gaze pipeline)
- `apps/web-v2/lib/tts/provider.ts` — TTS provider (mock dev,
  production adapter), content-hash cache key
- `apps/web-v2/lib/db/types.ts::AccessibilityPreferences` +
  `ACCESSIBILITY_DEFAULTS` — per-learner preference shape
- `apps/web-v2/app/api/bff/learners/[learnerId]/accessibility/*` —
  preference read / write / reset
- `apps/web-v2/app/api/bff/learners/[learnerId]/tts/*` — TTS
  generation + asset retrieval
- `docs/accessibility-guidelines.md` — engineering guidelines (Sprint
  baseline, predates 15; do not regress)
- `scripts/accessibility-audit.mjs` (`accessibility:audit`)

## Per-learner preferences

Defined in `AccessibilityPreferences`. Every preference is honored by
the lesson UI + generation layer when set:

| Preference             | Effect                                                           |
| ---------------------- | ---------------------------------------------------------------- |
| `reducedMotion`        | suppress non-essential animation; respect prefers-reduced-motion |
| `highContrast`         | swap to high-contrast color scheme                               |
| `largeText`            | upscale base font + line height                                  |
| `audioFirst`           | tutor speaks before the printed prompt                           |
| `captionsAlwaysOn`     | TTS audio always has visible captions                            |
| `hapticsEnabled`       | mobile haptic feedback on confirm / success                      |
| `readAloud`            | every text block gets a read-aloud button                        |
| `dyslexiaFriendlyFont` | swap to OpenDyslexic / Atkinson Hyperlegible                     |
| `shorterSteps`         | generator splits long steps into smaller ones                    |
| `extraHints`           | generator emits scaffold steps before the check                  |
| `visualSupports`       | add visual aids (number lines, picture cues)                     |
| `breakReminders`       | session pauses with break prompts every N minutes                |
| `keyboardOptimized`    | layout adapts for keyboard-first navigation                      |

Preferences are loaded per learner; the `learner` role reads its own,
`parent` reads any of its own learners, `teacher` reads only learners
covered by `teacher_access` consent.

## TTS

- Dev: `mockTTSProvider` returns deterministic audio for tests.
- Prod: `productionTTSAdapter` calls the configured provider; refused
  to be `mock` in production via `lib/env.ts` (Sprint 03).
- Cache key: `ttsContentHash({text, voice, speed, pronunciationOverrides})`.
- Pronunciation dictionary: per-learner overrides supported via the
  preference store.
- Privacy: cache keys are content-hashed, not learner-id-tagged, so
  cache reuse across learners is safe and learner identity does not
  appear in object-storage keys.
- TTS BFF is consent-gated by `child_data_collection` (Sprint 04).

## AAC

`packages/aac-bridge` exports:

| API                                                            | Purpose                                          |
| -------------------------------------------------------------- | ------------------------------------------------ |
| `useAACInput()`                                                | React hook — wraps SwitchScan / Dwell / Eye-Gaze |
| `SwitchScanController`                                         | one/two/three-switch scan loops                  |
| `parseOBF` / `parseOBZ` / `validateOBF` / `exportToOBF`        | open board format                                |
| `PRCSaltilloAdapter`, `TobiiAdapter`, `AssistiveWareAdapter`   | vendor adapters                                  |
| `detectAndCreateAdapter`, `listAvailableAdapters`              | factory                                          |
| `CoughDropSync`                                                | symbol-board sync                                |
| `CalibrationState`, `GazeTargetMapper`, `DwellClickController` | eye-gaze pipeline                                |

AAC mode is selected by `FunctioningLevel` (Pre-Symbolic →
observational; Non-Verbal → switch scan; Low Verbal → picture-based)
from `packages/brand::FUNCTIONING_LEVELS`. Sprint 07 baseline player
honors this; Sprint 15 ensures the same for LessonRun.

## WCAG 2.2 AA conformance

| Principle      | Coverage                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Perceivable    | alt text, decorative `aria-hidden`, contrast ≥ 4.5:1 body / 3:1 large, `role="progressbar"`          |
| Operable       | keyboard accessible, logical focus order, `<SkipLink>`, no traps, `prefers-reduced-motion` respected |
| Understandable | visible labels or `aria-label`, `role="alert"` errors, `role="status"` notices, `autoComplete`       |
| Robust         | semantic HTML, ARIA only where native semantics don't suffice                                        |

WCAG 2.2 additions (over 2.1):

- 2.4.11 Focus Not Obscured (Minimum) — the role-aware app shells
  enforce sticky-header offsetting on focus
- 2.5.7 Dragging Movements — drag interactions in the AAC builder
  expose tap/keyboard alternates
- 2.5.8 Target Size (Minimum) — primary CTAs are ≥ 24×24 CSS px;
  `keyboardOptimized` upscales to ≥ 48×48
- 3.2.6 Consistent Help — `/parent/support` link in every role chrome
- 3.3.7 Redundant Entry — onboarding remembers prior answers
- 3.3.8 Accessible Authentication (Minimum) — WebAuthn + email
  password reset; no cognitive-only auth (Sprint 03)

## Audit script

`scripts/accessibility-audit.mjs` (`accessibility:audit`):

1. `AccessibilityPreferences` in `apps/web-v2/lib/db/types.ts`
   declares every field listed in the table above.
2. `ACCESSIBILITY_DEFAULTS` declares each preference with a default.
3. `apps/web-v2/lib/tts/provider.ts` exports `ttsContentHash`,
   `getTTSProvider`, `mockTTSProvider`, `productionTTSAdapter`.
4. `packages/aac-bridge/src/index.ts` re-exports `SwitchScanController`,
   `useAACInput`, OBF/OBZ helpers, vendor adapters, and the eye-gaze
   pipeline.
5. The accessibility + TTS BFFs exist
   (`bff/learners/[learnerId]/accessibility[/reset]`,
   `bff/learners/[learnerId]/tts[/prewarm][/[audioAssetId]]`).

## Verification

```bash
pnpm accessibility:audit
pnpm --filter @aivo/aac-bridge test
pnpm --filter @aivo/web-v2 test -- accessibility
```

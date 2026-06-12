# Sprint 04 — Mobile lesson a11y core: reduce-motion + screen-reader announcements in the stage

## Goal

At the end of this sprint, the **mobile lesson runtime** respects the OS reduce-motion setting and the app's sensory mode (static transitions, scaled animation), and **announces what matters to TalkBack/VoiceOver**: answer feedback (correct/incorrect, shame-free), beat advancement, break starts, and session completion. Today the mobile stage (`MobileStageRuntime` / `MobileBeatRenderer`) contains **zero** `reduceMotion` or sensory-palette references (verified by grep), and the entire app has only three `announceForAccessibility` call sites — none in the lesson flow, so answers are silent to a screen-reader learner. Closes audit gap **B2 (mobile half, 🚨)** and the announcement part of **M6 (⚠️)**.

## Context

- App: `apps/mobile` (Expo 54, expo-router). Learner stage flow:
  - Screen: `apps/mobile/app/(learner)/stage/[sessionId].tsx` — fetches the session, hosts an ErrorBoundary (line ~34) and a crash-snapshot that re-queues the session-end payload (`:62-67`, `queueSessionEnd` defined `:42-60`).
  - Runtime: `apps/mobile/src/components/learning/MobileStageRuntime.tsx` — beat loop, dispatches to `MobileBeatRenderer.tsx` (same dir) for beat types `choice` → `MobileChoiceGrid`, `math-expression` → `MobileMathExpressionInput`, `surface` → `MobileSurfaceRenderer`, tutor-turn prompts. State machine: answered → selected → submitting → lastCorrect → advance/retry.
  - The full learning dir: `apps/mobile/src/components/learning/` (`AssessmentItemRenderer`, `BreakReminder`, `MobileChoiceGrid`, `MobileStageCompletion`, `MobileSurfaceRenderer`, `MobileTutorPanel`, …).
- **Existing a11y machinery to reuse (do not reinvent):**
  - `apps/mobile/hooks/useReducedMotion.ts` — returns a live boolean from `AccessibilityInfo.isReduceMotionEnabled` + `reduceMotionChanged` listener. Already consumed by `components/SplashGate.tsx` and the calm tools (`src/components/learner/calm/BoxBreathing.tsx`, `PatternFocus.tsx`) — follow their gating style.
  - `apps/mobile/context/SensoryModeProvider.tsx` — modes `["standard","calm","high-contrast"]` (`:65`) exposing `palette`, `motionScale`, `shadowStrength` from `INCLUSIVE_WARM_BY_MODE` (`@aivo/brand`). `useSensoryPalette()` is used across ~99 files; the stage is the notable absentee.
  - Announcement precedents: `apps/mobile/src/components/SwitchScanOverlay.tsx:78`, `apps/mobile/hooks/useOffline.ts:27`, and a helper in `apps/mobile/lib/a11y-style.tsx:30` (`if (message) AccessibilityInfo.announceForAccessibility(message)`).
  - `BreakReminder` is mounted app-wide in `apps/mobile/app/(learner)/_layout.tsx` and already has an announce helper (`BreakReminder.tsx`, ~line 29) — reuse its copy tone.
- **Lint gate:** `eslint-plugin-react-native-a11y` rules run at **error** severity as a build gate (`apps/mobile/eslint.config.mjs:57-97`). Your new props must satisfy them.
- **i18n:** `react-i18next`; catalogs `apps/mobile/i18n/{en,es,fr,de,pt,zh,ja,ko,ar,hi}.json`; every new user-facing/announced string needs keys in all 10. Copy tone rules: shame-free, growth-framed — never "wrong/failed"; mirror the web player's miss-feedback register (e.g., "Not yet — let's look together" style).
- **Tests:** vitest (`corepack pnpm --filter @aivo/mobile test`, coverage ratchet ~73% stmt enforced in the vitest config). Maestro journey exists at `.maestro/journeys/login-lesson-offline.yaml`. Manual SR checklist lives at `docs/accessibility/mobile-screenreader-checklist.md`.

## Work orders

### DELETE
- None.

### CREATE
1. `apps/mobile/src/components/learning/stage-announcements.ts` — pure module:
   - `buildAnswerAnnouncement(t, { correct, tutorLine? }): string` — correct → celebratory-calm; incorrect → supportive retry framing; appends the tutor feedback line when present.
   - `buildBeatAnnouncement(t, { index, total, beatTitle? }): string` — "Step {index} of {total}…".
   - `buildCompletionAnnouncement(t, { xpEarned }): string`.
   - `announce(message: string): void` — thin wrapper over `AccessibilityInfo.announceForAccessibility` (or import the existing helper from `lib/a11y-style.tsx` if exportable — check first; one announce path, not two).
2. `apps/mobile/src/components/learning/__tests__/stage-announcements.test.ts` — unit tests for the three builders across locales (mock `t`), asserting shame-free copy (no "wrong", "incorrect", "failed" substrings in en).
3. New i18n keys (all 10 catalogs) under a `stage.a11y.*` namespace for the announcement strings.

### REFACTOR
1. `apps/mobile/src/components/learning/MobileStageRuntime.tsx`:
   - call `useReducedMotion()` and `useSensoryPalette()` (for `motionScale`) at the top; derive `effectiveMotion = reduced || motionScale === 0 ? 0 : motionScale`;
   - locate every animation/transition the runtime drives (grep the file and `MobileBeatRenderer.tsx` for `Animated`, `LayoutAnimation`, `withTiming`, `animationType`, transition props) and gate each: duration × `effectiveMotion`, with `0` → skip the animation entirely (jump-cut, content still appears);
   - pass `{ reducedMotion, motionScale }` down to `MobileBeatRenderer` via props (typed, no `any`).
2. `apps/mobile/src/components/learning/MobileBeatRenderer.tsx`:
   - apply the same gating to its own animations and forward to child surface components that animate (`MobileChoiceGrid` selection feedback, `MobileStageCompletion` celebration — open each and gate);
   - on answer-state transitions (`lastCorrect` set), call `announce(buildAnswerAnnouncement(…))`; on beat advance, `announce(buildBeatAnnouncement(…))`;
   - give the tutor-feedback text container `accessibilityLiveRegion="polite"` (Android) and `accessibilityRole="text"`, satisfying the lint rules.

### EDIT
1. `apps/mobile/app/(learner)/stage/[sessionId].tsx` — on successful session completion (the path that calls `queueSessionEnd`/completion navigation), `announce(buildCompletionAnnouncement(…))`; when the stage routes into a break (the runtime's break entry point), announce the break start using `BreakReminder`'s existing copy key if suitable, else a new `stage.a11y.break_started` key.
2. `apps/mobile/src/components/learning/MobileStageCompletion.tsx` — celebration visuals respect `effectiveMotion` (static congratulation layout at 0; confetti/pulse only at full motion).
3. `docs/accessibility/mobile-screenreader-checklist.md` — add rows: "stage answer feedback announced (TalkBack)", "stage transitions static under reduce-motion", with today's date and result column to be filled on the next device pass.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. `corepack pnpm --filter @aivo/mobile test` green, including the new announcement tests; coverage ratchet not lowered.
2. `corepack pnpm --filter @aivo/mobile lint` green (a11y rules at error severity pass on all touched files).
3. Behavioral proof, best available in this environment (state which you used):
   - **Preferred (simulator/device):** with OS reduce-motion ON, play a lesson — beat transitions are jump-cuts, completion is static; with TalkBack/VoiceOver on, an answer announces supportive feedback.
   - **Fallback (no device):** unit tests assert duration-×-motion math and that `announce` is invoked on the answer/beat/completion transitions (mock `AccessibilityInfo` in tests — mocks are test-only, allowed); paste the relevant component diff hunks showing every animation site gated.
4. `grep -rn "reduceMotion\|useReducedMotion\|motionScale" apps/mobile/src/components/learning/MobileStageRuntime.tsx apps/mobile/src/components/learning/MobileBeatRenderer.tsx` returns the new wiring (the audit's zero-match grep now fails).
5. i18n parity: all 10 mobile catalogs contain the new `stage.a11y.*` keys.

## Tests

- New: `stage-announcements.test.ts`; component-level tests for the gating math where the existing vitest setup supports rendering (follow patterns in `apps/mobile/__tests__/`).
- Run the **full** mobile vitest suite + lint. If the Maestro environment is available, run `login-lesson-offline.yaml` to confirm the golden path still passes; otherwise state that it was not run and why.

## Out of scope

- Decomposing `MobileSurfaceRenderer.tsx` (Sprint 13) — touch it only enough to forward the motion props if a surface inside it animates; keep edits minimal and mechanical.
- Dyslexia font, skeletons, palette restyling (Sprint 05). Web player (Sprint 03). Offline content caching. New animations of any kind.

## Depends on

Nothing hard. Sprint 02 recommended first (CI gate exists), but this sprint's checks are vitest/lint-based.

## Checkpoint

Summarize: every animation site found and how it's gated (file:line list), the announcement call sites, DoD outputs, and whether device verification happened or the fallback proof was used. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**

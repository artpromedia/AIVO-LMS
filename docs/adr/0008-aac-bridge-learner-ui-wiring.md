# 0008 — AAC bridge wired into the lesson player

- **Status:** Accepted
- **Date:** 2026-05-25
- **Related:** Sprint 7, completeness-audit gap #11 ("AAC bridge exists but
  not wired")

## Context

`packages/aac-bridge` ships a complete AAC primitive layer:
`SwitchScanController`, `GazeTargetMapper`, `DwellClickController`,
`SymbolBoard`, OBF/OBZ I/O, and vendor adapters for Tobii, PRC-Saltillo,
and AssistiveWare. The completeness audit confirmed it has zero
consumers in the learner UI today —
`grep -r "aac-bridge\|useAACInput" apps/web-v2/app/learner apps/mobile/app`
returns nothing.

The existing `useAACInput()` hook accepts a fixed `SymbolItem[]` with
image / audio / board metadata. That is the right shape for a dedicated
communication board, but too heavy for wrapping ordinary learner-UI
controls (choice buttons, submit, "Next"). Without a lighter contract,
wiring the lesson player to AAC requires every surface to pre-build a
SymbolBoard — a non-starter.

## Decision

We add a lighter-weight target-registry contract on top of the existing
SwitchScanController, plumb it through the SurfaceRouter's choice
buttons + submit, mount it conditionally in the lesson player, and
extend the learner accessibility-prefs surface with the toggle.

- **`packages/aac-bridge/src/AACTargetProvider.tsx`** (new):
  - `AACTargetProvider` — React context that holds the set of
    currently-scannable targets and drives them through
    SwitchScanController. Reads `enabled`, `inputMethod`, and
    `scanDelayMs` from props.
  - `useAACTarget(id, label, onActivate)` — register a focusable UI
    control as a scannable target. Returns `{ ref, isHighlighted,
    aacActive }`. Safe to call when no provider is mounted (returns
    a no-op ref and `aacActive=false`), so every focusable element can
    use it unconditionally.
  - `AACScanRoot` — wraps a subtree and listens for the activation key
    (default `Space`) and the advance key (default `ArrowRight`).
    Single-switch users mapping their switch to Space can drive a
    complete lesson from the keyboard alone.
  - `useAACContext()` — escape hatch for surfaces that need to call
    `activate()` / `advance()` programmatically.
  - The provider synthesises a `SymbolItem` per registered target and
    feeds it to the existing `SwitchScanController` — scanner logic
    stays single-sourced.

- **`packages/aac-bridge/src/index.ts`** — re-exports the new
  provider, hook, and types alongside the existing surface.
- **`packages/aac-bridge/tsconfig.json`** — `jsx: "react-jsx"`.

- **`packages/learner-surfaces/src/surfaces/ChoiceGridSurface.tsx`** —
  each `ChoiceButton` and the `SubmitButton` are now small components
  that call `useAACTarget`. They expose a `data-aac-highlight`
  attribute so theme / Tailwind layers can paint the scanner ring
  without owning the focus state.

- **`apps/web-v2/lib/db/types.ts`** — `AccessibilityPreferences`
  extended with `aacEnabled: boolean`, `aacInputMethod` (touch /
  switch_1 / switch_2 / eye_gaze / head_pointer), `aacScanDelayMs:
  number`. `ACCESSIBILITY_DEFAULTS` ships sensible defaults
  (aacEnabled=false, touch, 1000 ms).

- **`apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx`** —
  when `accessibility.aacEnabled === true`, the entire player tree is
  wrapped in `<AACTargetProvider>` + `<AACScanRoot>`. AAC activation
  events are mirrored into the existing surface-telemetry sink so
  analytics can correlate AAC selections with lesson outcomes.

- **`apps/web-v2/components/learner/accessibility-form.tsx`** — new
  "Assistive input (AAC)" group on the learner settings page with the
  `aacEnabled` toggle. The form widens its `ToggleKey` union to admit
  it. Device-pairing / vendor selection / per-method tuning UI stays
  out of this sprint (tracked as follow-up).

- **`packages/aac-bridge/src/__tests__/AACTargetProvider.test.ts`** —
  five new controller-level integration tests asserting registration
  order is preserved, `activate()` references the highlighted target,
  2-switch mode reports the right method, subscribers fire on every
  advance (so the provider can focus the highlighted element), and
  the public exports are wired.

## Consequences

- **Positive:**
  - First end-to-end AAC path: a learner with `aacEnabled=true`,
    `aacInputMethod=switch_1`, and a switch mapped to Space can scan
    through choices and Submit on a `ChoiceGridSurface`-driven beat
    without touching the screen or pointer.
  - `useAACTarget` is opt-in-by-default-no-op, so the standard
    rendering path is untouched for non-AAC learners.
  - Scanner logic lives once, in `SwitchScanController`; the provider
    is a thin adapter over it.
- **Negative:**
  - Only the ChoiceGrid surface registers targets today. Scratchpad,
    MathExpression, Geometry, NumberLine, CodingSandbox, ArtCanvas,
    and VoiceResponse still need their submit buttons wrapped — a
    mechanical follow-up I scoped out to keep this sprint reviewable.
  - The settings page exposes only the on/off toggle. Picking the
    input method (1-switch vs 2-switch vs eye-gaze), tuning scan
    delay, and pairing with a vendor adapter (Tobii / PRC-Saltillo /
    AssistiveWare) requires extra UI not in this sprint.
  - Mobile (`apps/mobile/app/(learner)/**`) is not wired yet. The
    AAC package's React Native primitives need their own adapter —
    out of scope for this sprint.
  - No visual scanner highlight CSS yet. The `data-aac-highlight`
    attribute is present on each target; theme work belongs with
    design.
- **Neutral / follow-ups:**
  - End-to-end Playwright spec (`apps/web-v2/e2e/aac-keyboard-only.playwright.ts`
    in the original Sprint 7 prompt) is deferred to the e2e-coverage
    sprint; controller-level tests cover the contract.
  - The provider currently maps every input method to either the
    SwitchScanController (`switch_1`/`switch_2`) or a touch/dwell
    pass-through. Wiring `GazeTargetMapper` + `DwellClickController`
    for true eye-gaze users is a bigger task with its own ADR.

## Alternatives Considered

- **Pre-build a SymbolBoard at lesson-plan time and feed it to the
  existing `useAACInput`.** Rejected: forces every surface to know
  about board layout / image assets when it just has a few buttons.
- **Add a `data-aac-target` attribute and have the provider walk the
  DOM to discover targets.** Rejected: would need a MutationObserver
  to stay in sync with React renders; the registration callback
  approach is reactive and idiomatic.
- **Ship the integration in `learner-surfaces` only without the
  provider in the lesson player.** Rejected: surfaces would
  self-register but with no provider mounted upstream the scanner
  never starts — half the integration is no integration.

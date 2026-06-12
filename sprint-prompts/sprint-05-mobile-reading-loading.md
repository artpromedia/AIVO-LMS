# Sprint 05 — Mobile reading & loading parity: dyslexia-friendly font + shimmer skeletons

## Goal

At the end of this sprint, a learner on mobile can switch to a **dyslexia-friendly typeface** (the same `dyslexiaFriendlyFont` contract field the web honors), and the app's loading moments show **layout-preserving shimmer skeletons** instead of bare `ActivityIndicator` spinners on the main dashboards. Today mobile typography is hardcoded Fredoka/Nunito with no dyslexia option (`apps/mobile/constants/typography.ts:1-20`), and `packages/mobile-ui`'s `LoadingState` is a centered spinner (`LoadingState.tsx:13`). Closes the remaining half of audit gap **M6 (⚠️)**.

> Scope note (verified during planning): the audit's claim that mobile lacks high-contrast/sensory modes was **wrong** — `apps/mobile/context/SensoryModeProvider.tsx:65` already ships `standard/calm/high-contrast`. No sensory-mode work in this sprint.

## Context

- **Typography system:** `apps/mobile/constants/typography.ts` — Fredoka (display) + Nunito (body), exposed exclusively through `fontFamilies.*` ("no `"Fredoka-..."` string literals" — the file's own rule, lines 1-20). Font binaries are bundled and registered via a `FONT_ASSETS` map loaded with `useFonts` in the root layout (`apps/mobile/app/_layout.tsx` — grep `FONT_ASSETS` to confirm the exact line).
- **The reactive override layer:** `apps/mobile/lib/a11y-style.tsx` (lines ~14-33) already implements a font-family override mechanism tied to accessibility preferences, plus an announce helper. Extend it; do not build a parallel system.
- **Preference plumbing (already real):** `dyslexiaFriendlyFont` is a canonical field of `@aivo/accessibility-contract` (`packages/accessibility-contract/src/index.ts:82-149`, Zod in `src/schema.ts`); mobile coercion/persistence lives in `apps/mobile/lib/preferences-logic.ts` and server sync in `apps/mobile/lib/accessibility-sync.ts`. The CI gate `scripts/a11y/no-inert-prefs.mjs` (workflow `.github/workflows/accessibility.yml`) requires every collected pref to have a real consumer — after this sprint, the mobile consumer proof for `dyslexiaFriendlyFont` must hold.
- **Settings surface:** `apps/mobile/app/settings/accessibility.tsx` (global panel; per-learner parent variants exist under `app/(parent)/accessibility/`). Follow the existing toggle-row pattern in that file.
- **Font binary available in-repo:** `apps/web-v2/public/fonts/OpenDyslexic-Regular.otf` with license `OFL-OpenDyslexic.txt` (same dir). React Native loads `.otf` via expo-font; the web's `.woff2` Atkinson files are **not** RN-loadable — use OpenDyslexic. (If the implementing environment has network access and the owner prefers Atkinson on mobile too, Atkinson Hyperlegible TTFs are OFL — but do not block the sprint on a download; OpenDyslexic ships today.)
- **Skeletons:** `packages/mobile-ui/src/LoadingState.tsx` renders `ActivityIndicator` (`:13`). Consumers include the learner home `apps/mobile/app/(learner)/index.tsx` and parent dashboard `apps/mobile/app/(parent)/index.tsx` (plus many `[childId]` screens). `useReducedMotion` (`apps/mobile/hooks/useReducedMotion.ts`) must gate the shimmer.
- Styling tokens: `packages/mobile-ui/src/theme.ts` + `useSensoryPalette()` — no raw hex in components.

## Work orders

### DELETE
- None (the spinner remains available for genuinely indeterminate inline waits; it just stops being the default page-loading state).

### CREATE
1. `apps/mobile/assets/fonts/OpenDyslexic-Regular.otf` — copied byte-identical from `apps/web-v2/public/fonts/OpenDyslexic-Regular.otf`, plus `apps/mobile/assets/fonts/OFL-OpenDyslexic.txt` (license travels with the binary).
2. `packages/mobile-ui/src/Skeleton.tsx` — primitive: `Skeleton({ width, height, radius })` rendering a palette-toned block with a gentle opacity pulse (React Native `Animated`, loop ~1200ms); **when `reduceMotion` is true (accept as prop or via a `reduceMotion?: boolean`), render static** at the mid-opacity value. Export from `packages/mobile-ui/src/index.ts`. Add `SkeletonRows({ variant: "card" | "list" | "hero" })` composing common layouts.
3. `packages/mobile-ui/src/__tests__/skeleton.test.tsx` — renders both modes; asserts no `Animated.loop` started when reduced.
4. New i18n keys (10 catalogs) for the settings toggle label/help text, namespace consistent with the existing accessibility settings keys.

### REFACTOR
1. `packages/mobile-ui/src/LoadingState.tsx` — accept `variant?: "skeleton-card" | "skeleton-list" | "skeleton-hero" | "spinner"`; default becomes `"skeleton-list"`; spinner path preserved for explicit opt-in. Thread an optional `reduceMotion` prop through to `Skeleton` (callers in the app pass the hook value; the package stays hook-free if that's its current convention — check whether mobile-ui components already use hooks; mirror the convention you find).
2. `apps/mobile/constants/typography.ts` — add the dyslexia family constant + `fontFamilies.dyslexiaBody` (and a `resolveBodyFamily(dyslexiaEnabled: boolean)` helper if that fits the file's style), preserving its "no string literals at call sites" rule.

### EDIT
1. Root font registration (`apps/mobile/app/_layout.tsx`, the `FONT_ASSETS`/`useFonts` site) — register `OpenDyslexic-Regular`.
2. `apps/mobile/lib/a11y-style.tsx` — extend the existing override so that when the learner's `dyslexiaFriendlyFont` pref is true, body text resolves to the dyslexia family (display headings may remain Fredoka — body text is the reading-load surface; note this choice in code comments only if the file already explains similar choices).
3. `apps/mobile/app/settings/accessibility.tsx` — add the "Dyslexia-friendly font" toggle row wired through `preferences-logic.ts` persistence + `accessibility-sync.ts` (exactly like the neighboring toggles; the contract field already exists, so no schema change).
4. Dashboard adoption: `apps/mobile/app/(learner)/index.tsx` and `apps/mobile/app/(parent)/index.tsx` — replace their loading `LoadingState`/`ActivityIndicator` usage with the appropriate skeleton variant (`hero` for learner home, `list` for parent roster), passing `useReducedMotion()`.
5. `scripts/a11y/no-inert-prefs.mjs` — if the consumer-proof token list distinguishes per-surface consumers, add/adjust the mobile proof for `dyslexiaFriendlyFont` pointing at the `a11y-style.tsx` consumption (read the script's format first; only touch what's needed for the gate to remain truthful).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. `corepack pnpm --filter @aivo/mobile test` and `corepack pnpm --filter @aivo/mobile lint` green; `corepack pnpm --filter @aivo/mobile-ui test` (or the package's test entry — check its package.json) green with the new skeleton tests.
2. Behavioral proof (Expo: `corepack pnpm --filter @aivo/mobile dev`, or simulator if available — state which):
   - toggling "Dyslexia-friendly font" in settings changes body text app-wide without restart (settings screen itself + learner home visibly switch);
   - the toggle persists across app restart (AsyncStorage path) and syncs via `accessibility-sync` (assert with the existing sync test pattern in `apps/mobile/__tests__/accessibility-sync.test.ts` — extend it);
   - cold-loading learner home and parent home shows skeletons (screenshot/recording), and with OS reduce-motion ON the skeleton does not pulse.
3. `pnpm run a11y:no-inert-prefs` green.
4. i18n parity holds across the 10 mobile catalogs.

## Tests

- New: `skeleton.test.tsx`; extension of `accessibility-sync.test.ts` and `preferences-logic.test.ts` covering the dyslexia toggle round-trip.
- Run the full mobile suite; previously green stays green (coverage ratchet intact).

## Out of scope

- Stage runtime motion/announcements (Sprint 04). High-contrast/sensory modes (already exist). Dark mode / `userInterfaceStyle` (decision-gated, see SPRINT-PLAN). Replacing every spinner in the app — only the two dashboards adopt skeletons here; broader adoption rides future surface work. Web font changes.

## Depends on

Nothing hard; independent of Sprint 04 (different files except trivial overlap in `(learner)/index.tsx` — if both sprints are in flight, run 04 first as ordered).

## Checkpoint

Summarize: files changed, the font-resolution path (pref → a11y-style → rendered family) with file:line hops, skeleton adoption sites, DoD outputs + screenshots/recordings. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**

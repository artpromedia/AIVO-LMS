# Sprint 15 — Per-tutor lesson identity + the theming visual matrix

## Goal

At the end of this sprint, **a Nova math lesson and a Sage reading lesson are visually distinguishable in five seconds**: the lesson player derives an accent treatment, tutor portrait presence, and a welcome/celebrate voice line from the `TUTORS` registry — within the sensory system's hard limits (calm/high-contrast/motion budgets always win). A **visual-regression matrix** (role homes × sensory modes, plus tutor-themed lesson shots) runs in CI so theming and sensory regressions are caught by pixels, not by users. Closes audit gap **S1 (🟡 strategic)** — "inside a lesson the chrome is tutor-agnostic; 'Nova's world' and 'Sage's world' look the same" — and the §5 "theming test matrix" row.

## Context

- **Registry:** `TUTORS` in `packages/brand/src/index.ts:92+` — `name`, `domain`, `icon`, `color` (e.g., nova `#7C3AED`, sage `#10B981`, spark `#F59E0B`), `avatar` + `avatarReduced` (Sprint 06). Subject→tutor resolution: `tutorForSubjectSlug` (`apps/web-v2/lib/learner/baseline-tutors`, used by learner home `:228` and baseline intro). Hex belongs **only** in `packages/brand` (the app-side ESLint hex ban stays binding — accents reach the app as CSS vars/tokens, never literals).
- **Player (post-Sprint-12):** `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/player/` — `accessibility-shell.tsx` already applies sensory CSS vars (Sprint 03); beats live in `player/beats/`; the server `page.tsx` already loads the run + plan (subject is derivable there — trace how the plan stores subject and resolve the tutor server-side).
- **Sensory supremacy rules (non-negotiable):**
  - high-contrast mode: tutor accent must not undermine contrast — the themed treatment falls back to the high-contrast palette (accent only on non-text decorative elements that pass the checks, or dropped entirely);
  - calm mode / `motionReduced` / functioning-level motion budgets (`packages/learner-ui/src/tokens/motion.ts:15-71`): theming adds **zero** new animation; portraits use the `-reduced.svg` variants per Sprint 06's rule;
  - contrast verification: `packages/brand/src/contrast-guard.ts` exists — every tutor accent/foreground pairing used must pass it in a unit test (auto-derive a compliant tint/shade per tutor in brand if any raw `TUTORS.color` fails).
- **Visual harness:** `apps/web-v2/e2e/visual-a11y.playwright.ts` + `-snapshots/` with the anti-blank guard (`:36-45`); lesson-reaching helpers in `e2e/lesson-player-surfaces.helpers.ts`; sensory mode is settable via its cookie (see `components/system/sensory-mode-provider.tsx` persistence). Role homes are reachable via the `aivo_mock_session` cookie per role.
- **Copy:** per-tutor welcome + celebrate lines (14 tutors × 2 lines × 10 locales). Tone: each tutor's domain personality in grade-3, shame-free register consistent with existing learner copy. All 280 strings are real — no fallback-to-generic placeholders; a generic line may exist only as the typed default for a hypothetical 15th tutor added later (registry-keyed lookup with explicit default).

## Work orders

### DELETE
- None.

### CREATE
1. `packages/brand/src/tutor-themes.ts` — `TUTOR_THEMES: Record<TutorSlug, { accent: string; accentSoft: string; accentInk: string }>` derived from `TUTORS[*].color`, each pairing validated/adjusted through `contrast-guard` at build/test time; export `tutorThemeCSSVars(slug)` → `{ "--tutor-accent": …, "--tutor-accent-soft": …, "--tutor-accent-ink": … }`. Unit test: every tutor × every var passes the guard's thresholds.
2. i18n keys `learner.tutor_lines.<slug>.{welcome,celebrate}` — all 14 tutors, all 10 web catalogs (`apps/web-v2/lib/i18n/messages/*.json`).
3. `apps/web-v2/e2e/theming-matrix.playwright.ts` — the matrix spec, using `toHaveScreenshot` + the anti-blank guard pattern:
   - **Part A (tutor identity):** lesson welcome beat for two contrast tutors (nova, sage) × sensory modes (standard, calm, high-contrast) = 6 snapshots; plus an assertion that nova-vs-sage standard-mode screenshots differ materially (pixel-diff above a floor — guards against silent de-theming);
   - **Part B (role × sensory matrix):** role homes (parent, learner, teacher, caregiver, therapist) × 3 sensory modes = 15 snapshots.
   Tag `@a11y` where axe is also run (at minimum the themed lesson page per mode).

### REFACTOR
1. `player/accessibility-shell.tsx` — accept `tutorSlug?: TutorSlug`; apply `data-tutor={slug}` + `tutorThemeCSSVars(slug)` alongside the sensory vars, with the high-contrast suppression rule implemented here (one place), not in each beat.

### EDIT
1. `player/index.tsx` + the server `page.tsx` — resolve the tutor from the plan's subject server-side and thread `tutorSlug` to the shell and beats.
2. `player/beats/WelcomeBeat.tsx` — tutor portrait (Sprint 06 asset components, reduced-variant rule) + the per-tutor welcome line; `player/beats/CelebrateBeat.tsx` — celebrate line + accent treatment on the existing celebration layout (no new motion).
3. Beat chrome accents (progress indicator, header chip — whichever exist in the decomposed beats) consume `--tutor-accent*` vars instead of the neutral token **where contrast-safe**; inventory each accent site in the checkpoint.
4. `apps/web-v2/e2e/visual-a11y.playwright.ts` — if learner home snapshots are affected by themed elements, regenerate intentionally and say so.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. Manual: open a math (Nova) lesson and a reading (Sage) lesson side by side — distinct accent + portrait + welcome line; switch to high-contrast → both render the compliant treatment (no tutor accent on text, contrast intact); calm → reduced portraits, slowed/zeroed motion per the sensory vars (Sprint 03 behavior unchanged).
2. `corepack pnpm --filter @aivo/brand test` green (theme contrast tests); web-v2 `typecheck`/`lint`/`test` green; `node scripts/ci/check-i18n-coverage.mjs` green (280 new strings present).
3. `corepack pnpm --filter @aivo/web-v2 exec playwright test theming-matrix lesson-player stage-sensory` green — 21 matrix snapshots recorded (6 + 15), anti-blank guard passing, nova≠sage diff assertion passing; all existing lesson-player suites still green (theming must not break behavior).
4. `run test:a11y` green (themed pages introduce no axe violations).
5. File-length gate still green (beats stay under budget after edits).

## Tests

- New: brand theme contrast tests; `theming-matrix.playwright.ts`.
- Update: visual snapshots touched (intentional, listed).
- Full web-v2 suite green.

## Out of scope

- Mobile tutor theming (follow-up after this proves the model; mobile carries portraits from Sprint 06 already). Per-tutor sound/voice audio. New mascot/tutor artwork. Baseline runner theming (it has its own identity — note in checkpoint if trivially inheritable). Tutor-svc prompt/personality changes.

## Depends on

**Sprint 03** (sensory vars + shell), **Sprint 06** (portraits + reduced variants). **Sprint 12** strongly recommended first (theming the decomposed beats is clean; theming the 1,133-line monolith is not) — treat as required unless the owner reorders.

## Checkpoint

Summarize: the accent-site inventory, contrast-guard results per tutor (any auto-adjusted colors listed), the 21-snapshot matrix (attach thumbnails or paths), the nova-vs-sage diff metric, DoD outputs. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**

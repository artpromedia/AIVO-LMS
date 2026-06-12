# Sprint 07 — Learner home: one primary action, no "0%" wall

## Goal

At the end of this sprint, a learner landing on `/learner/home` sees **one unmistakable primary action** ("Today's Mission" — or "Finish the baseline" until the baseline is done) above the fold at every breakpoint, with tutors and messages as secondary content and the six-card subject grid relocated to `/learner/subjects`. Mastery is described in **stage-words** ("just starting / growing / strong"), never raw percentages — a child should not be greeted by six cards reading "Not started · 0%". This implements the team's own Global Rule ("no dashboard-first learner experience", `docs/ux/UX-00-audit.md` §1.2/§8) and closes audit gap **M5 (⚠️)**.

## Context

- **The page:** `apps/web-v2/app/learner/home/page.tsx` (server component, mock learner = "Sky"):
  - `startMissionAction` server action at `:61`; its `<form action={startMissionAction}>` at `:380` — this is the engine the hero must drive.
  - Imports `SubjectCard, MessageCard` from `@aivo/ui` (`:40`); subject grid heading `t("subjects_title")` at `:436`, `SubjectCard` render loop from `:449`.
  - Tutor row: tone map `:136-149`, featured tutor via `tutorForSubjectSlug` `:228`, grid `:236+`.
  - Baseline gating already exists on the page (the "Let's get you set up → Finish the baseline" card) — reuse its readiness logic for the hero swap, don't re-derive.
- **Components available:** `packages/ui/src/learner-home/` (`TodayFocusCard.tsx`, `SubjectCard.tsx`, `MessageCard.tsx`, `LearnerBottomNav.tsx`), `packages/ui/src/learner-dashboard/` (`FeaturedLessonCard.tsx`, `TutorAvatarCard.tsx` — carrying Sprint 06's portrait support if that sprint ran), `packages/ui/src/hero/` (`LearningHero` etc., used by parent home-v2 — a good structural reference for a hero band).
- **Subjects page:** `apps/web-v2/app/learner/subjects/page.tsx` exists and is the only file in the app that matched a "coming soon" grep during the audit. Read it first: it becomes the canonical subject browser, so any coming-soon copy in it must be replaced with the real grid (`scripts/ci/check-no-coming-soon.mjs` is the related CI gate — understand why the current string passes it before changing anything).
- **Stage-words precedent:** the parent summary page maps mastery scores to plain-language tags (`apps/web-v2/app/parent/learners/[learnerId]/summary/page.tsx:26-100`, tags like "75% · proficient"). The learner-side variant must be word-only (no numerals).
- **Copy rules:** learner copy ≈ grade-3 reading level, shame-free; no "0%", "behind", "incomplete". i18n keys in all 10 catalogs (`apps/web-v2/lib/i18n/messages/*.json`).
- **Sensory/a11y invariants:** single `<main id="main">`, skip-link target preserved (`globals.css:70-82`); the hero CTA is a real `<button>`/`<Link>` with visible focus ring; axe lane (Sprint 02) must stay green.

## Work orders

### DELETE
1. The subject-grid section from `apps/web-v2/app/learner/home/page.tsx` (heading at `:436` + the `SubjectCard` loop from `:449`) — it moves to `/learner/subjects`. Replace with a single quiet "Explore your subjects →" link card.
2. Any "Not started · 0%"-style percent strings in learner-home i18n keys (replace per EDIT-2, then delete unused keys from all catalogs).

### CREATE
1. `apps/web-v2/lib/learner/mastery-words.ts` — pure `masteryStageWord(score: number | null): "new" | "starting" | "growing" | "strong"` band mapping + `masteryStageKey()` returning the i18n key. Unit test alongside (`mastery-words.test.ts`): band edges, null → "new".
2. New i18n keys (10 catalogs): `learner.home.hero_*` (mission title/cta/encouragement, baseline-variant strings), `learner.subjects.stage_word_{new,starting,growing,strong}`, `learner.home.explore_subjects`.
3. `apps/web-v2/e2e/learner-home-focus.playwright.ts` — `@a11y`-tagged spec: at 768×1024 and 1380×900, assert exactly **one** element with the hero CTA test id above the fold (use `getBoundingClientRect` vs viewport height); assert the page contains no `%` character inside the learner content area; axe pass.

### REFACTOR
1. `apps/web-v2/app/learner/home/page.tsx` — restructure top-to-bottom as:
   1. **Hero band** (full-width, first in `<main>`): mission title + one primary CTA submitting `startMissionAction` (or routing to the existing resume target when a run is in flight — reuse the page's current resume logic). When the baseline gate is active, the hero **is** the finish-baseline card (same action it has today). Exactly one `data-testid="learner-primary-cta"` on the page.
   2. **Tutor row** (secondary, smaller than today's).
   3. **Messages** (unchanged content, after tutors).
   4. **Explore-subjects link card** (from DELETE-1).
   Keep `LEARNER_NAV`/workspace rail and all server data loads; this is layout + hierarchy, not data changes.
2. `apps/web-v2/app/learner/subjects/page.tsx` — render the full subject grid (the `SubjectCard` loop relocated from home), with each card showing the **stage-word** chip via `masteryStageWord` instead of any percentage; wire from the same mastery source home used. Remove/replace any coming-soon copy with the real grid (and ensure `scripts/ci/check-no-coming-soon.mjs` still passes).
3. `packages/ui/src/learner-home/SubjectCard.tsx` — if its props force a percent display, widen to accept a `stageLabel: string` (keep the old prop functional for any other consumer; grep consumers first — if learner home was the only one, simplify the API outright).

### EDIT
1. `apps/web-v2/app/learner/home/loading.tsx` — update the skeleton to mirror the new hero-first layout (hero block + two secondary rows), preserving layout to avoid CLS.
2. Update existing e2e that asserts the old home structure: `apps/web-v2/e2e/learner-smoke.playwright.ts` (and any `role-a11y` route assertions touching `/learner/home`) to the new hierarchy.
3. `apps/web-v2/e2e/visual-a11y.playwright.ts` snapshots for learner home — regenerate intentionally (anti-blank guard must pass).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. Manual (`corepack pnpm --filter @aivo/web-v2 dev`, learner session):
   - `/learner/home` at 768px width: one primary CTA fully visible without scrolling; pressing it starts/resumes today's mission (lands in a lesson run);
   - with the mock store reset to a pre-baseline learner, the hero is the finish-baseline action instead;
   - `/learner/subjects` shows all subjects with stage-words; zero "%" anywhere on either page (learner content area).
2. Commands green: web-v2 `typecheck`, `lint`, `test` (incl. `mastery-words.test.ts`), `exec playwright test learner-home-focus learner-smoke visual-a11y`, `run test:a11y`, `node scripts/ci/check-i18n-coverage.mjs`, `node scripts/ci/check-no-coming-soon.mjs`.
3. Skip link still lands on `#main`; tab order reaches the hero CTA first among interactive content.

## Tests

- New: `mastery-words.test.ts`, `learner-home-focus.playwright.ts`.
- Update: `learner-smoke.playwright.ts`, visual snapshots, any unit tests of the home page's helpers.
- Run the full web-v2 suite; previously green stays green.

## Out of scope

- Rewards/missions/library pages (beyond the moved grid), tutor art (Sprint 06), per-tutor theming (Sprint 15), data-layer changes (Sprint 08), mobile home. No new gamification mechanics. The owner-run usability check with target-age learners (roadmap DoD) is a human activity — flag it in the checkpoint; do not fabricate study artifacts.

## Depends on

**Sprint 06** (the hero and tutor row should render portraits, not emoji). Can technically run without it, but execute in order unless the owner says otherwise.

## Checkpoint

Summarize: new hierarchy (annotated screenshot at 768px and desktop), files moved/changed, i18n keys added/removed, DoD outputs, and the note that the learner usability check remains for the owner to schedule. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**

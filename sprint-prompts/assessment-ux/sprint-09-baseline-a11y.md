# Sprint C-09 — Baseline accessibility part 1: honor the learner's preferences inside the questions

**Stack:** `apps/web-v2` · `packages/accessibility-contract` · `apps/mobile` (sync constants).
**Report items closed:** Top 10 **#10 (part 1)**; Structural roadmap row "Baseline accessibility (#10, part 1)"; §3.5 weaknesses (accessibility-contract unwired, font/spacing not applied, mobile drift, unexplained breaks). Switch/AAC is **C-15** (part 2). Carries the ❓-appendix per-route axe task for baseline routes.

## Goal

At the end of this sprint, a learner's accessibility defaults — dyslexia-friendly font, text size, letter/line spacing — **visibly apply inside the baseline question card** (not just app chrome); the `@aivo/accessibility-contract` package is actually imported and enforced by baseline components; the mobile baseline matches web pacing (subjects from data, `BREAK_EVERY` unified); and frustration-triggered breaks gently explain themselves instead of appearing arbitrary. The product's stated reason to exist — sensory-aware learning for neurodiverse children — becomes true inside its most delicate flow.

## Context

- **The flow (report §3.5):** `/learner/baseline` → `/why` → `/subjects` → `/readiness` → `/intro` → `/[baselineId]` run (all under `apps/web-v2/app/learner/baseline/`). The emotional design is already excellent (untimed, no-fail, skip everywhere) — do not regress one word of it.
- **The gaps (re-verified at HEAD `32ece1d3`):**
  - `packages/accessibility-contract` exists but is **never imported by baseline components** (repo-grep confirmed). Inspect the package first to learn what it actually exports (conformance types? lint rules? runtime helpers?) and apply it the way it was designed to be applied — document your reading of it in the Checkpoint before wiring.
  - The learner question card hardcodes typography (`text-2xl md:text-3xl` per the audit) and does not consume `learner.accessibilityDefaults` (font family, text size, spacing). Sensory **mode** (calm/high-contrast) IS wired (cookie → CSS vars, reduced art in `baseline/intro/page.tsx:34-35`) — extend, don't duplicate.
  - Mobile drift: `apps/mobile/app/(learner)/baseline/index.tsx:13` hardcodes `SUBJECTS = ["Math", "Reading", "Science", "Writing"]`; `run.tsx:24` sets `BREAK_EVERY = 3` vs web's `5` (`app/learner/baseline/[baselineId]/page.tsx:68`).
  - Breaks appear without explanation when frustration-triggered (`page.tsx:405-461`; `assessFrustration` in `lib/learner/baseline-adaptive.ts:257+`; BreakCard copy has no "we noticed" variant).
- **Where prefs come from:** `learner.accessibilityDefaults` (see its use at `lib/learner/brain-profile.ts:635-645` and the learner settings pages, e.g. settings_a11y). The functioning-level CSS var profiles exist server-side too (`services/brain-svc/src/brain_svc/routes/brain.py:1012-1106`) — web-v2's own mechanism is the one to extend.
- **Cross-track:** functional Suite B sprint-03 (web sensory stage) and **B-06 (tutor art touches baseline surfaces)** — if either is in flight/landed, rebase carefully and match their token usage. Axe lane per B-02.
- **Persona/bar:** Khan Academy Kids. A dyslexic learner with large-text settings must see those settings *inside the question*, mid-assessment — the moment that matters most.

## Work orders

### DELETE
- None.

### CREATE
1. A small, reusable **preference-to-style bridge** for learner surfaces (location: wherever the existing sensory-mode bridge lives — extend that module rather than creating a parallel system if it can carry font/size/spacing): maps `accessibilityDefaults` → CSS custom properties (`--learner-font-family`, `--learner-font-scale`, `--learner-letter-spacing`, `--learner-line-height`) applied at the baseline shell level, with the dyslexia-friendly font actually loaded (check `packages/brand`/existing font pipeline for an approved face before adding one).
2. **Frustration-aware break copy:** a second BreakCard variant used when the break was struggle-triggered (`frustrationBreak` at `page.tsx:411-416`): one gentle line — e.g. "Some of those were tricky — that's exactly when a breath helps." — i18n'd, shame-free, never naming wrongness counts. Standard cadence breaks keep the existing copy.
3. **Axe specs** (`@a11y`, Suite B-02 pattern) for: `/learner/baseline`, `/learner/baseline/readiness`, `/learner/baseline/intro`, and the runner (`/learner/baseline/[baselineId]` with a seeded session) — including a `prefers-reduced-motion` emulation assertion on the runner.
4. Tests per **Tests**.

### REFACTOR
1. Baseline question card + answer components (the runner's card in `app/learner/baseline/[baselineId]/` and any `packages/ui` baseline components it uses): replace hardcoded type scale with the CSS-var bridge so font family/size/spacing prefs apply; verify touch-target sizes still meet the larger of (existing) and (pref-scaled) values.
2. Wire `@aivo/accessibility-contract` into the baseline components per the package's intended mechanism (from CREATE-1's inspection) — if the package ships conformance tests/types, the baseline components must now pass/implement them.

### EDIT
1. `apps/mobile/app/(learner)/baseline/index.tsx:13` — subjects fetched from the same API/data source web uses (locate mobile's existing API client for baseline; no hardcoded list).
2. `apps/mobile/app/(learner)/baseline/run.tsx:24` — `BREAK_EVERY` unified with web (5); extract the constant to a shared location if a sensible shared package exists (e.g. `packages/adaptive-baseline`), else mirror with a cross-referencing comment and a parity test.
3. i18n: new break-variant + any new strings, 10-locale parity (D7).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report structural-row DoD, verbatim: **"`accessibility-contract` imported by baseline components; font/spacing/size defaults visibly applied to the question card; mobile `BREAK_EVERY`/subjects unified with web."** Plus the break-copy improvement (§3.5 "best-in-class would add").

Verification:
1. Runtime proof: set a learner's accessibility defaults (dyslexia font + larger text + wide spacing) via the settings surface, enter the baseline runner, capture before/after screenshots of the **same question** showing the prefs applied inside the card.
2. Frustration walk: answer 3 consecutive items wrong/skip → the struggle-variant break renders (screenshot); cadence break still shows standard copy.
3. Mobile: vitest parity test green (BREAK_EVERY), subjects render from data (no hardcoded list remains — grep proof).
4. All four axe specs green incl. reduced-motion assertion; full suite green; **zero regressions to the no-fail copy** (snapshot/string tests on the existing baseline copy keys).

## Tests

- Component tests: CSS-var bridge mapping (each pref → var), question-card consumption.
- Accessibility-contract conformance per the package's mechanism.
- Mobile vitest: BREAK_EVERY parity + subjects-from-data.
- e2e: the four `@a11y` specs; a runner walk asserting break variants.
- Run the full suite so C-01..C-08 stay green.

## Out of scope

- Switch scanning / AAC input (**C-15**).
- Tutor art/portraits (Suite B-06).
- Adaptive-engine changes (frustration *detection* stays as-is; only the break copy changes).
- Baseline LLM/safety-gate pipeline (`services/assessment-svc`).

## Depends on

- None hard. Coordinate with Suite B-03/B-06 if in flight. **C-15 depends on this sprint.**

## Checkpoint

Summarize changed files; attach the before/after question-card screenshots, the struggle-break screenshot, the mobile parity proof, and your documented reading of what `@aivo/accessibility-contract` provides and how it was wired. **Pause for owner review. Do not commit unless explicitly told to.**

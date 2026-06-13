# Sprint C-15 — Switch & AAC access for the baseline: the learners the product centers can take it independently

**Stack:** `apps/web-v2` · `packages/aac-bridge` (consume; extend only if its contract requires it).
**Report items closed:** Top 10 **#10 (part 2)**; Strategic roadmap row "Switch/AAC baseline"; §3.5 weakness #1 ("No switch access or AAC input path in the baseline … The learners the product centers most cannot take the baseline independently").

## Goal

At the end of this sprint, a learner using a switch (single/dual) or an AAC device can complete the Discovery Adventure baseline independently: every interactive element in the baseline runner is reachable and operable through a scanning input mode (step-scan and auto-scan), targets respect the functioning-level sizing profiles, read-aloud pairs with scan focus so choices are heard as they highlight, and the existing **vendor-certification suite** passes against the baseline. The platform's deepest promise — assessment that cannot exclude the child it serves — becomes true.

## Context

- **The gap (report §3.5, re-verified at HEAD `32ece1d3`):** no switch-adapter/scanning integration exists anywhere under `app/learner/baseline/` (repo-grep confirmed); keyboard works via semantic HTML but is insufficient for switch users. Meanwhile the platform *already claims and partially builds for* these learners: functioning-level derivation maps `switch_access`/`eye_gaze`/`partner_assisted` inputs (`services/brain-svc/src/brain_svc/services/clone_pipeline.py:95-101`); parent assessment captures response method "Switch"/"Eye gaze" (§3.1 audit, learning_profile section); FL CSS profiles define hit-target sizes up to 80px (`brain.py:1012-1058`); the README advertises an "AAC bridge … end-to-end eye-gaze pipeline."
- **The assets to build on — inspect before designing, document findings first:**
  - `packages/aac-bridge` — the report cites a "vendor-certification suite plus an end-to-end eye-gaze pipeline" (README). Read its exports, contracts, and certification suite first; the sprint's design must use its mechanisms, not parallel ones. If its certification suite defines conformance requirements for surfaces, the baseline runner becomes a conforming surface.
  - `packages/accessibility-contract` — wired into baseline components in **C-09**; extend its conformance where it covers input modality.
  - The baseline runner: `app/learner/baseline/[baselineId]/page.tsx` (choice cards as fieldset/radio, skip button, hint card, read-aloud button, break cards) — the inventory of operable elements.
  - Read-aloud/TTS: `ReadAloudButton` + the TTS adapter (`lib/tts`), `useTTS` in shared packages.
  - Learner prefs: `learner.accessibilityDefaults` (extend with scan settings only if no existing field fits — check the type first); sensory-mode bridge from C-09.
- **Scanning design constraints (the persona is a child, likely neurodiverse):** auto-scan dwell time configurable (default conservative, e.g. 1.5–2s) and step-scan (advance/select on two switches or one-switch auto-advance); visible, high-contrast scan focus that honors calm/high-contrast sensory modes and `prefers-reduced-motion` (focus moves without animation); scan order = reading order = DOM order (no clever reordering); the Skip control always in the scan cycle (skipping must never be harder than answering — the no-fail principle in input form); pairing with read-aloud so each focused choice can be spoken; breaks/“Stop for today” reachable in-cycle.
- **Activation:** via learner settings (a11y settings page) and honored during the baseline like other prefs (C-09's bridge); never auto-enabled by inference alone, but suggested when the parent assessment recorded switch/eye-gaze response methods (gentle prompt on the readiness screen — copy through i18n).
- **Cross-track:** C-09 landed the pref bridge and contract wiring this sprint extends; Suite B mobile a11y sprints are adjacent but mobile baseline scanning is out of scope here.

## Work orders

### DELETE
- None.

### CREATE
1. **Inspection memo first (in the Checkpoint, before code):** what `packages/aac-bridge` provides (APIs, event model, certification suite shape, eye-gaze pipeline touchpoints) and how the baseline will conform — keep it short but written before implementation.
2. **Scanning input mode** for the baseline runner: a scan controller (focus ring manager + timing engine) operating over the runner's operable elements; step-scan + auto-scan; switch inputs mapped per aac-bridge's contract (and standard fallbacks: Space/Enter as select, Tab-free operation); settings (mode, dwell, switch count) in learner a11y settings; state persisted with the learner's prefs.
3. **Read-aloud pairing:** focused choice optionally spoken via the existing TTS path (respecting the audio settings); off by default unless audio-first prefs are set.
4. **Readiness-screen suggestion:** when the parent assessment recorded switch/eye-gaze response methods, the readiness check surfaces "Want button-friendly mode?" (i18n; dismissible; never blocking).
5. **Certification + tests:** run/extend the aac-bridge vendor-certification suite against the baseline runner; Playwright e2e driving the full baseline with keyboard-emulated switch inputs only (no pointer events) from intro through completion, including a break and a skip; `@a11y` axe spec updates for scan-mode states.

### REFACTOR
1. Baseline runner components as needed to expose a clean operable-element registry for the scan controller (prefer DOM-order discovery over manual registries; refactor only where component structure prevents reliable scanning).

### EDIT
1. Learner a11y settings page: the scan-mode settings group (states designed; plain language; child-readable labels).
2. i18n: all new strings, 10-locale parity (D7).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report strategic-row DoD, verbatim: **"Baseline completable via switch scanning and the existing aac-bridge; verified with the vendor-certification suite."**

Verification:
1. The switch-only e2e completes the entire baseline (subjects → readiness → intro → all questions incl. a skip, a hint open, a read-aloud trigger, a break resume, and "Stop for today" reachability) with zero pointer events — test output pasted.
2. The vendor-certification suite green against the baseline (output pasted); if the suite's scope proves narrower than the report implied, document exactly what it certifies and what the e2e covers beyond it.
3. Scan focus visible and correct in calm + high-contrast modes and under `prefers-reduced-motion` (screenshots).
4. Settings round-trip: enable scan mode in settings → baseline honors it → disable → standard input restored.
5. Axe specs green; C-09's pref tests and the no-fail copy snapshots unregressed; full suite green.

## Tests

- Scan-controller unit tests (timing, order, dwell, two-switch mapping).
- The switch-only e2e; certification suite; axe updates; settings persistence tests.
- Run the full suite so C-01..C-14 stay green.

## Out of scope

- Mobile baseline scanning (follow-up after Suite B mobile a11y work).
- Eye-gaze hardware integration beyond what aac-bridge already provides (consume its pipeline; do not build drivers).
- Lesson-player/Stage scanning (baseline only — the Stage has its own track).

## Depends on

- **C-09** (pref bridge + contract wiring). Inspect-first memo gates implementation within the sprint.

## Checkpoint

Summarize changed files; lead with the inspection memo; attach the switch-only e2e output, certification results, and the mode screenshots (calm/HC/reduced-motion). **Pause for owner review. Do not commit unless explicitly told to.**

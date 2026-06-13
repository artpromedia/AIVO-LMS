# Sprint C-14 — The full reveal: screens 0–7 as one story, instrumented, with a share-worthy ending

**Stack:** `apps/web-v2` only.
**Report items closed:** Strategic roadmap row "The full reveal (§4.2)"; §4.1 points 2 (transparency — the never-built explainability narrative), 3 (strengths-first, completed), 8 (emotional craft); storyboard **screens 1–4 (full)**, cohesion pass over **0, 5, 6, 7**; the share artifact; reveal instrumentation.
**Decision gate:** **D4(b)** — grade language may return on screen 4 **only** sourced from the curriculum-svc catalogue, labeled "starting point, not a label"; owner confirms at sprint start whether to include or skip that option.

## Goal

At the end of this sprint, the reveal is the product's selling point realized: a parent moves through one coherent story — *inputs assembling with real contribution counts → strengths first → how she learns best with source chips and confidence dots → honest growth-framed starting points → check-our-understanding → ceremony → what happens next* — instrumented end-to-end (reveal-completion → approval conversion; time-to-approve), ending with a **strengths-only share artifact** safe enough to send to a grandparent. Copy passes a written rubric: *would the parent of a newly-diagnosed child feel seen?*

## Context

- **What exists when this runs:** C-03 (truthful copy, strengths stage, no fabricated numbers), C-05 (screen 5), C-06 (screens 6–7 initial, approval records, ignition), C-13 (screen 0 notification, change timeline). This sprint completes screens 1–4 and stitches 0–7 into one experience.
- **The unbuilt transparency layer (report §4.1 point 2, re-verified at HEAD `32ece1d3`):** per-decision `source` attribution exists in data (`"collaborator:therapist"` etc. — `lib/learner/brain-profile.ts:134-135`; coarse summary `:589-594`; `confidenceSignals` `:648-652`; the Sprint-A1 selector `lib/learner/brain-explainability.ts` normalizes it) — but the "you told us X, her teacher observed Y, the baseline showed Z" narrative is **assembled in data and never told on screen**. `BrainExplainabilityPanel` (Sprint A2) was never built; C-06 renders the RAI slice only.
- **Screen specs (report §4.2, the binding spec — inline summary):**
  - **Screen 1 — Inputs assembling:** one card per *source* with real contribution counts ("You answered 11 sections · Her baseline: 23 questions · Ms. Rivera: 2 observations"). Data: parent assessment `completedSections`, baseline `summary.totalAnswered`/attempt counts, collaborator insight counts + roles, IEP presence. C-03 re-voiced the stage titles; this screen adds the counts and source cards.
  - **Screen 2 — Strengths first:** enrich C-03's stage with one observed-behavior strength from the baseline's process signals where available ("She self-corrected 4 times — that's persistence" — `surfaceSignalSummary` from the learning-profile pipeline; verify availability in the web-v2 state and degrade gracefully).
  - **Screen 3 — How she learns best:** modality/pacing/sensory/focus cards framed as operating instructions, each with a **source chip** ("You told us" / "Her baseline showed" / "Ms. Rivera observed" — from the decisions' `source` fields) and a **3-level confidence dot** — **(new)** derivation rule, implemented as a pure function with tests: confidence = high when ≥2 independent sources agree or baseline n ≥ threshold; medium for single-source-with-baseline-support; low for single-source — thresholds documented in code and shown to the parent in plain words ("we're fairly sure" / "early signal").
  - **Screen 4 — Where we'll start:** qualitative estimates with growth framing ("Reading: building — we'll start gently and move at her pace"); per D4(b), optional curriculum-grounded grade language *only* from curriculum-svc (ADR 0040 — the standards source of truth), with the explicit "starting point, not a label" line; never any computed grade-equivalent.
  - **Screen 7 (full) + share artifact:** "what happens next" enriched (first week preview if creator data exists — coordinate Suite A-07's "parent next-week view" if landed: reuse, don't duplicate); the **strengths-only share artifact** — a downloadable/shareable card containing the child's first name, strengths, and interests **only** (no levels, no accommodations, no diagnoses, no source data — safe by construction; review against the privacy rules and say so in the Checkpoint).
- **Instrumentation:** events for reveal-started, per-screen advance, corrections-opened, ceremony-reached, approved/amended, share-artifact-created — with timestamps enabling completion→approval conversion and time-to-approve. Follow the existing telemetry pattern (`lib/learner/baseline-telemetry.ts`); confirm where product analytics events land in this repo and use that sink.
- **The rubric (report DoD):** write `docs/ux/reveal-copy-rubric.md` — the "would a parent of a newly-diagnosed child feel seen?" checklist (strengths-first, no deficit-leading, no jargon, no unverifiable claims, every number explained) — and record the pass against every screen's copy.
- **Persona/bar:** 23andMe-results / Spotify-Wrapped — a story about a person. The recap-timeline-as-deploy-log failure mode (report §4.1 point 8) is the thing being replaced.

## Work orders

### DELETE
1. The legacy recap timeline as the *primary* post-build surface (`building-client.tsx` recap section) — superseded by the stitched screens; keep a compact "review the details" disclosure for parents who want the list view (do not delete the data rendering wholesale; demote it).

### CREATE
1. Screens 1–4 per the specs above (components under `app/parent/learners/[learnerId]/brain-clone-watch/` or a dedicated `reveal/` module — keep the route stable), wired into the existing three-act flow (clone intro → build → screens → screen 5 (C-05) → ceremony (C-06) → screen 7).
2. The **confidence derivation** pure function + tests (Screen 3).
3. The **share artifact**: render + export (image or print-safe page per repo precedent — check for existing share/export utilities before adding a renderer), creation event instrumented, content-safety test asserting the artifact's data surface contains only the allowed fields.
4. **Instrumentation** events per Context, with a small conversion read-path (even a test/admin query proving the funnel is computable — a dashboard is out of scope).
5. `docs/ux/reveal-copy-rubric.md` + the recorded screen-by-screen pass.
6. e2e: full-reveal walk; `@a11y` axe spec updates for the new screens (incl. reduced-motion full-path).

### REFACTOR
1. `brain-clone-watch/page.tsx` data assembly: load and pass contribution counts (parent sections, baseline answered, collaborator counts by role, IEP flag) and the per-decision source/confidence inputs the screens need — extend `BuildingSequenceData`/props; keep server components doing the data work.

### EDIT
1. Cohesion pass over screens 0/5/6/7: one vocabulary, one visual rhythm (the persistent sphere thread — report §4.1 point 8 praises this; extend it), transition copy between acts; screen 0's notification deep-links into the stitched flow (C-13).
2. i18n: all new strings, 10-locale parity (D7).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report strategic-row DoD, verbatim: **"Storyboard screens 0–7 shipped; reveal completion→approval conversion and time-to-approve instrumented; a strengths-only share artifact exists; copy reviewed against a 'would a parent of a newly-diagnosed child feel seen?' rubric."**

Verification:
1. Full runtime walk, screen 0 notification → screen 7, screenshots of every screen (standard + reduced-motion); the zero-contributor and partial-source variants of screens 1/3 also captured (empty/partial states designed).
2. Source chips trace to real `source` fields; confidence dots match the derivation tests; no chip or dot renders without backing data.
3. Share artifact: generated file attached; the content-safety test output proving its field surface.
4. Instrumentation: the event stream for one complete walk pasted; the conversion/time-to-approve computation demonstrated.
5. The rubric document with per-screen pass recorded; axe specs green; full suite green (C-01..C-13 unregressed).

## Tests

- Confidence-derivation unit tests; contribution-count assembly tests; share-artifact content-safety test; e2e full walk; `@a11y` updates.
- Run the full suite.

## Out of scope

- Mobile reveal parity (post-D1 follow-up).
- Curriculum-svc changes (screen 4 reads the catalogue; it does not author it).
- Notification machinery (C-13) and approval mechanics (C-05/C-06) — consumed, not modified, beyond the cohesion copy pass.

## Depends on

- **C-03, C-05, C-06, C-13** (hard). Decision **D4** confirmed at start. Coordinate with Suite A-07 (next-week view) for screen 7's week preview if landed.

## Checkpoint

Summarize changed files; attach the full screenshot set (incl. reduced-motion + partial-data variants), the share artifact, the event-stream + funnel computation, and the completed rubric. **Pause for owner review. Do not commit unless explicitly told to.**

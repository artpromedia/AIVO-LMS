# Sprint C-11 — Parent assessment polish: take the flagship flow from 4s to 5s

**Stack:** `apps/web-v2` only.
**Report items closed:** the §3.1 parent-assessment weaknesses (autosave transparency, invisible resume, step-10 overload, clinical diagnosis moment). No scorecard cell ≤ 2 and no roadmap row maps here — this sprint exists to honor "close every finding." **Decision D5: explicitly deferrable; confirm in-scope before executing.** Carries the per-route axe task for the assessment routes (❓ appendix).

## Goal

At the end of this sprint, the anxious 11pm parent never wonders whether their answers survived: saving is visible ("Saved ✓"), returning is welcoming ("7 of 12 done — about 2 minutes left"), no single screen carries three sections' cognitive load, and the one clinical moment (the diagnosis checklist) carries its reassurance beside it instead of three steps later. The suite's strongest flow reaches the Typeform/Headspace bar it is already close to.

## Context

All citations re-verified at HEAD `32ece1d3`. The flow: `/parent/learners/[learnerId]/assessment/intro` → `?step=1..11` → `/review` → `/submitted` (`apps/web-v2/app/parent/learners/[learnerId]/assessment/`); steps defined in `apps/web-v2/lib/validators/parent-assessment.ts:143-241`; saving via server action `saveStepAction` (`assessment/page.tsx:93-245`) → section-patch into `web_parent_assessments`.

The four findings (§3.1):
1. **Autosave is step-commit only, with no save signal.** Persisting happens only on the Next/Save POST; nothing ever says "Saved." A battery death mid-step loses the current screen. (The intro copy implies continuous autosave — copy and behavior must end up telling the same truth, whichever way you close the gap.)
2. **Resume is functionally correct but invisible.** The intro finds the first incomplete step (`assessment/intro/page.tsx:162-187`) and offers "Continue where I left off" — with no progress badge, no proof the answers survived.
3. **Step 10 violates one-thought-at-a-time:** homework + goals + motivation, ~7 inputs on one screen (`assessment/page.tsx:931-979`).
4. **The diagnosis checklist is the one clinical moment:** raw labels ("ADHD", "Autism spectrum"… `page.tsx:349-359`) with the softening reassurance ("Pick what feels right. AIVO doesn't need a formal label…", `page.tsx:469`) attached to a *later* step's reassurance column.

Strengths to preserve verbatim (do not regress): the warm helpers ("There's no wrong answer here", `:166`; "…common and fine", `:190`; "AIVO honours whatever you select", `:198`), strengths-before-challenges ordering, per-step "why we're asking", the review screen, and the submitted screen's "What learners never see" card (`assessment/submitted/page.tsx:64-165`). The form primitives (`packages/ui/src/assessment/*`) carry full ARIA — extend, don't fork.

## Work orders

### DELETE
- None.

### CREATE
1. **Field-level autosave with a visible indicator:** debounced (~1.5–2s idle) section-patch from the client to the existing PATCH BFF (`app/api/bff/learners/[learnerId]/parent-assessment`, PATCH at `route.ts:104-112`) — validating only the touched section, tolerating partial/invalid drafts (draft ≠ submit validation; verify `patchParentAssessmentSection` semantics allow partial section data, and if not, add a draft-lenient path); a quiet "Saved ✓ · just now" indicator near the progress bar (aria-live polite, debounced announcements so screen readers aren't spammed). Offline/failed-save state: indicator shows "Couldn't save — retrying" and retries; never a modal, never data loss on step-Next (the existing step-commit POST remains the authoritative write).
2. **Resume card:** on the intro and the learner detail page — "You're {n} of {total} screens in — about {m} minutes left. Your answers are saved." with the continue CTA (data already derivable from `completedSections`; the intro's first-incomplete-step logic at `intro/page.tsx:162-187` supplies the target).
3. **Axe spec** (`@a11y`, Suite B-02 pattern) covering intro, a wizard step, review, and submitted.
4. Tests per **Tests**.

### REFACTOR
1. **Split step 10** into two screens (homework/routine · goals/motivation): update `WIZARD_STEPS` (`lib/validators/parent-assessment.ts:143-241`), the step renderer (`page.tsx:931-979`), the review grid, the progress totals, and every count-bearing copy string — including the intro's "About 6 minutes" / "Eleven calm screens" (`intro/page.tsx:32-34`) → recalculate honestly (twelve screens; re-verify the minute estimate against the per-step estimate logic at `page.tsx:1052-1054`). Migration safety: existing in-progress drafts keyed by section ids must resume correctly under the new step mapping (sections don't change, only their grouping — assert in tests).

### EDIT
1. **Diagnosis moment:** place the reassurance *beside the grid* — move/duplicate the "Pick what feels right. AIVO doesn't need a formal label — only what helps day to day." line (from `page.tsx:469`) into the background/diagnoses section itself (`:349-359` options block), plus one line of "you can change this later." Do not add descriptions that medicalise further; keep labels as-is (parents expect them) — the fix is proximity of warmth, not relabeling.
2. Align the intro/wizard copy with the new autosave truth ("Saves as you type" only once it does).
3. i18n: all new/changed strings, 10-locale parity (D7).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

(No verbatim roadmap row exists — this is the report §3.1 "best-in-class would add" list, made verifiable.)
1. Typing in any field then idling produces a server-persisted draft and a visible "Saved ✓" (network tab + DB read proof); killing the tab mid-field and returning restores the typed text.
2. A parent returning with 7 sections done sees the resume card with correct counts on intro **and** learner detail; continue lands on the correct step.
3. The wizard is 12 screens; no screen renders more than ~4 inputs; every count-bearing string is accurate; an in-progress pre-split draft resumes correctly (test).
4. The diagnosis grid renders with its reassurance adjacent (screenshot).
5. Axe spec green across the four routes; the §3.1 preserved-copy strings unchanged (string snapshot test); full suite green.

## Tests

- Autosave unit/integration (debounce, partial-section persistence, retry state); resume-count derivation; step-split migration test (old draft → new mapping); copy snapshot test for preserved strings; e2e: type → idle → reload → restored; the `@a11y` spec.
- Run the full suite so C-01..C-10 stay green.

## Out of scope

- The submitted screen, review screen structure, and IEP step (already strong).
- Any backend schema change beyond draft-lenient patching.
- Mobile-native parent assessment (does not exist; responsive web verified in C-01's rider — fix only defects that rider logged *if* they fall inside these four work orders).

## Depends on

- None. **Decision D5 (in-scope confirmation) required before execution.** C-01's viewport-rider findings are an input.

## Checkpoint

Summarize changed files; attach the saved-indicator and resume-card screenshots, the tab-kill restore proof, the 12-screen review grid, and the diagnosis-grid screenshot; paste the preserved-copy snapshot test output. **Pause for owner review. Do not commit unless explicitly told to.**

# Sprint C-05 — The correction loop: "actually, she's fine reading aloud" (storyboard screen 5)

**Stack:** `apps/web-v2` (persistence + UI). Parity with the brain-svc `parent_modifications` contract **shape** — Decision **D2(a)**, default.
**Report items closed:** Top 10 **#4**; first half of the Structural roadmap row "Correction loop (#4) + approval ceremony (#9)"; trust-underminer #3 (§1.3); §4.1 point 5 (corrections half); §4.2 **screen 5**.

## Goal

At the end of this sprint, a parent reviewing their child's freshly built profile can mark any individual inference "not quite," correct it inline (toggle an accommodation, adjust a comfort level, keep or release a tutor, attach a note), and have those corrections **persist into the profile that lessons actually teach from** — with therapist-recommended supports visibly locked with attribution. "Add context & rebuild" stops being a dead-end link to a read-only page, and "Regenerate" stops silently resetting the parent's progress. The broken correction loop (the report's third trust-underminer) closes.

## Context

- **The dead end today (re-verified at HEAD `32ece1d3`):** the recap's Amend CTA links to `/parent/learners/[learnerId]/brain-profile` (`brain-clone-watch/building-client.tsx:244-249`) — a page with **no editing controls** (`brain-profile/page.tsx` renders read-only cards). Its only action, "Regenerate", calls `upsertBrainProfile`, which **resets `cloneStage` to `pre_clone`** (`lib/db/repos.ts:564-576`), sending the parent backwards with no explanation. Nothing anywhere sets `amended: true` — the form field exists (`brain-clone-watch/page.tsx:45`) but no UI sends it.
- **The contract to honor (D2):** the Python API already defines field-level corrections — `BrainApproveRequest.parent_modifications: list[ParentModification]` with `field`, `original_value`, `parent_value`, `parent_note`, `modified_at` (`services/brain-svc/src/brain_svc/models/schemas.py:80-91`), folded by prefix: `mastery_levels.*`, `accommodation.*`, `tutor.*`, recorded into `xai_explanation.parent_modifications` (`routes/brain.py:382-411`). **Implement the same shape in web-v2** (its store is what the live lesson pipeline reads — `createLessonRun` snapshots `brain.state`, `repos.ts:1945`) so C-12 can unify cheaply. Do not bridge web-v2 to brain-svc for this (ADR 0009 bypass exists, but bridging would gate the wrong store).
- **Data available for the review rows** (all in `LearnerBrainProfileState`, built by `lib/learner/brain-profile.ts`):
  - Accommodations: `activeAccommodations`, `supportDefaults` (extendedTime/readAloud/speechToText/visualSchedules/sensoryBreaks), and `xaiExplanation.accommodationDecisionsDetailed[]` with `reasoning`, `source` (e.g. `collaborator:therapist`), and `removable` (therapist-pinned ⇒ `removable: false` — parity semantics in `services/brain-svc/src/brain_svc/services/clone_pipeline.py:187-203` and web fold `brain-profile.ts:107-160`).
  - Comfort/levels: `readingComfort`, `mathComfort`, `masteryOverview[].estimate` (qualitative).
  - Tutors: `activeTutors` + `tutorDecisionsDetailed`.
- **Persistence conventions:** `brainProfileStateSchema` (`lib/validators/brain-profile.ts`) validates state; memory + drizzle adapters must stay in parity — patterns: `lib/db/persistence/__tests__/brain-profiles.parity.test.ts` and `__tests__/contract/brain-profiles.contract.ts`.
- **Approval status semantics:** `approveBrainClone(learnerId, tenantId, { amended })` (`repos.ts:715-732`) already supports `approvalStatus: "amended"` — corrections present ⇒ amended.
- **Persona/bar:** anxious parent, 11pm, phone. Rows must read as a conversation ("Did we get this right?"), one inference per row, ✓ "That's her" / ✎ "Not quite" — never a settings grid. Therapist locks must explain themselves: "Recommended by her therapist — talk to them before removing."

## Work orders

### DELETE
- None (the read-only `brain-profile` page remains as the data view; its role changes — see EDIT-3).

### CREATE
1. **Review & correct screen** (storyboard screen 5): `apps/web-v2/app/parent/learners/[learnerId]/brain-review/page.tsx` (+ client component). Sections: How {name} learns (comfort levels, modalities), Supports (each accommodation row: display label, plain-language reasoning, source chip, toggle — locked with the therapist-attribution line when `removable === false`), Tutors (keep/release rows). Each row: ✓ confirm / ✎ correct; corrections open inline controls + optional note (one `SoftTextField`, reuse `packages/ui/src/assessment` primitives). Sticky footer: "Save corrections & continue" → records modifications and routes onward to the approve surface (the recap until C-06 lands; the ceremony after). All states: loading, no-profile (route to `brain-clone-watch`), zero-corrections (confirm-all fast path), save-error (kind retry), success.
2. **Types + validator:** `ParentModification` type in `lib/db/types.ts` matching the Python field shape (`field`, `originalValue`, `parentValue`, `parentNote`, `modifiedAt`); extend `brainProfileStateSchema`/`LearnerBrainProfileState.xaiExplanation` with optional `parentModifications: ParentModification[]`.
3. Tests per **Tests**.

### REFACTOR
1. `approveBrainClone` (`repos.ts:715-732`) → accept `modifications?: ParentModification[]`; fold by the Python prefix rules into the **web** state (`accommodation.<slug>` toggles membership in `activeAccommodations` and the matching `supportDefaults` flag; `tutor.<key>` toggles `activeTutors`; comfort fields map to `readingComfort`/`mathComfort`; respect `removable === false` — server-side reject, not just UI lock); append the records to `state.xaiExplanation.parentModifications`; set `approvalStatus: "amended"` when any modification present. Keep idempotency.

### EDIT
1. `brain-clone-watch/building-client.tsx:244-249` — Amend CTA routes to `/parent/learners/[learnerId]/brain-review` (label per C-03 vocabulary, e.g. "Check & adjust"); the hidden `amended` form plumbing in `brain-clone-watch/page.tsx:36-52` is superseded by the new server action that carries modifications (build it as a server action on the review page calling `approveBrainClone` with modifications, or staging corrections then returning to the recap to approve — choose one and document; corrections must never be lost on navigation: persist staged corrections server-side, not in component state only — resume state designed).
2. `brain-profile/page.tsx` Regenerate action (`:39-73`): add a confirm step that states plainly what regeneration does ("rebuilds the profile from your current answers and clears the review you started"); after regenerating, route to `brain-clone-watch` (which handles `pre_clone` via `BrainBuildPending` + rebuild — `brain-clone-watch/page.tsx:89-118`) instead of back to the same page; never strand silently. i18n for all of it.
3. `brain-profile/page.tsx` header: link prominently to the new review screen when `cloneStage === "cloned"` ("Review & adjust before approving").

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report structural-row DoD (this sprint's half), verbatim: **"Parent can mark any inference 'not quite,' adjust it, and approve; corrections persist (web-v2 parity with `parent_modifications`)."**

Verification:
1. End-to-end runtime walk (mock parent): build → review screen → toggle off `read_aloud`-class support + adjust reading comfort + note → approve → `approvalStatus === "amended"`; modifications recorded with original/parent values; **start a lesson (C-01 gate satisfied post-approval) and show the lesson run's `accommodationSnapshot`/`brainStateSnapshot` reflects the correction** (`repos.ts:1908,1945`). Screenshots + JSON in Checkpoint.
2. Therapist-pinned row: server-side rejection test for a forged unlock attempt (not just disabled UI).
3. Regenerate path: confirm-step shown; post-regenerate the parent lands on the pending/rebuild surface, never a silent reset. 
4. Memory/drizzle parity + contract tests green; full suite green.

## Tests

- Extend `lib/db/persistence/__tests__/contract/brain-profiles.contract.ts` + `brain-profiles.parity.test.ts` for `parentModifications` round-tripping.
- New unit tests for the fold rules (each prefix; `removable:false` rejection; amended-status setting) — e.g. `lib/db/__tests__/brain-corrections.fold.test.ts`.
- e2e: review-screen happy path + `@a11y` axe spec for `/parent/learners/[learnerId]/brain-review` (Suite B-02 pattern).
- Run the full suite so C-01..C-04 stay green.

## Out of scope

- Consent/RAI capture, the dedicated approval table, ceremony visuals, decline-archive (all C-06).
- brain-svc code changes (shape parity only; unification is C-12).
- Source chips/confidence dots/share artifact (C-14).

## Depends on

- **C-01** (the gate makes the approve→teach verification meaningful). **C-03** soft (vocabulary). Decision **D2** (default (a)) confirmed at start.

## Checkpoint

Summarize changed files; attach the end-to-end walk evidence (incl. the lesson-snapshot diff proving corrections reached teaching); paste fold/parity test output. **Pause for owner review. Do not commit unless explicitly told to.**

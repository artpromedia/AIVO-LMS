# Sprint C-16 — The contributor feedback loop: "your input shaped Maya's reading plan"

**Stack:** `services/comms-svc` · `services/family-svc` · `apps/web-v2`.
**Report items closed:** Strategic roadmap row "Contributor feedback loop"; §3.6 weakness "No notification to a contributor that their input mattered ('Your observations shaped Maya's reading plan') — the single highest-leverage retention loop for teachers/therapists, absent."

## Goal

At the end of this sprint, a teacher, caregiver, or therapist who gave their time learns what it did: when their contribution is folded into an approved profile (or visibly shifts a support), they receive a warm, specific, privacy-safe note — and each contributor has a small summary surface showing what they've shared and that it's in use. Repeat-contribution becomes measurable. The orchestration loop closes from the contributor's side, the way C-08 closed it from the parent's.

## Context

- **The trigger points (all existing data — re-verified at HEAD `32ece1d3`):**
  - The clone fold records exactly which contributor shaped what: accommodation/tutor decisions carry `source: "collaborator:<role>"` with reasoning snippets (`services/brain-svc/src/brain_svc/services/clone_pipeline.py:187-211`; web parity `apps/web-v2/lib/learner/brain-profile.ts:107-160` — therapist insights pinned non-removable).
  - Approval (C-06) marks the moment those decisions become the **teaching** profile — the honest trigger for "your input is now in use" (folding alone isn't; approval is).
  - Contribution records: `teacher_assessments` (C-07), `therapist_assessments`, `caregiver_observations`/`brain_insights` (`packages/db/src/schema/`); per-contributor status endpoint from C-08.
  - Notification machinery: comms-svc templates + `startSafeCron` (+ ledger) per C-08; notification preferences honored.
- **Privacy constraints (hard):** the note tells a contributor about **their own** input's use only — never another contributor's content, never the child's levels/diagnoses, never parent-private data (the role-scoped philosophy of family-svc `collaboration.ts:745-891` applies to notifications too). "Your communication note kept speech support active for Maya" is fine; "Maya is at LOW_VERBAL" is not. Every template's data surface gets a content-safety test like C-14's share artifact.
- **The metric (report DoD):** "contributor retention measured" — define and implement **repeat-contribution rate**: of contributors whose input was acknowledged, the share who contribute again within 60 days (cohorted before/after acknowledgement shipping where data allows). Computation queryable (admin/analytics endpoint or scheduled report — match where C-14 put its funnel computation); a dashboard is not required.
- **Tone bar:** gratitude without flattery, specificity without disclosure, one optional CTA ("add another observation"). A therapist is a clinical professional; a caregiver may be ESL — one template family, role-aware wording.
- **Cross-track:** consumes C-06 (approval events) and C-08 (contribution data + job conventions); coordinate with any Suite A/B notification work only at the bootstrap-registration level.

## Work orders

### DELETE
- None.

### CREATE
1. **Acknowledgement events:** on approval (C-06's record write — both stacks per C-12's model), derive per-contributor acknowledgement payloads from the profile's collaborator-sourced decisions (role, the contributor's own decision labels/reasoning snippets, learner first name). Idempotent per (contributor, learnerId, profileRevision) — re-approvals don't re-spam unless that contributor's input newly changed something.
2. **Notifications:** comms-svc templates (role-aware: teacher / caregiver / therapist variants) + in-app notifications for account-holding contributors; sent via the event or a `startSafeCron` drainer per comms-svc's existing delivery pattern (match how invites/reminders deliver — C-08); preferences/unsubscribe honored; ledger-capped.
3. **Contributor summary surface:** for each role's existing home (`app/teacher/…`, `app/caregiver/…`, therapist learner pages): a "Your contributions" card per learner — what they've shared (their own items only), whether it's folded into the active profile, and the date acknowledged. States: never-contributed (gentle invite, links to their input flow), contributed-not-yet-approved ("shared — the family is reviewing"), acknowledged. Reuse C-08's contributions endpoint; extend it with the acknowledgement fields rather than adding a parallel one.
4. **Retention metric:** the repeat-contribution computation + its query surface (per Context); seeded test proving the math.
5. Tests per **Tests**; `@a11y` axe additions for the touched contributor surfaces.

### REFACTOR
- None expected; extend C-08's endpoint and C-06's approval write path at their seams.

### EDIT
1. i18n: all new web strings, 10-locale parity (D7); email templates follow comms-svc conventions.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report strategic-row DoD, verbatim: **"Teachers/therapists receive 'your input shaped X' notifications; contributor retention measured."**

Verification:
1. Runtime walk: therapist submits (C-10 flow) → parent approves (C-06) → therapist receives the in-app + email acknowledgement naming **their** folded contribution (show both); the caregiver and teacher variants likewise (one walk each).
2. Privacy: content-safety tests on every template's data surface (no other contributor's content, no levels/diagnoses, no parent-private data) — outputs pasted; a contributor whose input did **not** fold receives nothing (negative test).
3. Idempotency: re-approving the same revision sends no duplicate (test).
4. The summary card renders all three states; the retention metric computes correctly on seeded data (query + result pasted).
5. Axe additions green; full suite green (C-01..C-15 unregressed).

## Tests

- Acknowledgement derivation unit tests (per role; non-folded exclusion; idempotency).
- Template content-safety tests; delivery/preference tests.
- Endpoint extension tests (authz: contributors see only their own items).
- Retention-metric computation test.
- Run the full suite.

## Out of scope

- New contribution flows (C-07/C-10 own those).
- Parent-facing notifications (C-13).
- Any change to fold weighting or approval mechanics.

## Depends on

- **C-06** (approval trigger), **C-08** (contribution data + delivery conventions). C-12 soft (where approval events live).

## Checkpoint

Summarize changed files; attach the three role walks' evidence (in-app + email), the content-safety and idempotency test outputs, the three summary-card states, and the retention computation. **Pause for owner review. Do not commit unless explicitly told to.**

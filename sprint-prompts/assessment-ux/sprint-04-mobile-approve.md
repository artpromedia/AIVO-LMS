# Sprint C-04 — Mobile approve: stop lying (honest handoff now; real approval later)

**Stack:** `apps/mobile` only.
**Report items closed:** Top 10 **#5**; roadmap Quick-win row "Hide/wire mobile approve"; part of trust-underminer #1 (§1.1).
**Decision gate:** **D1** — default and recommended path is **(a) hide + honest web handoff**; option (b) "wire now" requires owner approval and is NOT this prompt's default.

## Goal

At the end of this sprint, the mobile parent brain screen never shows a control that does nothing: the dead "Approve profile" / "Ask for changes" buttons are gone, replaced by an honest, designed handoff that tells the parent exactly where review-and-approve happens and takes them there. The report's DoD — "Mobile approve either POSTs an approval that flips state (verified by re-fetch) or is not rendered" — is satisfied by the not-rendered branch, without shipping a consent-free approval that would repeat web-v2's mistake.

## Context

- **The defect (report §1.1 / §4.1 point 5, re-verified at HEAD `32ece1d3`):** `apps/mobile/app/(parent)/brain-clone-watch/[childId].tsx:179-193` renders, for an unapproved profile, two Buttons — "Approve profile" and "Ask for changes" — whose `onPress` handlers are both `router.push("/(parent)/recommendations" as Href)`. Neither approves nor amends anything. The file's own docblock (`:40-43`) claims it "closes the gap where mobile-only parents couldn't approve the initial clone" — it does not.
- **Why not wire it now (D1 rationale):** a real approval must capture COPPA consent + Responsible-AI acknowledgement — the Python brain-svc `/approve` endpoint rejects without them (`services/brain-svc/src/brain_svc/routes/brain.py:334-346`), and the proper consent/RAI/ceremony UX is being built for web in C-06. Wiring mobile before that exists means either a consent-free approval (against trust rules) or duplicating C-06 on mobile ahead of the pattern. Mobile approval **parity** is an explicit candidate follow-up after C-06/C-12 — flagged in `SPRINT-PLAN.md` Decisions.
- **What stays:** the screen's build-stage list, XAI chips, pending/refresh state (`:69-96`), and the approved state ("You've approved this profile. AIVO is teaching with it.", `:168-177`) — all keep working.
- **Data source:** `useBrain` hook (`apps/mobile/hooks/useBrain.ts`) supplies `approvalStatus`.
- **Conventions:** match the mobile component/test conventions used by functional Suite B sprints 04/05 (mobile stage/a11y) if landed; mobile tests run with vitest (`corepack pnpm --filter @aivo/mobile test` — verify exact script in `apps/mobile/package.json`). i18n: this screen uses `t("brainClone.…", default)` inline defaults — keep that mechanism, update the catalog entries if a mobile catalog exists (verify how `apps/mobile` registers translations and follow it).
- **Deep link target:** the web review page is `/parent/learners/{learnerId}/brain-clone-watch`. Find mobile's canonical web-origin config (grep `apps/mobile` for the env/constant used to build web URLs — e.g. existing `Linking.openURL` call sites) and reuse it; do not hardcode an origin.

## Work orders

### DELETE
1. `apps/mobile/app/(parent)/brain-clone-watch/[childId].tsx:179-193` — both fake buttons and their handlers. Update the docblock (`:40-43`) to describe the real behavior (review on mobile, approve on web — until parity lands).

### CREATE
1. In the same screen, an **honest handoff card** rendered where the buttons were (unapproved state only):
   - Copy (via the screen's i18n mechanism): a one-liner that is true and warm — e.g. "Reviewing and approving {name}'s profile happens on the web for now." plus a clear primary action "Open on the web" that launches the web review URL for this learner via `Linking.openURL` (using the canonical origin per Context), and a secondary "copy link" affordance for parents who read mobile but approve on a laptop.
   - States designed: link-open failure (catch + inline message), no-origin-configured (hide the button, show copy-link only — never a dead tap), loading (inherits screen's existing loading), approved (unchanged existing card).
   - Accessibility: button labels meaningful to screen readers; touch targets ≥ 44pt; works under the app's reduced-motion settings (no new animation introduced).
2. Component test file for this screen (location per mobile test conventions) — see **Tests**.

### REFACTOR
- None.

### EDIT
1. If a mobile translations catalog exists for `brainClone.*`, add the new keys there (all supported mobile locales); otherwise the inline-default mechanism carries them — state which in the Checkpoint.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
  - *(Mobile note: the i18n-catalog rule applies to mobile's own translation mechanism for this screen — verify and use it; web's `en.json` is not the mobile catalog.)*
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report roadmap DoD, verbatim: **"Mobile approve either POSTs an approval that flips state (verified by re-fetch) or is not rendered."** (This sprint satisfies the second branch; if the owner chooses D1(b), the first branch's full consent/RAI capture becomes the DoD and this prompt must be re-scoped before execution.)

Verification:
1. Component tests green: unapproved profile → **no** element with the approve/amend labels renders; the handoff card renders with a working link action; approved profile → unchanged approved card; link-failure state renders its message.
2. `corepack pnpm --filter @aivo/mobile test` green (full mobile suite — previously completed sprints stay green).
3. Manual run (Expo): screenshot of the unapproved screen showing the handoff card, attached to the Checkpoint.
4. Grep proof: no remaining `onPress` in this screen navigates to `/(parent)/recommendations` from an approval-labeled control.

## Tests

- New component test per CREATE-2 (render with mocked `useBrain` returning `approvalStatus: "pending"` and `"approved"`; assert per DoD-1). Mocks are confined to test files, per the standard.
- Run the full repo suite (`pnpm test`) so previously completed sprints stay green.

## Out of scope

- Building mobile consent/RAI/approval UI (candidate follow-up after C-06 and C-12 — see SPRINT-PLAN Decisions D1).
- Web reveal changes (C-03), web approval mechanics (C-05/C-06).
- Mobile string-falsehood fixes already handled in C-03 EDIT-4 (coordinate if running before C-03: do not duplicate edits).

## Depends on

- None hard. Decision **D1** must be answered before execution (default: hide + handoff). Coordinate styling/test conventions with functional Suite B sprints 04/05 if landed.

## Checkpoint

Summarize changed files; attach the unapproved-state screenshot; paste test output; state which i18n mechanism carried the new strings; restate the D1 choice executed. **Pause for owner review. Do not commit unless explicitly told to.**

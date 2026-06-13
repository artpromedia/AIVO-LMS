# Sprint C-06 — The approval ceremony: a deliberate, recorded act (storyboard screens 6–7)

**Stack:** `apps/web-v2` (primary) + `services/brain-svc` (approve audit-event parity; decline archives).
**Report items closed:** Top 10 **#9**; second half of the Structural row "Correction loop (#4) + approval ceremony (#9)"; §4.1 points 5 (ceremony half) & 6 (audit-trail gaps); §4.2 **screens 6 and 7 (initial)**; the decline-destroys-work finding (§1.3 / `brain.py:624-631`).

## Goal

At the end of this sprint, approving a child's learning profile in web-v2 is a deliberate, fully recorded act: the parent sees the Responsible-AI disclosures, gives explicit consent, performs an intentional approve action with a calm ignition moment, and lands on "what happens next" — and the system writes a **dedicated approval record** (actor, action, consent version, RAI version, modifications, profile revision, timestamp) instead of burying consent in display JSON. Approve emits an audit event in **both** stacks, and declining a profile in brain-svc **archives** instead of deleting the child's baseline work.

## Context

- **What's missing today (re-verified at HEAD `32ece1d3`):**
  - web-v2 approve is an unceremonied form POST: button enabled when the animation finishes (`building-client.tsx:255-258`), server action checks only session + parent scope, flips `cloneStage`, audits, redirects to the learner page (`brain-clone-watch/page.tsx:36-52`). **No consent checkbox, no RAI panel, no celebration, no "what happens next."**
  - The RAI content already exists, unrendered: Sprint-A1 selector `getBrainExplainability` with `raiComplianceDetail` — bias mitigations, transparency line, humanOversight ("This brain clone requires parent approval before activation") and `DEFAULT_RAI_COMPLIANCE` (`apps/web-v2/lib/learner/brain-explainability.ts:31-104`, defaults at `:59-68`). `BrainExplainabilityPanel` (Sprint A2) was never built — the symbol exists only in types and the selector.
  - The Python stack defines the target gates: `/approve` rejects without `consent_given` (COPPA) and `rai_acknowledged`, persists both into `xai_explanation` (`services/brain-svc/src/brain_svc/routes/brain.py:330-432`; tested in `tests/test_approve_rai_gate.py`). But: **approve emits no audit event** (clone does — `emit_brain_audit("BRAIN_CLONED", …)`, `brain.py:178-188`), consent lives in JSONB rather than a dedicated table, and **decline deletes the brain, all snapshots, and ALL of the child's `discovery_adventure` attempts** (`brain.py:624-631`) — destroying the child's work.
  - web-v2's `LearnerBrainProfile` has **no version/revision field** (`lib/db/types.ts:476` area) — the approval record needs one.
  - Consent primitives exist: `ConsentRow` from `@aivo/ui/auth` (used in `app/onboarding/child-approval/page.tsx:196-222`), the under-13 consent system (`lib/bff/consent-guard.ts`), `hashIpFromRequest` for consent evidence (`consent-guard.ts:88-96`).
  - The ignition visual exists: `PixiBrainSphere` intensity ramp (used at `components/brain/brain-building-sequence.tsx:339-347`).
- **Persona/bar:** the single most consequential act a parent performs in the product. One screen, one act; calm, not confetti. Approval copy must be honest about what is being approved and reversible-ness ("you can change this anytime" — true after C-05).

## Work orders

### DELETE
- None.

### CREATE
1. **Approval record store** (web-v2 persistence, memory + drizzle parity): table `brain_profile_approvals` — `id`, `tenantId`, `learnerId`, `brainProfileId`, `profileRevision`, `actorUserId`, `action` (`approved | amended | declined`), `consentVersion`, `raiVersion`, `modifications` (JSONB, from C-05), `ipHash` (via `hashIpFromRequest`), `createdAt`. Repo functions: `recordBrainApproval`, `listBrainApprovals(learnerId)`. Contract + parity tests per the brain-profiles pattern.
2. **`revision` field on `LearnerBrainProfile`** — monotonic integer, incremented by `upsertBrainProfile` and the clone commit path (`repos.ts:564-591, 651-678`); backfill default 1 in adapters; parity/contract tests updated. (This is the report's "approval table keyed by brain version" mechanic, §4.2.)
3. **Ceremony screen (storyboard screen 6):** replaces the bare buttons in the recap (`building-client.tsx:235-267`). Contents, in order: one-sentence recap ("You're approving the starting profile AIVO will teach from — you can change it anytime, and it never leaves your team" — only if true; verify "never leaves your team" against data-sharing reality before shipping the phrase, else soften); expandable **RAI panel** rendering `getBrainExplainability` content (data sources, bias mitigations, transparency, human-oversight); an explicit **consent checkbox** (reuse `ConsentRow`); a **deliberate approve action** — hold-to-approve (with full keyboard/switch-accessible alternative: a two-step "Review → Confirm" for non-pointer input; reduced-motion variant: no hold animation, two-step confirm) — disabled until RAI expanded-or-acknowledged AND consent checked (mirror the Sprint-A4 frontend intent described at `brain.py:337-341`).
4. **Ignition + screen 7 ("what happens next"):** on approve success — the sphere intensity ramp (calm; reduced-motion: crossfade), then a panel: tomorrow's first mission (`pickTodaysMission` preview — handle its blocked/ready states), active supports summary, "Invite {name}'s teacher" CTA (links to team page), and "You'll get a note when this profile meaningfully changes" **only after C-13 exists — until then use copy that is already true** (e.g. "You can review this profile anytime"). No claim the backend cannot honor.
5. brain-svc: pytest additions per **Tests**.

### REFACTOR
1. web-v2 approve server action (`brain-clone-watch/page.tsx:36-52` → move beside the ceremony): require `consentGiven` + `raiAcknowledged` fields server-side (reject otherwise — defense-in-depth, same philosophy as `brain.py:337-346`); call `approveBrainClone` (with C-05 modifications if staged); write the approval record (CREATE-1) with `raiVersion` defaulting to the reviewed `profileRevision` (mirror `brain.py:426-431` semantics); keep the existing `audit(session, "brain_profile.approve", …)` and extend metadata with the record id.

### EDIT
1. `services/brain-svc/src/brain_svc/routes/brain.py` — approve handler: emit `emit_brain_audit("BRAIN_APPROVED", …)` with actor/version/consent-version details (parity with `BRAIN_CLONED`, `:178-188`). Amend handler: emit `BRAIN_AMENDED` likewise.
2. `brain.py` decline handler (`:611-635`) — **archive, never destroy**: set `approval_status = 'declined'` on the brain state (keep the row), write a `parent_declined` snapshot, and **do not delete `assessment_attempts`**. Return copy offering rebuild-with-corrections. Update/extend the Python tests accordingly.
3. i18n: all ceremony/next-steps strings in `en.json` + 10-locale parity (D7).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report structural-row DoD (this sprint's half), verbatim: **"approval records consent version, RAI version, actor, timestamp in a dedicated table; approve emits an audit event in both stacks; decline archives instead of deleting baseline attempts."**

Verification:
1. Runtime walk (mock parent): recap → ceremony; approve button disabled until RAI + consent; forged POST without consent → server rejection (test, not just UI); approve → approval record row with actor/versions/ipHash; ignition + screen 7 render. Screenshots (incl. reduced-motion variant) in Checkpoint.
2. pytest: decline preserves `assessment_attempts` (count unchanged) and the brain row (status `declined`); `BRAIN_APPROVED` audit emitted with expected payload; `test_approve_rai_gate.py` still green.
3. Parity/contract tests green for the approval store and `revision`; full repo suite green.

## Tests

- web: server-action rejection tests (no consent / no RAI / forged removable-unlock from C-05); approval-record persistence contract + parity tests; e2e ceremony happy path; `@a11y` axe spec update for the brain-clone-watch route (ceremony state) incl. keyboard-only approve (the two-step path).
- brain-svc: extend `tests/test_approve_rai_gate.py` or add `test_decline_archives.py` + `test_approve_audit_event.py`.
- Run the full suite so C-01..C-05 stay green.

## Out of scope

- Re-approval thresholds, change notifications, change timeline (C-13). Cross-stack model unification + FERPA log (C-12). Share artifact, confidence dots, instrumentation (C-14). Mobile (D1 follow-up).

## Depends on

- **C-05** (corrections feed the ceremony; amended path), **C-01** (gate makes approve meaningful). C-03 soft (copy).

## Checkpoint

Summarize changed files; attach ceremony screenshots (standard + reduced-motion + keyboard path); paste the approval-record row, the rejection-test output, and the decline-preservation pytest output. **Pause for owner review. Do not commit unless explicitly told to.**

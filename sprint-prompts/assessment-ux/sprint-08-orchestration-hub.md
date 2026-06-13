# Sprint C-08 — Multi-source orchestration: the team hub, automatic reminders, and "N of M voices"

**Stack:** `apps/web-v2` · `services/family-svc` · `services/comms-svc`.
**Report items closed:** Top 10 **#8**; Structural roadmap row "Orchestration hub + reminders (#8)"; the **Below bar** orchestration verdict and its ≤2 cells (emotional fit 2, accessibility 2, completion friction 2 — §2, §3.6). Carries the ❓-appendix **accept-invite a11y** verification.

## Goal

At the end of this sprint, a parent can see — on one surface — exactly where each invited teammate stands (**invited → accepted → contributed**), nudge them with one tap, and understand which voices shaped their child's profile ("built from 3 of 4 invited voices"); and the system sends automatic, warm reminder emails (48h accepted-but-not-contributed nudge; pre-expiry warning for token invites) so completion stops depending on the parent remembering to chase people.

## Context

- **What exists (reuse, don't rebuild — report §3.6, re-verified at HEAD `32ece1d3`):**
  - Invites: parent→{teacher,caregiver,therapist} with rate limiting (`services/family-svc/src/routes/collaboration.ts:339-593`); teacher→parent token invites, SHA-256-hashed, single-use, 72h expiry (`:1428-1615`; schema `packages/db/src/schema/collaboration.ts:143-175`); manual resend endpoints (`:1241-1360, 1621-1699`); members listing (`:301-337`); revocation (`:596-642`).
  - Emails: templates in `services/comms-svc/src/lib/templates.ts` (team invite `:134-150`; teacher→parent `:388-407`). comms-svc already runs scheduled jobs via `startSafeCron` + advisory lock + ledger (`services/comms-svc/src/index.ts:80`; `@aivo/scheduling`, `packages/scheduling/src/index.ts`). Notification preferences exist (`apps/web-v2/app/api/bff/notification-preferences/`).
  - Contribution signals already in data: `teacher_assessments` (C-07), `therapist_assessments` (`packages/db/src/schema/assessments.ts:116-139`), `caregiver_observations`/`brain_insights` (`packages/db/src/schema/collaboration.ts`).
  - The parent-facing surface to upgrade: `app/parent/learners/[learnerId]/team/` incl. `team-invite-section.tsx` (statuses humanized in C-03).
  - The "N of M voices" hook: `confidenceSignals` + collaborator counts in the profile state (`lib/learner/brain-profile.ts:588-594, 648-652`) and the C-06 ceremony/recap surface.
- **What's missing (verified absent):** no completion-tracking hub (status badges only); **no automatic reminder system** (comms-svc has billing/IEP reminder jobs, none for invites — confirmed by search); no signal to the parent when the brain was built without a contributor's input; contributors never learn what happened to their input (that last loop is **C-16**, not this sprint).
- **Persona/bar:** the parent must never have to wonder "did Ms. Rivera ever do it?"; the contributor must never get a nagging email tone. Reminder copy: warm, one-CTA, easy opt-out. Statuses in human words (C-03 set the pattern).

## Work orders

### DELETE
- None.

### CREATE
1. **Contribution-status endpoint** (family-svc — single source so web and mobile share it): `GET /api/family/collaboration/:learnerId/contributions` returning, per invited member: kind, displayName/email, invite status, acceptedAt, **contributed** (teacher: completed `teacher_assessments` row; therapist: completed `therapist_assessments`; caregiver: ≥1 observation), lastContributionAt, resendable. Authz: parent-of-learner (reuse `verifyParentOwnership` in `collaboration.ts`) or admin. Note: this endpoint reads `teacher_assessments`/`therapist_assessments` from the shared DB schema (`packages/db`) — verify family-svc has access to those tables via the shared `@aivo/db` package; if service boundaries forbid it, compose in the web-v2 BFF instead and say so in the Checkpoint (the UI contract stays identical).
2. **Team hub upgrade** (`app/parent/learners/[learnerId]/team/`): per-member cards — human status line for each stage (invited / on the team / contributed, with dates), one-tap **Remind** (calls the existing resend endpoints; rate-limit errors surfaced kindly with Retry-After), **Remove** (existing revoke; confirm step), and an empty state that sells the why ("Each voice makes {name}'s profile more complete — invite the people who know them"). Loading/error/success states; mobile-width layout verified.
3. **Reminder jobs** (comms-svc, `startSafeCron` pattern from `index.ts:80`):
   - `invites.contribution-nudge`: members ACCEPTED ≥48h with no contribution → one nudge email (max 1 per member per 7 days — ledger-enforced), warm copy ("{learner}'s family invited you — 10 minutes of your perspective shapes their learning plan"), respecting notification preferences/opt-out.
   - `invites.expiry-warning`: token invites (teacher→parent) expiring within 24h and still PENDING → warning email to the recipient + (optional) surface to the inviter.
   - New templates in `templates.ts` matching existing template conventions; subjects/copy reviewed against the persona bar; unsubscribe/preferences link included like the existing emails.
4. **"N of M voices" chip** on the brain review/ceremony surface (C-06's screen — or the recap if C-06 not yet landed): "Built from {contributed} of {invited} invited voices", with a quiet link to the team hub when contributed < invited; when the profile was built with zero contributor input, an honest line ("Built from your answers and {name}'s adventure — teammates can still add their view"). Data: CREATE-1 endpoint + profile `confidenceSignals`.
5. **Axe specs** (`@a11y`): the team hub route **and `/accept-invite`** (the ❓-appendix verification — fix serious/critical findings on it in this sprint).
6. Tests per **Tests**.

### REFACTOR
- None.

### EDIT
1. Invite emails (`templates.ts:134-150, 388-407`): add the role-aware post-accept destination so an accepted teacher lands at the C-07 assessment (the `next` param C-07 prepared); copy pass for warmth (keep the safe-ignore line).
2. i18n for all new web strings + 10-locale parity (D7).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report structural-row DoD, verbatim: **"Parent sees per-contributor invited/accepted/contributed status; automatic 48h + pre-expiry reminder emails ship from comms-svc; brain review screen displays which sources contributed ('built from 3 of 4 invited voices')."**

Verification:
1. Runtime walk (mock parent, seeded mixed-state team: one pending, one accepted-no-contribution, one contributed): hub renders all three states correctly; Remind fires (show the comms call/log); revoke works with confirm. Screenshots in Checkpoint.
2. Job tests: nudge selects exactly the accepted-≥48h-no-contribution set, honors the 7-day ledger cap and opt-outs; expiry-warning selects PENDING-expiring-<24h; both render their templates (snapshot).
3. "N of M voices" chip shows correct counts in both the partial and zero-contributor cases.
4. Accept-invite axe findings fixed; both new axe specs green; full suite green.
5. Authz: non-parent requesting the contributions endpoint → 403 (test).

## Tests

- family-svc (or BFF, per CREATE-1 outcome) route tests: contribution derivation per role, authz 403.
- comms-svc job unit tests (selection logic, ledger cap, preference filtering) + template snapshots.
- web e2e: hub happy path + remind; `@a11y` specs for hub and accept-invite.
- Run the full suite so C-01..C-07 stay green.

## Out of scope

- Contributor-side "your input mattered" notifications and retention metrics (**C-16**).
- Consent-model changes / FERPA disclosure log (**C-12**).
- Brain-change notifications to parents (**C-13**).
- The teacher wizard itself (C-07).

## Depends on

- **C-07** (teacher "contributed" state must be derivable). **C-06 soft** (ceremony surface for the voices chip — fall back to the recap if C-06 not landed). Cross-track: reuse the `startSafeCron` conventions (`services/comms-svc/src/index.ts:80`); coordinate with Suite A creator jobs only insofar as job registration lives in the same service bootstrap.

## Checkpoint

Summarize changed files; attach hub screenshots (three member states), job-test output, template snapshots, the voices-chip evidence, and the accept-invite axe before/after. State where CREATE-1 landed (family-svc vs BFF) and why. **Pause for owner review. Do not commit unless explicitly told to.**

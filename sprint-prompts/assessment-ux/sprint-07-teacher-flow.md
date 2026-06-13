# Sprint C-07 — The teacher flow: from invite email to a submitted assessment in under ten minutes

**Stack:** `apps/web-v2` (UI + BFF) · `services/assessment-svc` (existing route — system of record) · `services/family-svc` (existing teacher-insights mirror).
**Report items closed:** Top 10 **#6**; Structural roadmap row "Teacher flow (#6)"; the **Below bar** teacher verdict and its all-1s/2s scorecard row (§2, §3.2). Carries the ❓-appendix verification "teacher insight submission on other surfaces".

## Goal

At the end of this sprint, the teacher flow **exists**: a time-poor teacher lands from the invite email, completes a ≤10-minute, autosaving, professionally-framed assessment built from the same form primitives as the parent wizard, sees exactly how long it took and what AIVO will do with their input — and their submission is visible to the parent and folded into the learner's brain clone. The product's most common contributor stops being structurally locked out of the multi-source story.

## Context

- **The void (report §3.2, re-verified at HEAD `32ece1d3`):** two complete backends, zero UI.
  - `POST /api/assessments/teacher` + `GET /api/assessments/teacher/:learnerId/status` (`services/assessment-svc/src/routes/teacher-assessment.ts:98-217`): fields `teacherRole`, `gradeLevel`, `subjectArea`, `strengths[]`, `challenges[]`, `accommodations[]`, `observations`, `recommendedFocusAreas[]`, `additionalResponses` (`:147-172`); everything except `learnerId` optional; permissions TEACHER (ACCEPTED `learner_teachers` link), SPED_LEAD, DISTRICT_ADMIN, PLATFORM_ADMIN (`:60-83`). Table `teacher_assessments` (`packages/db/src/schema/assessments.ts:80-108`).
  - `POST /api/family/teacher-insights` — "writes to the dedicated `teacher_insights` table and mirrors into `brain_insights`" (`apps/web-v2/lib/bff/family-svc.ts:195-202`), proxied at `apps/web-v2/app/api/bff/teacher/insights/route.ts` — **no page or component calls it** (repo-wide search confirmed). The clone's collaborator fold reads `brain_insights` (`services/brain-svc/src/brain_svc/services/clone_pipeline.py:144-212`; web parity `lib/learner/brain-profile.ts:107-160`) — a table no teacher UI can currently write to.
  - `apps/web-v2/app/teacher/` has assignments/classes/insights(read-only)/IEP-draft/reports — no assessment route; `/teacher/insights` is a read-only mastery dashboard (`teacher/insights/page.tsx`).
- **The pattern to reuse — do not invent a new form system:** the parent wizard's primitives in `packages/ui/src/assessment/` (`QuestionCard`, `SoftTextField`, `PillCardGroup`, `AssessmentProgress` — full ARIA already built, see `AssessmentProgress.tsx:54-59`, `PillCardGroup.tsx:120-156`); section-patch draft persistence pattern from the parent assessment (server action validating one step, persisting per-section — `app/parent/learners/[learnerId]/assessment/page.tsx:93-245`); per-step time-left estimate (`:1052-1054`).
- **The therapist BFF is the proxy pattern:** `app/api/bff/learners/[learnerId]/therapist-assessment/route.ts` (session + role + caseload verification, internal service token to assessment-svc).
- **Entry path:** parent invites teacher (family-svc `collaboration.ts:339-593`); accept-invite flow exists (`app/accept-invite/`); teacher invite email template at `services/comms-svc/src/lib/templates.ts:134-150`. The accepted teacher must land one click from the assessment.
- **Persona/bar (report):** "time-poor professional with six spare minutes between classes… sub-10-minute completion path; autosave; professional terminology; framing that maps to school constructs (IEPs, grade-level standards); frictionless invite-link entry with no forced account-creation wall." Target completion copy: "Done in 4:32 — here's what AIVO will do with this."
- **Cross-track:** no functional-suite sprint covers teacher assessments (verified against `sprint-prompts/SPRINT-PLAN.md`). Vocabulary per Suite B-01 / C-03.

## Work orders

### DELETE
- None.

### CREATE
1. **Teacher assessment wizard:** `apps/web-v2/app/teacher/learners/[learnerId]/assessment/` — 4–5 screens using the `packages/ui/src/assessment` primitives:
   - S1 Context: role, grade level, subject area (pill groups) — professional labels, no hand-holding.
   - S2 Strengths first: "What does {name} do well in your classroom?" (strengths[], recommendedFocusAreas[] seeds).
   - S3 What gets in the way + what already works: challenges[], accommodations[] — framed in school constructs ("Which supports are already working — from an IEP/504 or your own practice?").
   - S4 Observations + anything else: observations textarea, optional extras → `additionalResponses`.
   - S5 Review & submit (compact; per-section complete badges, edit links).
   - Up-front honesty: "Under 10 minutes. Autosaves as you go." on the entry screen; per-step time-left; **elapsed time captured** and shown at completion ("Done in {m:ss} — your input now shapes {name}'s starting profile and lessons"). All states designed (loading, resume mid-wizard, validation with kind recovery, submit-error retry, success). Completion screen also states visibility honestly ("Parents see that you contributed and the supports you recommended" — align with actual privacy reality from the report §3.6/family-svc role views; never overclaim).
2. **BFF routes:** `app/api/bff/learners/[learnerId]/teacher-assessment/route.ts` — guards mirroring the therapist BFF (session, role `teacher` (+ admin roles per service contract), **roster scope** via the same mechanism `listLearnersForTeacher`/`requireLearnerScope` uses), then proxy submit to assessment-svc `POST /api/assessments/teacher` with the internal service token; GET proxies the status route. Draft persistence: **web-v2 section-patch store** mirroring the parent-assessment draft pattern (new `web_teacher_assessments` persistence entity or equivalent — memory+drizzle parity tests required); final submit goes to assessment-svc (system of record) **and** mirrors a summary insight via the existing `createTeacherInsight` proxy (`lib/bff/family-svc.ts:195-202`) so the clone fold sees it. Handle the family-svc-unavailable case gracefully (submit still succeeds; mirror retried/flagged — design the state, no silent loss).
3. **Entry points:** card/CTA on `teacher/learners/[learnerId]` detail and the teacher learners list ("Share your read on {name} — under 10 minutes"); accept-invite redirect honors a `next`/intent param so a teacher landing from the invite email reaches the assessment one click after accepting (minimal change to `app/accept-invite/` actions; the email CTA itself is C-08's surface — coordinate, do not edit templates here unless a `next` param is all that's needed).
4. **Telemetry:** completion event with elapsed seconds (follow the pattern of `lib/learner/baseline-telemetry.ts`) — the report's DoD requires median time-to-complete to be measurable.
5. **Axe spec** for the new routes (`@a11y`, Suite B-02 pattern).
6. **Verification task (❓ appendix):** grep `apps/web-admin` (and any other surface) for teacher-insight submission UI; document findings in the Checkpoint (expected: none).

### REFACTOR
- None.

### EDIT
1. Parent team section: show "Contributed ✓" for a teacher whose assessment is submitted (read via the status route) — minimal status surfacing now; the full hub is **C-08** (coordinate; keep this to one badge-state addition).
2. i18n: full key set for the wizard in `en.json` + 10-locale parity (D7).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report structural-row DoD, verbatim: **"Invite email → token-authenticated entry → ≤10-min autosaving assessment → submission visible in parent hub and folded into the clone; completion telemetry shows median time-to-complete."**

Verification:
1. Runtime walk: invited teacher (mock teacher session scoped to a learner) → entry CTA → wizard with autosave (kill the tab mid-step-3, reopen, resume lands on step 3 with steps 1–2 intact) → submit → completion screen with elapsed time → parent team section shows "Contributed ✓" → rebuild/clone for that learner folds the teacher insight (assert via `collaboratorInsights`/`brain_insights` presence in the profile's accommodation/tutor reasoning). Screenshots + evidence in Checkpoint.
2. Authz: teacher without an ACCEPTED link for the learner → 403 from the BFF (test).
3. Telemetry event recorded with elapsed seconds (show the captured event).
4. Axe spec green; full suite green; the ❓ web-admin verification documented.

## Tests

- BFF integration tests (role/scope/draft-patch/submit/mirror-failure handling).
- Wizard validation unit tests (per-section schemas — follow `lib/validators/parent-assessment.ts` pattern with a new `lib/validators/teacher-assessment.ts`).
- Persistence parity + contract tests for the draft store.
- e2e happy path + `@a11y` spec.
- Run the full suite so C-01..C-06 stay green.

## Out of scope

- Reminder emails, the full completion hub, invite-email template rewrites (C-08).
- Caregiver/therapist polish (C-10).
- The clone fold logic itself (exists — both stacks; this sprint only feeds it).

## Depends on

- C-03 soft (vocabulary). No cross-track collision (verified). **C-08 depends on this sprint.**

## Checkpoint

Summarize changed files; attach the resume-after-tab-kill evidence, the fold-into-clone evidence, the 403 test output, and the telemetry event; document the web-admin verification. **Pause for owner review. Do not commit unless explicitly told to.**

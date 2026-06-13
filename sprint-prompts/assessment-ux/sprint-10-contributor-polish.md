# Sprint C-10 — Contributor polish: therapist and caregiver inputs reach the enterprise bar

**Stack:** `apps/web-v2` (primary) · `services/family-svc` (small additions) · `services/assessment-svc` (verification only).
**Report items closed:** Structural roadmap row "Therapist polish"; caregiver scorecard **accessibility = 2** and therapist **accessibility = 2** (§2, §3.3, §3.4). Carries the ❓-appendix **IEP-upload virus-scan verification** (Decision **D6**).

## Goal

At the end of this sprint, the two contributor flows that exist stop losing work and stop leaving their humans guessing: the **therapist** gets an autosaving draft, an honest time estimate, the learner's IEP goals beside the form, proper error association, and a timestamped professional summary of what they submitted; the **caregiver** gets worked ABC examples, the mood field the schema already has, an announced (not silent) success, draft resilience, and a short edit window. Both routes pass axe.

## Context

All findings re-verified at HEAD `32ece1d3`.

- **Therapist (report §3.4):** form at `apps/web-v2/components/therapist/therapist-assessment-form.tsx` (page `app/therapist/learners/[learnerId]/assessment/page.tsx`; BFF `app/api/bff/learners/[learnerId]/therapist-assessment/route.ts`; service `services/assessment-svc/src/routes/therapist-assessment.ts:59-231`). Strengths to preserve: correct clinical fields, all-optional ("Everything is optional"), therapist insights folding as **non-removable** accommodations. Gaps: local-state-only (tab crash loses everything, `:28-37`); no time estimate; no IEP goals visible (forced context-switch); success is an inline box with **no reviewable record** (`:64-71`; copy `en.json:3050-3073`); errors not associated to fields (no `aria-describedby`); single flat card.
- **Caregiver (report §3.3):** ABC observation form `app/caregiver/observations/observation-form.tsx` (page `observations/page.tsx`; family-svc `services/family-svc/src/routes/observations.ts:34-149`). Strengths to preserve: plain parentheticals, 2-required-field friction. Gaps: no examples anchoring ABC for untrained/ESL caregivers; immutable post-submit (no edit/undo); success is a silent `router.refresh()` (`:52`) with no `aria-live`; no draft-on-network-failure; the schema's `mood` column exists (`packages/db/src/schema/collaboration.ts:134`) but the form never exposes it — **verify the live family-svc observations route's accepted fields first** (the audit noted an apparent schema/form field mismatch: form sends antecedent/behaviour/consequence/duration/location; reconcile what the production route actually persists and document it before editing).
- **IEP upload (❓/D6):** `services/assessment-svc/src/routes/iep.ts:377-545` — 10MB cap, pdf-parse, ai-svc parse with raw-text fallback; **no virus scanning found in code**. This sprint: (1) verify whether scanning exists at infra/gateway (search `infra/`, `docker/`, docs); (2) regardless, harden in-code (magic-byte PDF sniffing, content-type allowlist, reject encrypted/active-content PDFs if pdf-parse exposes it); (3) present Decision D6 (integrate AV vs. accept+harden) with findings — actual AV integration, if chosen, is a named follow-up sprint, not this one.
- **Where the IEP goals live** for the therapist side-panel: assessment-svc IEP routes/`iep_goals`; in web-v2, `getIEPForLearner` (used at `app/parent/learners/[learnerId]/brain-profile/page.tsx:117`) — verify the therapist's authorized read path (therapists hold `read_brain_hipaa`/`therapy_goals` permissions — `packages/db/src/schema/collaboration.ts:73`; family-svc therapist brain view `collaboration.ts:840-891`). Use an authorized path; never widen access to do it.
- **Patterns to reuse:** parent-assessment section-patch draft persistence (`app/parent/learners/[learnerId]/assessment/page.tsx:93-245`); `packages/ui/src/assessment` primitives for any restructuring; axe lane per Suite B-02.
- **Personas/bars:** therapist — clinical professional who needs to trust the instrument and keep a record; caregiver — possibly ESL, no formal training, forgiving tone, concrete examples.

## Work orders

### DELETE
- None.

### CREATE
1. **Therapist draft persistence:** autosave (debounced field-level or section-patch — match the parent-wizard mechanism) to a server-side draft keyed by (therapist, learner), restored on return, with a visible "Saved · just now" indicator; survives tab kill.
2. **Therapist IEP side-panel:** read-only panel beside the form listing the learner's active IEP goals + accommodations summary via an authorized path (Context); empty state ("No IEP on file") designed; never renders raw IEP text beyond what the therapist role is entitled to.
3. **Therapist submission record:** post-submit screen/section — timestamped summary of exactly what was shared (discipline, strengths/challenges/accommodations lists, notes), reachable again later (e.g. `app/therapist/learners/[learnerId]/assessment/submitted` reading the existing status/GET route), framing the impact honestly ("feeds {name}'s baseline and lesson personalization" — existing copy is good).
4. **Caregiver examples:** 2–3 inline worked ABC examples (collapsible, i18n'd, plain language — e.g. "Refused to hold the pencil during homework → accepted with hand-over-hand support"), placed before the fields.
5. **Caregiver edit window:** family-svc `PATCH /api/family/observations/:id` allowing the **author** to edit within 15 minutes of creation (ownership + window enforced server-side; audited); web UI shows "Edit" on own observations inside the window, then it disappears. (Append-only history preserved per trust rules: store the prior text in an edit-history field or audit detail — never silently overwrite without trace.)
6. **Axe specs** (`@a11y`): therapist assessment route + caregiver observations route.
7. Tests per **Tests**.

### REFACTOR
1. Therapist form: associate errors to fields (`aria-describedby`/`aria-invalid` per the `SoftTextField` pattern, `packages/ui/src/assessment/SoftTextField.tsx:94-112`); add the up-front time estimate ("About 5 minutes — everything is optional"); keep the single-page layout unless splitting is trivial with the existing primitives (do not over-scope).

### EDIT
1. Caregiver form (`observation-form.tsx`): expose **mood** (optional, gentle picker) — after verifying the live route's field handling (Context); add `aria-live="polite"` success announcement ("Saved — thank you. This helps AIVO see patterns.") instead of silent refresh; localStorage draft restore on network failure (clear on success); keep the 2-required-field minimum.
2. `services/assessment-svc/src/routes/iep.ts`: the in-code upload hardening (magic-byte sniff, content-type allowlist) per Context — small, surgical; document the D6 verification findings.
3. i18n: all new strings (both flows), 10-locale parity (D7).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report structural-row DoD, verbatim: **"Autosaving draft, time estimate, IEP goals shown beside the form, post-submit summary record."** Plus, individually verifiable caregiver items (each from §3.3): examples render; mood persists end-to-end; success announced via `aria-live`; draft survives a simulated network failure; author-only 15-minute edit works and expires.

Verification:
1. Therapist runtime walk: fill half the form → kill tab → return → draft restored with "Saved" indicator; IEP panel shows seeded goals (and the empty state without); submit → summary record screen; revisit later → record still reachable.
2. Caregiver runtime walk: examples visible; submit with mood → mood persisted (show the row); screen-reader announcement verified (axe/manual); edit within window → change + history trace; after 15 min (test clock) → edit gone; network-failure simulation → draft restored.
3. Authz tests: non-author PATCH → 403; therapist draft inaccessible to another therapist.
4. D6 verification findings documented (infra search results + recommendation); in-code hardening tests green.
5. Both axe specs green; full suite green.

## Tests

- Draft persistence (therapist) unit + integration; restore-after-kill e2e.
- family-svc PATCH route tests (ownership, window expiry, history trace, authz).
- Caregiver form tests (mood round-trip, aria-live presence, localStorage draft).
- iep.ts hardening tests (bad magic bytes rejected, oversized handled — existing 413 path kept).
- The two `@a11y` specs. Run the full suite so C-01..C-09 stay green.

## Out of scope

- AV integration itself (named follow-up if D6 chooses it).
- Teacher flow (C-07), orchestration hub (C-08), contributor feedback notifications (C-16).
- Any change to clone-fold weighting (therapist non-removable semantics stay exactly as-is).

## Depends on

- None hard. Decision **D6** resolved by the verification inside this sprint (implementation of AV deferred per its outcome).

## Checkpoint

Summarize changed files; attach the draft-restore evidence (both flows), the IEP-panel and summary-record screenshots, the mood round-trip row, the edit-window expiry proof, and the D6 findings + recommendation. **Pause for owner review. Do not commit unless explicitly told to.**

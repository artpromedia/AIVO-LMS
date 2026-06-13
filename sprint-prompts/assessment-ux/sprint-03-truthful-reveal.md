# Sprint C-03 — Truthful, strengths-first reveal (delete false claims; lead with the child, not the gaps)

**Stack:** `apps/web-v2` (+ all 10 i18n locales) · `apps/mobile` (string verification only).
**Report items closed:** Top 10 **#3** and **#7**; roadmap Quick-win rows "Truthful trust chips + remove grade-gap", "Stage copy re-voice + strengths reorder", "Raw enum cleanup"; trust-underminer #2 (§1.2); §4.1 points 3 & 4 (parent side); storyboard screens 1–2 (initial) and screen 4's deletion half. Carries the ❓-appendix **infra encryption-at-rest verification**.

## Goal

At the end of this sprint, the parent-facing Learning Brain reveal contains **no claim the backend cannot honor** and **no fabricated number**: the "Encrypted (AES-256)" chip, the "no personal data leaves this device" line, and the grade-equivalent/"Gap: Nyr" cards are gone (deletion is shippable progress); the build sequence opens with a **strengths stage** before any levels; every stage title speaks parent language instead of systems language; and the parent team section stops showing raw `PENDING`/`ACCEPTED` enums. The reveal becomes something the company could defend line-by-line in front of a regulator and a parent simultaneously.

## Context

- **The reveal pipeline:** `/parent/learners/[learnerId]/brain-clone-watch` (`apps/web-v2/app/parent/learners/[learnerId]/brain-clone-watch/page.tsx`) builds stage data from `profile.state` and renders `BrainBuildingClient` (`building-client.tsx`) → which plays `MasterToChildClone`, then the cinematic `BrainBuildingSequence` (`apps/web-v2/components/brain/brain-building-sequence.tsx`), then a recap timeline + Approve/Amend. All parent copy lives in the `brain_clone` namespace of `apps/web-v2/lib/i18n/messages/en.json` (all 10 locale files carry these keys — keep parity, Decision D7).
- **The falsehoods to delete (report §4.1 point 4, re-verified at HEAD `32ece1d3`):**
  - `scoreToGradeEquiv(score, enrolled) = score × enrolledGrade` (`brain-building-sequence.tsx:96-98`) feeding "Level: grade {x} · Enrolled: grade {y} · Gap: {z}yr" cards in warning-amber (`:279-301`; keys `building_level`, `building_enrolled`, `building_gap`). Multiplying a normalized score by enrolled grade is not a grade-equivalent by any psychometric standard. **Decision D4 (default): delete entirely; C-14 may later reintroduce grade language only if sourced from the curriculum-svc catalogue.**
  - "Encrypted (AES-256)" chip (`building_activation_encrypted`, rendered at `brain-building-sequence.tsx:350-358`): no AES-256 encryption of brain state exists anywhere (verified: AES-256 appears only in integration credentials, speech transcripts, MFA crypto). Brain state is plain JSONB.
  - "No personal data leaves this device unencrypted" (`clone_privacy_pii`): the build runs server-side; this is at best a confusing description of TLS.
  - "Versioned · rollback any time" (`clone_privacy_versioned`): rollback has no UI and (pre-C-02) no scoping; the claim as written is not honored.
- **The deficit framing to fix (§4.1 point 3):** `STAGE_ORDER = template → domains → accommodations → activation → tutors → complete` (`brain-building-sequence.tsx:68-75`) — gap cards are the second thing a parent sees and **no strengths stage exists**. The learner-side Awakening already demonstrates the right pattern: its "memories" phase selects the child's strongest subjects (`app/learner/brain-clone/[learnerId]/page.tsx:47-53`).
- **Systems language to re-voice:** stage titles/captions in `en.json` — `watch_step_template` "Selecting brain template", `watch_step_domains` "Mapping assessment scores to mastery", `watch_step_paths` "Initializing learning paths", `building_subtitle` "Real-time construction from assessment data", `building_activation_title` "System activation", `building_activation_version` "Brain v1.0", `clone_master_label` "AIVO Master Brain", `building_template_pill` "Grade {grade} Brain template — {level}". The recap's "paths" stage renders **raw tutor slugs** as labels (`brain-clone-watch/page.tsx:228-233`).
- **Vocabulary coordination (cross-track):** functional Suite B sprint-01 owns "brain clone is never parent vocabulary" (readiness CTA → "Review learning profile"). Adopt the same family of terms here ("learning profile", "{name}'s profile"); if B-01 has already landed in this tree, match its exact word choices; if not, do not block — choose "learning profile" and note it for B-01.
- **Enum cleanup:** the parent team section renders raw status enums as badges — `{record.status}` showing `PENDING`/`ACCEPTED` (`apps/web-v2/app/parent/learners/[learnerId]/team/team-invite-section.tsx:228-229`).
- **Quality bar:** 23andMe-results / Spotify-Wrapped — data about a person told as a story. The parent is often anxious, on a phone, at 11pm; the second thing they see must never be a row of deficit cards.

## Work orders

### DELETE
1. `apps/web-v2/components/brain/brain-building-sequence.tsx` — `scoreToGradeEquiv` (`:96-98`) and the gap computation/rendering in the domains stage (`:279-301`): remove `gap`, the `bbs-gap` span and its CSS (`:489`), and the grade-number meta row. Replace the per-domain meta with the **qualitative estimate** already used elsewhere ("growing / confident / advanced" — derive from the same mapping the watch page uses at `brain-clone-watch/page.tsx:148-162`, passed down via the DTO; extend `MasteryDecisionDTO` with the estimate label rather than re-deriving from score).
2. `apps/web-v2/lib/i18n/messages/*.json` (all 10): remove `building_gap`, `building_level`, `building_enrolled`, `building_activation_encrypted`, `clone_privacy_pii` keys (and their render sites: `brain-building-sequence.tsx:350-358` chips area; `master-to-child-clone.tsx` — locate `clone_privacy_pii` usage by key).
3. The `building_activation_version` "Brain v1.0" chip and `clone_master_label` "AIVO Master Brain" naming (re-key/re-copy per EDIT-2 — delete the keys if the elements are removed outright).

### CREATE
1. **Strengths stage** in `BrainBuildingSequence`: add `"strengths"` to `STAGE_ORDER` **before** `"domains"`. Content: 3–5 cards — the child's top interests and "good at" items from the parent assessment (`strengths` section: `loves`, `goodAt`, `motivates` — see `lib/validators/parent-assessment.ts`) and strongest subjects (`masteryOverview` filtered to `confident`/`advanced`, falling back gracefully when none — mirror the Awakening's selection at `app/learner/brain-clone/[learnerId]/page.tsx:47-53`). Wire the data in `brain-clone-watch/page.tsx`: it already loads the profile; additionally load the parent assessment (`getOrCreateParentAssessment` is exported from `lib/db/repos.ts`) and pass a `strengths` prop through `BuildingSequenceData`. New i18n keys: stage title + caption (strengths-first tone, e.g. "What lights {name} up"). Empty state designed (no strengths recorded → warm fallback drawing on strongest baseline subjects only). Reduced-motion: the stage participates in the existing fast/motion-free cadence (`brain-building-sequence.tsx` header comment) — verify, don't fork.
2. New e2e axe spec covering `/parent/learners/[learnerId]/brain-clone-watch` (recap state) following `apps/web-v2/e2e/role-a11y.playwright.ts` (`@a11y` tag, mock parent cookie, `injectAxe` + `checkA11y`) — rides the Suite B-02 lane.

### REFACTOR
1. Recap "paths" stage (`brain-clone-watch/page.tsx:228-233`): map tutor slugs to display names via `TUTORS` from `@aivo/brand` (the sequence already imports it — `brain-building-sequence.tsx:32`).

### EDIT
1. Re-voice the `brain_clone` namespace in `en.json` (then all locales): every stage title/caption in parent language, strengths-first, zero "system/template/version/master/clone-as-noun" vocabulary. Minimum set: `watch_title`, `watch_description`, `watch_step_*` (7), `watch_step_done`, `building_title`, `building_subtitle`, `building_template_pill`, `building_template_caption`, `building_domains_title/caption`, `building_accommodations_*`, `building_activation_*` (what remains of it), `building_tutors_*`, `building_complete_*`, `clone_eyebrow`, `clone_caption`, `clone_master_label`/`clone_child_label` (re-concept: e.g. "AIVO" → "{name}'s profile"), `pending_title/description`. Honesty rule: replacement privacy copy may state only what is true. **First complete the ❓ verification task:** search the repo/infra (`infra/`, `docs/security`, `docs/compliance`, helm values) for evidence of disk/at-rest encryption; record findings in the Checkpoint; only then write the replacement line (safe default that is true regardless: "Private to your family and the team you invite" linking to the privacy page).
2. The learner Awakening copy (`awakening_*` keys) is **good** — leave it; verify no deleted key is referenced by it.
3. `team-invite-section.tsx:228-229`: humanized, i18n'd statuses — e.g. PENDING → "Invited — waiting to join", ACCEPTED → "On the team", REVOKED → "Removed" (new keys under the parent team namespace; tone per catalog).
4. **Mobile string verification:** grep `apps/mobile` for equivalent claims (`AES`, `encrypted`, `Gap`, `grade equivalent`, the `brainClone.*` i18n defaults in `apps/mobile/app/(parent)/brain-clone-watch/[childId].tsx`). Fix any falsehood found in mobile's string defaults in-place (string-only; mobile flow changes are C-04).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data, empty function bodies, `not implemented` errors, or "in a real implementation…" comments. Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.
- **UX rules:** every state designed (loading, empty, error, success, resume); WCAG AA contrast on all changed UI; a reduced-motion variant for every animation; learner sensory/accessibility preferences honored wherever they apply; all user-facing strings added to the i18n catalog (`apps/web-v2/lib/i18n/messages/en.json`), never hardcoded; parent-facing copy is strengths-first, plain-language, free of "system/template/version" jargon — and free of any claim the backend cannot honor.
- **Trust rules (for any sprint touching approval, consent, or brain access):** enforcement lives server-side with regression tests against every lesson pipeline it guards; authorization tests prove a non-related role gets 403 and a teacher cannot read `disabilitySignals`; decline/reset paths archive — they never destroy a learner's work.

## Definition of done

Report roadmap DoDs, verbatim:
- **"No parent-facing string claims encryption that isn't implemented; `building_gap` and `scoreToGradeEquiv` removed; domains stage shows qualitative estimates only."**
- **"Build sequence opens with a strengths stage; no stage title contains 'template,' 'system,' or a version string; tutor names render instead of slugs."**
- **"No `PENDING`/`ACCEPTED` enum strings rendered to parents (team-invite-section)."**

Verification:
1. `grep -rn "AES\|scoreToGradeEquiv\|building_gap\|Gap:" apps/web-v2 apps/mobile --include='*.ts*' --include='*.json'` → zero parent-facing hits (test files excluded with justification).
2. Runtime walk of the full reveal (mock parent, fresh clone): strengths stage renders first after template intro; screenshots of each stage attached; reduced-motion (`prefers-reduced-motion`) walk also captured.
3. New axe spec green; full web suite green; all 10 locale files key-synced (`python3`/`node` key-diff pasted in Checkpoint).
4. The ❓ encryption-at-rest verification findings documented.

## Tests

- Unit: stage-order test asserting `strengths` precedes `domains`; a test asserting removed i18n keys are absent and all locales share key sets for the `brain_clone` namespace.
- e2e: the new `@a11y` spec (CREATE-2); extend any existing brain-clone-watch e2e to the new stage count.
- Run the full suite so previously completed sprints stay green.

## Out of scope

- The approve/amend mechanics and ceremony (C-05/C-06). Source-attribution chips, confidence dots, contribution counts, share artifact (C-14).
- Mobile flow changes beyond string fixes (C-04).
- The learner Awakening (already strong — strings verified only).

## Depends on

- None hard. Coordinate vocabulary with functional Suite B sprint-01 (see Context). C-05/C-06/C-14 build on this copy.

## Checkpoint

Summarize changed files; paste the falsehood-grep proof, the locale key-diff, stage screenshots (standard + reduced-motion), and the encryption-at-rest verification findings; note the vocabulary choice made and whether B-01 had landed. **Pause for owner review. Do not commit unless explicitly told to.**

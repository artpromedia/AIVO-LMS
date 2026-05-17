# Parent onboarding journey (Sprint 06)

This document is the contract for the parent-to-active-learner journey.
Every page in this journey must:

- have a real route under `apps/web-v2/app/parent/learners/...`
- enforce the right consent (per `docs/compliance/consent-matrix.md`)
- emit the right audit event (per `docs/audit-event-taxonomy.md`)
- never dead-end (every state has an actionable next-step in
  `apps/web-v2/lib/learner/readiness.ts::READINESS_NEXT_STEP`)

`scripts/onboarding-audit.mjs` (root script `onboarding:audit`) walks
the readiness state machine and fails CI if any of those is violated.

## Readiness state machine

Defined in `apps/web-v2/lib/db/types.ts::ReadinessState` and computed
in `apps/web-v2/lib/learner/readiness.ts::computeReadinessFor()`.

```
profile_created
    │   parent submits ≥1 assessment section
    ▼
assessment_needed
    │   parent submits final assessment section
    ▼
iep_optional
    │   parent uploads IEP OR explicitly skips
    ▼
baseline_needed
    │   learner completes baseline
    ▼
ready_for_today_mission
    │   learner completes ≥1 lesson run
    ▼
active_learning
```

Each transition is data-driven, not button-driven. A parent who skips
the assessment and tries to start baseline gets routed back to
assessment. The mock auth surface (Sprint 03) does not exempt this
state machine.

## Step-by-step contract

### 1. Account creation (Sprint 03)

| Surface | Path | Consent required |
|---|---|---|
| Signup | `/signup` | none — collection happens immediately after via the consent block |
| Email verification | `/verify-email` (Sprint 03b) | none |
| Consent block | `/parent/consent` | none — this IS the consent surface |

The consent block must be completed before any learner can be created.
The minimum consents to create a learner: `parent_account_terms`,
`parent_privacy_policy`. The minimum to persist any learner data:
`child_data_collection`.

### 2. Learner creation

| Surface | Path | Consent required | Audit event |
|---|---|---|---|
| Add a learner | `/parent/learners/new` | `parent_account_terms` + `parent_privacy_policy` + `child_data_collection` | `learner.created` |
| Learner list | `/parent/learners` | (per-learner consent guards on the per-learner panels) | n/a |

The new-learner form must collect: display name, DOB or age range
(drives the age gate and `AgeGateRecord.requiresParentConsent`), grade
band, preferred pronouns (optional), accessibility flags (high
contrast, dyslexia-friendly font, reduced motion — preferences live
under `/parent/learners/[id]/accessibility`).

### 3. Parent assessment

| Surface | Path | Consent required | Audit |
|---|---|---|---|
| Assessment landing | `/parent/learners/[id]/assessment` | `child_data_collection` | `assessment.started` |
| Submit section | BFF `POST /api/bff/learners/[id]/parent-assessment/submit` | `child_data_collection` | `assessment.section.submitted` |
| Review submitted | `/parent/learners/[id]/assessment/review` | `child_data_collection` | n/a |

Section list (drives the parent assessment progress bar):

1. Basics (name, pronouns, languages spoken at home)
2. Strengths (what the learner does well, interests)
3. Background (school history, prior interventions)
4. Learning profile (modality preference, pace, motivation drivers)
5. Sensory profile (sensitivities, regulators, comfort routines)
6. Communication profile (verbal, AAC, gestural, mixed)
7. Attention & executive function (focus length, transition supports)
8. Support & accommodations (current accommodations, parent goals)

Every section must persist independently — the parent can leave and
return without losing work.

### 4. IEP upload (optional)

| Surface | Path | Consent required | Audit |
|---|---|---|---|
| IEP landing | `/parent/learners/[id]/iep` | `iep_document_storage` + `child_data_collection` | `iep.viewed` |
| Upload | BFF `POST /api/bff/learners/[id]/iep-upload` | same | `iep.upload` |
| Extract | BFF `POST /api/bff/learners/[id]/iep-upload/extract` | same | `iep.extract` |
| Review extraction | `/parent/learners/[id]/iep/review` | same | `iep.review.confirmed` / `iep.review.corrected` |
| Skip | BFF `POST /api/bff/learners/[id]/iep-upload/skip` | same | `iep.skipped` |
| Delete | BFF `DELETE /api/bff/learners/[id]/iep-upload` | same | `iep.delete` |

The upload UI must surface every state — never appear "instantly
done":

| State | When | UI |
|---|---|---|
| `uploading` | bytes in flight | progress bar |
| `scanning` | virus / malware scan | "Scanning…" |
| `parsing` | text extraction | "Reading your IEP…" |
| `extracted` | structured fields produced | "Confirm what we found" → review screen |
| `confirmed` | parent accepted extraction | green check on landing |
| `corrected` | parent edited extraction | green check + audit `iep.review.corrected` |
| `failed` | scan/parse failed | error card + "Try again" + "Skip this step" |

Teachers never see raw IEP text (Sprint 04 contract). The extraction
review screen is parent-only.

### 5. Brain profile review

| Surface | Path | Consent required | Audit |
|---|---|---|---|
| Brain profile review | `/parent/learners/[id]/brain-profile` | `ai_personalization` + `child_data_collection` | `brain.profile.reviewed` |
| Regenerate | BFF `POST /api/bff/learners/[id]/brain-profile/regenerate` | same | `brain.profile.regenerated` |

The brain profile must surface, parent-readable:

- Functioning level (Standard / Supported / Low Verbal / Non-Verbal /
  Pre-Symbolic; see `packages/brand::FUNCTIONING_LEVELS`)
- Disability signals (e.g. dyslexia indicators) — described in
  parent-facing language, never as diagnostic claims
- Active accommodations (the union of IEP-derived and parent-supplied)
- Active tutors (Nova, Sage, Spark, …) filtered by age tier
- Visual identity (learner avatar/color)
- XAI explanation — "we chose Sage as a primary tutor because your
  parent assessment said reading is a current focus"

The regenerate action emits a Brain snapshot for the audit trail and
must require fresh `ai_personalization` consent if the prior consent
version is stale.

### 6. Baseline launch

| Surface | Path | Consent required | Audit |
|---|---|---|---|
| Baseline landing | `/parent/learners/[id]/baseline` (parent can launch on learner's behalf) | `child_data_collection` | `baseline.started` |
| Learner baseline player | `/learner/baseline` | `child_data_collection` | per-item answer events |

After baseline completion, the learner moves to
`ready_for_today_mission` and Sprint 07's LessonRun loop takes over.

## Audit script

`scripts/onboarding-audit.mjs` (root script `onboarding:audit`) enforces:

1. Every `ReadinessState` is listed in `READINESS_LABEL`,
   `READINESS_TONE`, and `READINESS_NEXT_STEP` in
   `apps/web-v2/lib/learner/readiness.ts`.
2. Every `READINESS_NEXT_STEP[*].hrefTemplate` resolves to a real
   `page.tsx` under `apps/web-v2/app/`.
3. Every onboarding page in the table above has a corresponding
   `page.tsx` on disk.
4. The corresponding BFF endpoints exist under
   `apps/web-v2/app/api/bff/learners/[learnerId]/...` and pass
   consent:audit (Sprint 04).

## Verification

```bash
pnpm onboarding:audit
pnpm consent:audit
pnpm test --filter @aivo/web-v2 -- learner/readiness
```

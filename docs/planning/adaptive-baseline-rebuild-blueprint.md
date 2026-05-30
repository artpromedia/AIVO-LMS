# Adaptive Baseline Assessment — Platform Assessment & Rebuild Blueprint

> **Purpose**: Fix the baseline assessment so difficulty is genuinely
> dynamic (adapts item-by-item to the learner) instead of a hardcoded,
> fixed-form question set.
>
> **Format**: Two voices.
> **Part I** is the Team Lead / Platform Director's bird's-eye assessment
> across the AIVO portfolio, ending in assignments.
> **Part II** is the Product Manager's engineering blueprint that turns
> those assignments into buildable work.
>
> **Status**: Draft for engineering review · Date: 2026-05-30

---

# PART I — Team Lead Memo (Platform Director)

**To**: Product Manager
**From**: Platform Lead
**Re**: Baseline assessment is not adaptive — portfolio review + your assignments

## 1. The one-paragraph problem

The baseline assessment a learner actually sees today is a **fixed-form
quiz**. The full question set is generated up front and the difficulty
of what comes next never reacts to how the child is doing. We *already
own* a working adaptive engine — it is just not plugged into the product.
We do not have a missing-technology problem; we have a **wiring,
calibration, and content problem**. That is good news: the rebuild is an
integration effort, not a research project.

## 2. What I found across the portfolio

I reviewed every AIVO/legacy repo in the `artpromedia` org that touches a
baseline/diagnostic assessment. Every team independently reached the same
conclusion — adaptivity via Item Response Theory (IRT) — but each got
partway and stopped. We should harvest, not reinvent.

| Repo | Stack | What they built for adaptive difficulty | Reusable for us? |
|------|-------|------------------------------------------|------------------|
| **aivo-learning-saas** | Fastify + TS | `assessment-svc` with a **2PL IRT** engine: MLE θ estimation, Fisher-information item selection, SE-based termination, item banks (MATH/ELA/SCIENCE, 50+ items, difficulty −2.5…+2.5), 5 functioning-level formats, **67 passing tests** | **★ Best reference.** Closest to our stack. Port the MLE + Fisher selection + test suite. |
| **aivo-pro** | Python | `baseline-assessment-svc/src/core/irt_engine.py` — **3PL** engine (D=1.7), difficulty clamped to a **grade-level scale (0.5–12.0)**, full item-bank DB schema, BKT in the learning service | Port the **θ → grade-level placement** mapping and the item-bank SQL schema. |
| **aivo-platform** | TS + Python | `baseline-svc/src/lib/adaptiveDifficulty.ts` (IRT-inspired) **plus** `ml-recommendation-svc/src/models/irt/` (real **3PL `ThreePLModel`**, Fisher-info selection, item-bank stats) | Port the Python 3PL as the **offline calibration** reference. |
| **aivo-ai-learning** | TS (Next/Fastify) | **Discovery Adventure**: Bayesian ability estimator (IRT-based CAT) with a **per-domain posterior** and an explicit **frustration threshold** ("never more than 1 SD above ability"); pre-generated, quarterly-refreshed content per grade band | Port the **frustration-aware item selection** and pre-generation/caching strategy. This is the most learner-kind design. |
| **aivo-agentic-ai-learning-app** | TS + Python | AI-generated items tagged with **3PL params (difficulty, discrimination, guessing)**; `baseline_sessions.ability_estimates_json`; `adaptiveSelection.ts` (Fisher info); **item recalibration endpoints** | Port the **item-recalibration loop** (turn live response data back into calibrated `b` params). |
| **aivolearning** | TS + Flutter | `learning-svc/.../adaptiveDifficulty.ts`, `synthesizeBaseline()` over domain scores, NATS events, Flutter parity screen | Reference for **event schema** + multi-domain score synthesis. |
| **aivo (v1)** | Python | `assessment-svc/app/assessment_engine.py` `QuestionBank`, `BaselineAnswerRequest` schema | Historical; superseded. |
| **aivo-v2** | TS | `BaselineAssessmentAgent` (LLM agent), mock questions, *planned* difficulty adjustment | Confirms the "LLM-only, never finished adaptivity" trap to avoid. |
| **aivo-v5** | TS | LLM baseline + `AssessmentDataProcessor` (baseline → model-personalization training data) | Reference for **feeding baseline output downstream** into the brain clone. |

**Portfolio takeaway**: at least four sibling teams built a *real* IRT
selector. The strongest single reference is **aivo-learning-saas**
(same stack as us, 2PL + Fisher + tests). We do not need to design an
algorithm — we need to pick the best existing one and wire it in.

## 3. What *this* repo (AIVO-LMS) already has — and the actual gap

Three things exist here, and they are not connected to each other:

1. **A real adaptive engine — already built.**
   `packages/adaptive-baseline/src/index.ts` is a clean, dependency-free
   **1-PL Elo-style CAT**: θ update after every answer
   (`recordResponse`), Fisher-info confidence (`infoSum`), item selection
   that minimises |difficulty − θ| (`pickNextItem`), SE-based early stop
   (`shouldStop`, SE≤0.35, 6–20 items), and a rich `LearningProfile`
   output (modality fit, processing speed, frustration tolerance). This
   is genuinely good and **not hardcoded**.

2. **The live product runs a fixed form and never calls that engine.**
   `apps/web-v2/lib/db/repos.ts → createBaseline()` builds the whole
   question set up front via a ladder: Discovery-Adventure LLM → flat LLM
   → **hardcoded BANK fallback** (`apps/web-v2/lib/learner/baseline.ts`,
   ~27 MCQs). Difficulty is a **4-value enum**
   (`foundational | approaching | grade_level | stretch`) chosen *once*
   from a static comfort "bias" (`pickDifficulties`). Nothing re-selects
   based on answers. The adaptive engine is imported **only** by
   `services/assessment-svc/src/routes/learner-profile.ts` — which the
   web app's baseline runner does not drive.

3. **The item banks are not calibrated for the engine.**
   The engine needs each item's `difficulty` on a **θ logit scale**.
   `packages/item-bank` items carry an *optional* `IrtParams {a,b}` that
   is largely unpopulated; the live BANK uses the 4-value enum instead.
   So even if we wired the engine in tomorrow, item selection would be
   flying blind.

**Net gap statement**: *Orphaned engine + uncalibrated bank + fixed-form
live flow.* Fix those three and the baseline becomes dynamic.

## 4. End-to-end, market-ready gaps (beyond "difficulty")

Adaptivity is necessary but not sufficient for "market ready." My
bird's-eye list of what else has to be true before we sell this:

- **G1 — Adaptivity wired into the product** (the headline fix).
- **G2 — Item-bank calibration**: every served item has a θ-space `b`
  (seeded from grade band, refined by live data). Without this, "adaptive"
  is cosmetic.
- **G3 — Content depth & exposure control**: enough calibrated items per
  (subject × grade band) that the selector has room to move and items
  don't over-expose/leak. Today's ~27-item BANK cannot support a 6–20
  item adaptive run across 6 domains.
- **G4 — Cold-start & priors**: use parent assessment + IEP + grade band
  to set a starting θ so we don't always begin at 0 (anxiety + wasted
  items). Prior art: aivo-ai-learning's per-domain posterior.
- **G5 — Frustration / kindness guardrails**: never push a struggling
  child past ~1 SD above ability; honour the existing `frustrationRate`
  and break cadence. Prior art: aivo-ai-learning frustration threshold.
- **G6 — Output contract downstream**: the `LearningProfile` + θ must
  feed the brain-clone/personalization (see `commitBrainClone`,
  aivo-v5 `AssessmentDataProcessor`) so the baseline *means* something.
- **G7 — Accessibility parity**: adaptive path must preserve read-aloud,
  light-reading item preference, picture/switch-scan modes already in
  `@aivo/ui` baseline components.
- **G8 — Parent transparency & trust**: parent summary must explain
  placement honestly ("friendly check-in," not "test") — tone is already
  specified in `docs/ux/UX-07-baseline-assessment.md`; keep it.
- **G9 — Telemetry & psychometric QA**: capture per-item response data to
  drive recalibration (G2) and detect bad items (defect tracking already
  exists in `packages/item-bank`).
- **G10 — Migration safety**: ship behind a flag, keep the fixed-form
  path as fallback, prove parity before flipping default.

## 5. Your assignments (Product Manager)

I'm handing you the end-to-end ownership. Produce an engineering-ready
blueprint that the team can execute against. Specifically:

- **A1.** Define the **target architecture** that connects the live
  `createBaseline`/runner flow to the existing `@aivo/adaptive-baseline`
  engine via `assessment-svc`. Decide engine choice (keep 1-PL vs. adopt
  the aivo-learning-saas 2PL) with a rationale.
- **A2.** Specify the **item-bank calibration plan** (G2/G3): the `b`
  seeding rules, the recalibration loop ported from
  aivo-agentic-ai-learning-app, and the per-(subject×grade) coverage bar.
- **A3.** Specify **cold-start priors** from parent assessment + IEP (G4).
- **A4.** Specify **kindness guardrails** and how they compose with the
  existing break/affect signals (G5/G7).
- **A5.** Define the **API contract** and the **data-model migration**
  (calibrated items, sessions, profile persistence).
- **A6.** Define **rollout** (flag, parity gate, fallback) and the
  **market-ready Definition of Done** covering G1–G10.
- **A7.** For each workstream, name the **sibling-repo asset to port** so
  engineering reuses rather than reinvents.
- Phase it so we can demo a single-subject adaptive run early.

— Platform Lead

---

# PART II — Product Manager Blueprint (engineering-ready)

**Owner**: Product Manager · **Audience**: Engineering · **Tracking**: epics below

## 0. Goal & non-goals

**Goal**: Replace the fixed-form baseline with a **dynamic, adaptive**
baseline whose item difficulty adjusts after every answer, reuses the
engine we already own, and emits a `LearningProfile` that downstream
personalization consumes.

**Non-goals (this initiative)**: rewriting the engine math from scratch;
removing the Discovery-Adventure *content* style (we keep the warm
emoji-rich UX — we change *how items are selected*, not the look); a full
psychometric research program (we ship a pragmatic calibration loop).

## 1. Success metrics

| Metric | Today | Target |
|--------|-------|--------|
| Baseline that adapts item-by-item to answers | 0% (fixed form) | 100% of runs (flagged → default) |
| Median items to reach SE(θ)≤0.35 | n/a | ≤ 12 items |
| Calibrated items per (subject × grade band) | ~0 (enum only) | ≥ 25 |
| Runs that start from an informed prior θ (not 0) | 0% | ≥ 80% (those with parent assessment/IEP) |
| Learners pushed >1 SD above ability ("frustration over-reach") | unbounded | < 5% of items |
| Baseline → brain-clone profile populated | partial | 100% |

## 2. Target architecture (A1)

```
Learner UI (apps/web-v2/app/learner/baseline/[baselineId])
        │  start / answer / complete  (server actions + BFF)
        ▼
BFF  apps/web-v2/app/api/bff/learners/[id]/baseline/*
        │  HTTP
        ▼
assessment-svc  /api/assessments/adaptive-baseline/:learnerId/{start,respond,finalize}
        │  (these routes ALREADY exist in learner-profile.ts)
        ▼
@aivo/adaptive-baseline  (initBaseline → pickNextItem → recordResponse → shouldStop → finalize)
        │  reads
        ▼
@aivo/item-bank  (CALIBRATED items: each has θ-space b)  ──► sessions/profile persisted in @aivo/db
```

**Engine decision**: **Keep the in-repo 1-PL `@aivo/adaptive-baseline`
as the v1 runtime** (it is tested, dependency-free, already wired to
`assessment-svc`), and **port aivo-learning-saas's 2PL MLE + Fisher
item-selection as a v1.1 upgrade behind the same interface.** Rationale:
1-PL gets us *dynamic difficulty in production fastest*; 2PL adds
discrimination weighting once items are calibrated. Both satisfy the same
`pickNextItem/recordResponse` contract, so the swap is internal.

**The decisive change** is in `apps/web-v2/lib/db/repos.ts`:
`createBaseline` must stop returning a pre-baked `BaselineQuestion[]` and
instead **open an adaptive session** (seed θ, persist session id); the
runner then pulls **one item at a time** from
`/adaptive-baseline/:learnerId/respond`. The Discovery/LLM ladder is
retained only as a **content source for the calibrated bank**, not as the
per-run question generator.

## 3. Workstreams (epics)

### EPIC 1 — Wire the engine into the live flow (G1) `[P0]`
**Files**: `apps/web-v2/lib/db/repos.ts` (`createBaseline`,
`recordBaselineAttempt`, `completeBaseline`),
`apps/web-v2/app/learner/baseline/[baselineId]/page.tsx`
(`answerAction`, `completeAction`),
`apps/web-v2/app/api/bff/learners/[learnerId]/baseline/*`,
`services/assessment-svc/src/routes/learner-profile.ts`.

- Add a BFF client (mirror `apps/web-v2/lib/learner/baseline-llm.ts`
  style) that calls the existing `/adaptive-baseline/*` routes.
- `createBaseline` → call `…/start`: returns first item + session id;
  persist session id on the `Baseline` row.
- `answerAction` → call `…/respond`: returns next item **or** a "stop"
  signal; the UI renders one item at a time (it already renders
  `LearnerQuestionCard` per question — feed it from the stream).
- `completeAction` → call `…/finalize`: returns `LearningProfile`; persist
  and hand to `commitBrainClone`.
- **Port from**: aivo-learning-saas `assessment-svc` start/answer/complete
  route shape.
- **Acceptance**: a learner can complete a baseline where item *N+1*
  difficulty demonstrably depends on the correctness of item *N*; no
  pre-baked full set exists in the response.

### EPIC 2 — Calibrate the item bank (G2/G3) `[P0]`
**Files**: `packages/item-bank/src/schema.ts` (already has
`IrtParams {a,b}`), `packages/item-bank/src/seed-*.ts`,
`packages/item-bank/src/seed-baseline-fallback.ts`,
`packages/item-bank/src/validate.ts` (coverage report).

- Make `IrtParams.b` (θ-space difficulty) **required** for any item that
  can be served in an adaptive baseline; map the legacy 4-value enum to
  seed `b` values (`foundational≈−1.0, approaching≈−0.3, grade_level≈+0.4,
  stretch≈+1.2`) as a starting calibration.
- Raise coverage bar to **≥25 calibrated items per (subject × grade
  band)**; extend `validate.ts` coverage report to **fail CI** below the
  bar. Use Discovery/LLM generation (existing) as an *authoring* feeder to
  reach volume, then calibrate.
- Add an **item-recalibration job** that consumes live response telemetry
  (EPIC 5) to refine `b` (and `a` for 2PL).
- **Port from**: aivo-agentic-ai-learning-app recalibration endpoints
  (`/baseline/recalibrate/{item_id}`, `/baseline/batch-recalibrate`);
  aivo-pro item-bank SQL schema.
- **Acceptance**: coverage report green; `pickNextItem` always has ≥3
  unseen candidates within ±0.5 logits of θ for each served domain.

### EPIC 3 — Cold-start priors from parent/IEP (G4) `[P1]`
**Files**: `createBaseline` (already loads `getBrainProfile` +
`findParentAssessment`), `@aivo/adaptive-baseline` `InitBaselineOptions`
(already accepts `priorTheta` + `readingDifficulty`).

- Derive a starting θ per domain from parent-assessment answers +
  functioning level + IEP signals; pass as `priorTheta`. Carry
  `readingDifficulty` into the engine (it already up-weights
  `lightReading` items).
- **Port from**: aivo-ai-learning per-domain posterior seeding.
- **Acceptance**: ≥80% of runs with a submitted parent assessment start at
  θ≠0; median items-to-converge drops vs. cold start (track in metrics).

### EPIC 4 — Kindness guardrails + accessibility parity (G5/G7) `[P1]`
**Files**: `@aivo/adaptive-baseline` (`pickNextItem`, `shouldStop`,
frustration fields already present), `apps/.../baseline/[baselineId]`
(break cadence every 5 items already implemented), `@aivo/ui/baseline/*`.

- Enforce a **frustration ceiling**: never select an item with
  `difficulty > θ + 1.0`; tighten when `frustrationRate`/affect signals
  fire (the engine already captures `AffectSignal`).
- Preserve read-aloud, picture-based, switch-scan modes on the adaptive
  path (these are `@aivo/ui` components; ensure the streamed item carries
  the same surface/accommodation fields the fixed-form path did).
- **Port from**: aivo-ai-learning frustration-threshold logic.
- **Acceptance**: <5% of served items exceed θ+1 SD; all accommodation
  modes work in an adaptive run; break cards still fire.

### EPIC 5 — Telemetry, persistence & psychometric QA (G6/G9) `[P1]`
**Files**: `packages/db/src/schema/assessments.ts`
(`adaptiveBaselineSessions`, `learnerProfiles` already exist),
`packages/item-bank` defect tracking, `apps/web-v2/app/api/bff/admin/baseline-metrics`.

- Persist every `ItemResponse` (θ trajectory, latency, affect, modality)
  to feed EPIC 2 recalibration and item-defect detection.
- Surface an admin psychometric view (item p-values, exposure, defects).
- **Port from**: aivolearning NATS event schema; item-bank defect
  auto-retirement.
- **Acceptance**: a finalized run writes a full response log + a populated
  `learnerProfiles` row; recalibration job can read it.

### EPIC 6 — Rollout, parity gate, downstream contract (G6/G8/G10) `[P0 gate]`
**Files**: `apps/web-v2/lib/feature-flags.ts` (baseline flags already
exist), `createBaseline` (keep BANK path as fallback), parent summary
pages, `commitBrainClone`.

- Ship behind `baselineAdaptiveEnabled` flag; **keep the fixed-form BANK
  as the fallback** when the flag is off or the service errors (mirror the
  existing Discovery→LLM→BANK ladder discipline).
- **Parity gate** before default-on: adaptive path must match or beat
  fixed-form on completion rate and parent-summary quality in a pilot
  cohort.
- Keep the **UX-07 tone** ("friendly check-in") in the parent summary;
  show honest placement.
- Confirm θ + `LearningProfile` flow into the brain clone
  (`commitBrainClone`) so the baseline drives personalization.
- **Acceptance**: flag flip is reversible; fallback proven; DoD (below)
  fully green for one subject end-to-end, then all six.

## 4. Data-model migration (A5)

- `item-bank` items: `IrtParams.b` **required** for baseline-eligible
  items (was optional); add `calibrationSource` (`seed` | `live`) +
  `lastCalibratedAt`.
- `adaptiveBaselineSessions` (exists): ensure `state` jsonb persists the
  full `BaselineState` incl. `priorTheta` provenance.
- `learnerProfiles` (exists): already holds `thetaPlacement`,
  `modalityFit`, `frustrationTolerance`, etc. — ensure 100% populate on
  finalize.
- Add response-log table (EPIC 5) keyed by session + item for
  recalibration.

## 5. API contract (A5)

Reuse the **existing** `assessment-svc` routes; the work is contract
discipline, not new endpoints:

```
POST /api/assessments/adaptive-baseline/:learnerId/start
  body:  { subjectIds[], priorTheta?: Record<domain, number>, readingDifficulty?: bool }
  200:   { sessionId, item: ServedItem, progress: { n, min, max } }

POST /api/assessments/adaptive-baseline/:learnerId/respond
  body:  { sessionId, itemId, correct, responseTimeMs, affect?, consumedModality? }
  200:   { item: ServedItem | null, stop: bool, reason, se, progress }

POST /api/assessments/adaptive-baseline/:learnerId/finalize
  body:  { sessionId }
  200:   { profile: LearningProfile, finalTheta, itemsAdministered }

GET  /api/assessments/learner-profile/:learnerId   → latest LearningProfile
```

`ServedItem` carries prompt/choices **plus** the accommodation + surface
fields the current `BaselineQuestion` carries, so `@aivo/ui` renders it
unchanged.

## 6. Phasing

- **Phase 0 (spike, ~1 sprint)**: EPIC 1 + EPIC 2 minimum for **one
  subject (math)**. Demo: dynamic difficulty end-to-end behind flag.
- **Phase 1**: EPIC 2 full calibration + EPIC 3 priors + EPIC 4
  guardrails across all six domains.
- **Phase 2**: EPIC 5 telemetry/recalibration + EPIC 6 parity gate →
  default-on. Optional: swap 1-PL → 2PL (aivo-learning-saas port).

## 7. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Thin calibrated bank starves the selector | EPIC 2 coverage gate fails CI < 25 items/(subj×grade); LLM authoring feeder |
| Mis-seeded `b` makes early adaptivity wrong | Seed from enum + grade band, refine via EPIC 5 live recalibration |
| Adaptive run feels colder than Discovery Adventure | Keep emoji/warm UX; change selection, not presentation; UX-07 tone gate |
| Service error mid-run | Fixed-form BANK fallback retained (EPIC 6), reversible flag |
| Accessibility regressions on streamed items | EPIC 4 parity tests for read-aloud/picture/switch-scan |

## 8. Definition of Done — market-ready (maps to G1–G10)

- [ ] **G1** Live baseline selects each next item from learner answers (no pre-baked set).
- [ ] **G2** Every served item has a θ-space `b`; recalibration job runs.
- [ ] **G3** ≥25 calibrated items per (subject × grade band); coverage CI green.
- [ ] **G4** Informed prior θ from parent assessment/IEP for ≥80% of eligible runs.
- [ ] **G5** <5% of items exceed θ+1 SD; affect signals tighten selection.
- [ ] **G6** θ + `LearningProfile` populate the brain clone on finalize.
- [ ] **G7** Read-aloud / picture / switch-scan parity on the adaptive path.
- [ ] **G8** Parent summary keeps UX-07 "friendly check-in" tone, honest placement.
- [ ] **G9** Full per-item response log persisted; admin psychometric view.
- [ ] **G10** Flagged rollout, proven fixed-form fallback, parity gate passed before default-on.

## 9. Reuse ledger (what to port, from where)

| Need | Port from | Asset |
|------|-----------|-------|
| 2PL MLE + Fisher selection (v1.1) | aivo-learning-saas | `assessment-svc` IRT engine + 67 tests |
| θ → grade-level placement | aivo-pro | `irt_engine.py` grade scale (0.5–12.0) |
| Offline 3PL calibration reference | aivo-platform | `ml-recommendation-svc/models/irt` |
| Frustration-threshold CAT + per-domain prior | aivo-ai-learning | Discovery Adventure adaptive algorithm |
| Item recalibration loop | aivo-agentic-ai-learning-app | `/baseline/recalibrate` endpoints |
| Multi-domain score synthesis + events | aivolearning | `synthesizeBaseline`, NATS subjects |
| Baseline → personalization handoff | aivo-v5 | `AssessmentDataProcessor` |

---

*Prepared from a direct review of `packages/adaptive-baseline`,
`packages/item-bank`, `apps/web-v2/lib/learner/baseline*.ts`,
`apps/web-v2/lib/db/repos.ts`, `services/assessment-svc`, and a code-search
review of the sibling AIVO repos in the `artpromedia` org.*

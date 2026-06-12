# AIvo-LMS — Production Readiness Audit

**Scope:** Read-only audit of whether AIvo-LMS delivers its core promise — *adaptive learning for neurodiverse learners* — end-to-end.
**Method:** Real code-path tracing (entry → route → service/agent → data → UI). Every verdict cites `file:line`. Docs/README/marketing were **not** accepted as evidence of working features.
**Date:** 2026-06-11 · **Branch audited:** `claude/relaxed-shannon-3f0aph` (HEAD `6f02cc44`).
**Note on `claude/blissful-ritchie-8f7ya1`:** that branch is an **ancestor of the audited HEAD** (fully merged at `d67b3412`); its work — waves A–F (honest baseline provenance, term-syllabus UI, per-subject delivery, approval governance, CCSS K-8 catalogue, summer bridge, the entire tutor-agent stack S7–S13, "all 14 tutors onboarded", core-journey spec) — **is already reflected** in this audit. Nothing in this report asks you to rebuild it; the gaps below are what remains *after* that merge.

---

## 1. Executive Summary

### Verdict: 🟥 **NOT READY** (for the platform as specified) — but the adaptive spine is genuinely real

This is **not a hollow demo**. A learner can be onboarded, take a real multi-source baseline, be placed at their functioning level by a real down-leveling transform, receive a real generated lesson, complete it, and have mastery tracked — all on production Postgres with no mocks in the critical chain (J1, J5). Syllabus alignment (J3), the holiday/summer-bridge path (J4), and a real human-in-the-loop recommendation/approval loop (J5) are wired end-to-end. The tutor-agent infrastructure (J2) is real (real Claude via LiteLLM, real guards/ladder/policy). Much of this is production-quality engineering.

**But three of the seven specified pillars are not delivered as promised, and they are the differentiators of the core promise:**

1. **Unique per-tutor learning surfaces (J7 / spec §2) — NOT WIRED.** A full 16-surface library exists, but the production lesson player mounts only a generic `choice_grid`/`math_expression` for **all 14 tutors**. Math, reading, coding, music, speech, and art all render the same multiple-choice-or-text-box. The `.strict()` lesson-plan schema actively *rejects* a domain `surfaceType`, and no generator ever emits one. The spec's explicit "math vs. reading should **not** share one generic surface" is violated.
2. **"14 fully-built domain tutors" with grade-level content (J2 / spec §1, §6) — INFLATED.** Only **3** tutors (Nova/math, Sage/ELA, Pixel/coding) have hand-authored content, and only at **Kindergarten** (5 activities each). The other **11** are backed by a single template factory that emits 3 generic activities with **identical answer choices across every subject**. All 14 declare `PRE_K–12 = "authored"` via project-owner *attestation*, not the SDK's own content bar — while the item bank tops out at K-8 and the expansion subjects recycle 5 questions.
3. **Sunday-night Creator pipeline (J6 / spec §4) — ABSENT.** There is no "Creator" agent and no Sunday/weekly lesson-generation scheduler. The scheduling primitive cannot even express a day-of-week. Lessons are generated **on demand** at lesson-start instead — a real, brain-wired path, but a deliberate, documented divergence from the specified architecture.

Additionally, the **agentic adaptation that is marketed is off by default** (`tutorAgenticMode` defaults `false`), **non-load-bearing by design**, and its real-LLM decision quality is **unproven** (the passing gate uses a *fake* model).

**Bottom line tied to the core promise:** the **adaptation engine** (baseline → functioning-level transform → placement → mastery → human-approved recommendations) is real and could support a **narrow pilot** (e.g., Nova/math at K, agent off). The **product as specified** — 14 domain-unique, fully-authored, agentically-adaptive tutors generating weekly playable lessons — is not what ships today. Hence **NOT READY**, with a clear pilot-viable subset (see §4).

### Readiness at a glance

| Pillar | Status |
|---|---|
| Learner can learn end-to-end (J1) | ✅ Real, DB-backed |
| Baseline from parent/IEP/teacher/therapist/caregiver (J5 / §5) | ✅ Real, all sources consumed |
| Down-level + up-scaffold + approval loop (J5 / §6) | ✅ Real (up-scaffold approval-gated by design) |
| Syllabus alignment (J3 / §7) | ✅ Real (live-only; explicit 2nd step) |
| Holiday/next-grade path (J4 / §8) | ✅ Real (opt-in; live-only) |
| Tutor agent infra (J2 / §1) | 🟡 Real but **off by default**, non-load-bearing, quality unproven |
| **Unique per-tutor surfaces (J7 / §2)** | 🔴 **Not wired — one generic surface for all** |
| **14 tutors fully built w/ content (J2 / §1, §6)** | 🔴 **3 of 14 thin (K-only); coverage attested, not content-backed** |
| **Sunday-night Creator pipeline (J6 / §4)** | ⬜ **Missing (on-demand instead)** |

---

## 2. Capability Matrix

### 2a. Architecture spec (§1–§8)

| # | Spec requirement | Status | Evidence |
|---|---|---|---|
| §1 | Tutors are domain agents that start/adapt/complete a lesson | 🟡 | Agent loop real: `services/tutor-svc/src/agent/orchestrator.ts:490-770`; real LLM `services/ai-svc/src/ai_svc/services/llm_gateway.py:186`. **But** off by default (`packages/feature-flags/src/enterprise-flags.ts:266`) and non-load-bearing (`orchestrator.ts:20`); start/complete actually run on the deterministic player `packages/tutor-runtime/src/index.ts:133` |
| §2 | **Each tutor has a unique, domain-specific learning surface** | 🔴 | Player mounts only generic surfaces: `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx:136-155` (`?? choice_grid/math_expression`); schema forbids domain `surfaceType`: `apps/web-v2/lib/validators/lesson.ts:110-157` (`.strict()`) |
| §3 | Each tutor has an attached Creator agent generating playable lessons | 🟡 | No "Creator" agent exists; functionally satisfied by on-demand `generateLessonPlanWithRetry` `apps/web-v2/lib/ai/tutor.ts:96`, brain-wired `apps/web-v2/lib/db/repos.ts:1883,1949,1975` |
| §4 | **Creators wired to Orchestrator + Learning Brain; Sunday-night weekly generation** | ⬜ | No scheduler generates lessons: `packages/scheduling/src/index.ts:274-348` (12 jobs, none generate lessons); cannot express day-of-week: `index.ts:118-128`. Team documents the on-demand choice: `services/admin-svc/src/lib/pacing-advance.ts:16-20` |
| §5 | Baseline from parent (req'd) + IEP + teacher/caregiver/therapist | ✅ | Tables `packages/db/src/schema/assessments.ts:50,80,116,141`; routes `services/assessment-svc/src/routes/{parent,teacher,therapist}-assessment.ts`; consumed `services/assessment-svc/src/routes/learner-baseline.ts:1196-1217`; parent required+enforced `learner-baseline.ts:695` |
| §6 | Bring grade-level material down → scaffold up; recommendations → approval | ✅ | Down: `packages/level-transforms/src/index.ts:28-47` + `packages/scoring/src/delivery-level.ts:98`; up: approval-gated `services/recommendation-svc/src/services/progression-candidates.ts:105`; approval loop `services/recommendation-svc/src/routes/recommendations.ts:111-263` |
| §7 | Parent/teacher add school syllabus; AIvo aligns served content | ✅ | Parser `services/ai-svc/src/ai_svc/services/term_syllabus_parser.py`; tables `packages/db/src/schema/term_syllabus.ts:15,44`; injected into generation `apps/web-v2/lib/db/repos.ts:1901,3353` |
| §8 | Holiday path preparing learner for next grade | ✅ | `services/brain-svc/src/brain_svc/services/next_grade.py:107` + `pacing_engine.py:173`; surfaced `lesson-player.tsx:914-918` (`summer_bridge` badge) |

### 2b. End-to-end journeys (J1–J7)

| Journey | Status | One-line verdict + key evidence |
|---|---|---|
| **J1 — Learner lifecycle** | ✅ | Real e2e on Postgres; chain does not break. Onboarding `apps/web-v2/app/onboarding/learner/new/page.tsx:74` → baseline runner `apps/web-v2/app/learner/baseline/[baselineId]/page.tsx` → plan `repos.ts:1281` → player `lesson-player.tsx` → complete `repos.ts:2308` → mastery EWMA `repos.ts:2197-2214`. Cosmetic gaps only (XP/streak, snapshot mockup) |
| **J2 — Tutor agentic capability** | 🔴 | Infra real but off/non-load-bearing & unproven; content thin: 3/14 real (K-only), 11/14 template stubs (`packages/content-pack/src/seeds/authored-subject-catalog-2026.ts:13-66`) |
| **J3 — Syllabus alignment** | ✅ | Ingest→parse→store→pace→deliver all real; **caveat:** full-term path needs an explicit "Generate pacing plan" click and a live brain-svc (`apps/web-v2/lib/bff/school-calendar.ts:362-385`) |
| **J4 — Holiday path** | ✅ | Real next-grade logic from the 628KB catalogue; **caveat:** opt-in + live-only + degrades to plain holiday prep at grade-8 ceiling |
| **J5 — Baseline → progression** | ✅ | All 4 inputs real & consumed; down-level real; up-scaffold + approval real. **Nuance:** the numeric grade (θ) is computed from Discovery quiz accuracy, not from the four inputs (`services/assessment-svc/src/services/learning-profile.ts:131`) |
| **J6 — Creator pipeline** | ⬜ | No Creator agent, no Sunday scheduler; on-demand generation instead (real & brain-wired) |
| **J7 — Learning surfaces** | 🔴 | 16-surface library exists; production player renders one generic surface for all 14 tutors |

---

## 3. Gap Report

> Severity key: 🚨 Blocker (breaks the core promise as specified) · ⚠️ Major (significant, not strictly blocking the spine) · ℹ️ Minor.
> Several gaps are already tracked by the team's own docs (`docs/quality/tutor-k12-coverage-gap-plan.md`, `docs/E2E_JOURNEY_GAP_ANALYSIS_2026-06.md`); those are noted so this report does not duplicate planned work.

---

### GAP-1 🚨 Unique per-tutor learning surfaces are not wired into the production player (J7 / §2)

**What's wrong.** A complete library of 16 domain surfaces exists and is independently tested (`packages/learner-surfaces/src/types.ts:4-20`; components `NumberLineSurface`, `CodingSandboxSurface`, `ReadingAnnotationSurface`, `MusicSequencerSurface`, `ArtCanvasSurface`, `GeometrySurface`, …). But the production lesson player derives a surface type **per item, not per tutor**, and always falls back to two generic surfaces:

```
// apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx:136-138
surfaceType:
  (g as { surfaceType?: SurfaceRouterItem["surfaceType"] }).surfaceType ??
  (g.choices?.length ? "choice_grid" : "math_expression"),
```

The cast reads a field that **does not exist on generated items**: `GeneratedLessonPlanSchema` is `.strict()` and its `guidedPractice`/`checksForUnderstanding` objects define only `prompt/expectedAnswer/choices/hint/scaffold/skillId/media` — **no `surfaceType`** (`apps/web-v2/lib/validators/lesson.ts:110-157`). So an AI plan that emitted `surfaceType: "number_line"` would *fail validation* → retry → deterministic fallback, which also emits none. Verified directly: the deterministic generator sets `surfaceType` only for video/audio media (`apps/web-v2/lib/learner/lesson-plan.ts:285`), and a repo-wide grep finds **no production code** setting any domain surfaceType. The rich surfaces are reachable only from a prod-disabled fixture (`apps/web-v2/app/learner/lesson-player-fixture/page.tsx` → `notFound()` in production), Storybook, and tests.

**Why the team's `ux:matrix 16/16` gate misses it.** `scripts/subject-tutor-ux-check.mjs` verifies *catalog integrity* (subject→tutorKey→TutorDefinition→starter pack→routes exist on disk) and parses a *declared* `SURFACE_CAPABILITY_REGISTRY` table (`subject-tutor-ux-check.mjs:139-153`). It never traces generator→schema→player, so it cannot catch that the runtime mounts a generic surface.

**Root cause.** The lesson-plan contract (the `.strict()` Zod schema shared by the AI provider and the deterministic generator) has no field to carry a domain surface or its payload, so the player has nothing to switch on except `choices?`.

**Fix guidance.**
- **Extend the lesson-plan contract.** Add an optional, discriminated `surface` object to each guided/check item in `GeneratedLessonPlanSchema` (`apps/web-v2/lib/validators/lesson.ts`): `{ type: LearnerSurfaceType, spec: <per-type payload> }`, validated per surface (reuse the specs in `packages/learner-surfaces`). Keep it optional so legacy plans still parse; default-render `choice_grid`/`math_expression` when absent.
- **Emit surfaces in both generators.** In `apps/web-v2/lib/learner/lesson-plan.ts`, branch by `subject.tutorKey` (not just reading/math) to choose a domain surface + build its spec from the skill/item data (number line for early math, decodable passage for reading, code sandbox for Pixel, notation/sequencer for Cadence, mic/voice for Echo, canvas for Muse, geometry workspace for geometry skills). In `apps/web-v2/lib/ai/anthropic-tutor.ts`, add surface guidance to the system prompt and supply per-surface few-shot shapes.
- **Mount in the player.** `lesson-player.tsx` already imports `SurfaceRouter`; pass the validated `surface` through `toSurfaceItem` instead of the `?? choice_grid` fallback, and replace the hardcoded fixture defaults in `toSurfaceItem` (number line always 0-10, geometry always a fixed rectangle, coding always `// write your solution`) with content-derived specs.
- **Add a real runtime gate.** New script that loads a generated plan per tutor and asserts the player resolves a *non-generic* surface where the domain warrants it — so this can't silently regress again.
- **Integration points:** lesson-plan validator, both generators, `SurfaceRouter`, item-bank (to source real per-surface data).
- **Effort:** ~3–5 eng-weeks for a meaningful subset (math/number-line, reading/passage, coding/sandbox first), more to cover all 14 with authored per-surface payloads.

---

### GAP-2 🚨 "14 fully-built tutors" is inflated: thin content + attested (not content-backed) coverage (J2 / §1, §6)

**What's wrong.**
- **Only 3 tutors have real authored content, K-only.** Nova (`packages/content-pack/.../math-k-fall-2026`, 5 K activities), Sage (`ela-k-fall-2026`, 5), Pixel (`coding-k2-fall-2026`, 5). The other **11** tutors' default packs come from one factory that emits exactly 3 activities — a narration, a multiple-choice whose **choices are identical for every subject** ("Observe, explain, then choose" / "Guess without checking" / "Skip every step"), and an empty-answer voice prompt:

```
// packages/content-pack/src/seeds/authored-subject-catalog-2026.ts:42-46
choices: [
  { id: "observe", label: "Observe, explain, then choose", correct: true },
  { id: "guess",   label: "Guess without checking",        correct: false },
  { id: "skip",    label: "Skip every step",               correct: false },
],
```

- **Coverage is attested, not content-backed.** Every mode declares `PRE_K–12 = "authored"` (e.g. `services/tutor-svc/src/modes/mathTutor.ts:36-51`) — yet Nova references only the K pack (`mathTutor.ts:35`). The SDK defines `"authored"` as "real skill graph **AND** ≥1 mapped item-bank entry" (`packages/tutor-sdk/src/types.ts:118-133`), but nothing cross-checks the matrix against content; the string is self-asserted. The team's own doc confirms bands were flipped to `"authored"` by **"the project owner's human-review attestation"** while the 9–12 skill graphs remain `version: "0.1.0-draft"` LLM drafts (`docs/quality/tutor-k12-coverage-gap-plan.md`, header). The expansion-subject item bank ships **5 unique questions per subject**, recycled across 20 items with the grade string-interpolated into the stem (`packages/item-bank/src/seed-expansion-subjects.ts:95-118`).

- **Safety/trust angle.** The runtime uses `coverageMatrix` to gate session-start (`packages/tutor-sdk/src/types.ts:115-118`). Inflated "authored" means the system will happily start, say, a Grade-12 math session that has *no* authored content and rely entirely on runtime LLM generation — exactly the silent-degradation the team's wave-A work tried to kill.

**Root cause.** `coverageMatrix` is a hand-edited declaration with no machine check against actual item-bank/skill-graph content; content authoring (the expensive part) lagged the catalog wiring.

**Fix guidance.**
- **Make coverage truthful by construction.** Add a gate (extend `pnpm curriculum:coverage` / `scripts/curriculum-coverage-check.mjs`) that flips a band to `"authored"` **only** if the skill graph is non-draft *and* ≥N real item-bank entries exist per skill/difficulty. Fail CI if a mode declares `"authored"` for a band that doesn't meet the bar. Until then, downgrade over-stated cells to `"scaffold"` so the runtime surfaces "authoring in progress" and refuses to serve them as production content.
- **Author real content for the launch subset.** Prioritize the 3 already-real tutors to a shippable grade range (e.g., Nova/Sage K–2), then the next tier. Replace the `authoredPack()` template with genuine per-subject items; retire the identical-choices shell.
- **This is already the subject of `docs/quality/tutor-k12-coverage-gap-plan.md`** — adopt that plan but add the machine check above so attestation can't outrun content.
- **Integration points:** `packages/content-pack`, `packages/item-bank`, `packages/skill-graphs`, `packages/tutor-sdk` validator, the coverage gate.
- **Effort:** content authoring is the long pole — weeks-to-months per subject for credentialed authoring; the truthfulness gate is ~3–5 days.

---

### GAP-3 ⚠️ No Sunday-night Creator / weekly lesson-generation scheduler (J6 / §3, §4)

**What's wrong.** The spec calls for "every Sunday night each Creator generates the coming week's lessons for each learner." There is **no Creator agent** and **no scheduled lesson generation**. The fleet scheduler's job registry has 12 jobs and **none generate lessons** (`packages/scheduling/src/index.ts:274-348`); the closest, `curriculum.pacing-advance`, only advances week *status* via one SQL UPDATE (`services/admin-svc/src/lib/pacing-advance.ts:49-65`). The primitive is period-based and **cannot express a day-of-week** — `isDue` only checks elapsed ≥ period (`packages/scheduling/src/index.ts:118-128`), so "Sunday night" is unrepresentable. Lessons are generated **on demand** at lesson-start, which the team documents as an intentional choice ("Lessons are generated on demand when a learner starts … pre-generating LessonRuns would require a standard→skill mapping that does not exist yet", `pacing-advance.ts:16-20`).

**Severity rationale.** Rated **Major, not Blocker**, because the *user outcome* the Creator is meant to produce — per-learner, per-tutor, brain-tailored **playable** lessons — **is** achieved by the on-demand path (`apps/web-v2/lib/db/repos.ts:1865-1995`, brain-wired at `:1883/1949`, persisted playable plan at `:1975`). What's missing is the **batch/scheduled** architecture and the "agent" framing, plus the benefits a pre-generation pass would bring (offline packs, ahead-of-time human review of a week's content, predictable cost).

**Root cause.** Deliberate architectural divergence (lazy generation) plus a missing standard→skill mapping needed to pre-materialize runs.

**Fix guidance.**
- **If the weekly-batch architecture is a hard requirement:** add a day-of-week capability to `@aivo/scheduling` (cron-style schedule, or a `nextRunAt`-based ledger) and register a `creator.weekly-generation` job (owner: a new worker in `learning-svc` or `ai-svc`). For each active learner × enrolled subject/tutor, resolve the week's pacing focus (already available: `learner_pacing_weeks` + `getActiveCurriculumFocus`), call the existing `generateLessonPlanWithRetry`, and persist pre-built `LessonRun`+`GeneratedLessonPlan` rows in a `planned` state the player can pick up. Reuse the on-demand generator wholesale — only the *trigger* and *storage timing* are new.
- **Build the missing standard→skillId mapping** (`pacing-advance.ts:18` calls it out) so pre-generated runs target real skills.
- **Cheaper alternative that meets the spirit:** keep on-demand generation but add a **Sunday "week preview"** job that materializes the *plan list* (topics/skills per day) and optionally pre-warms the first lesson — gets ahead-of-time parent visibility and review without pre-generating every run.
- **Integration points:** `@aivo/scheduling`, a new worker service, `repos.createLessonRun`/`generateLessonPlanWithRetry`, `learner_pacing_weeks`, brain-svc pacing.
- **Effort:** ~2–3 eng-weeks for the cron capability + weekly job reusing the existing generator; +1–2 weeks for the standard→skill mapping.

---

### GAP-4 ⚠️ Agentic tutor adaptation is off by default, non-load-bearing, and quality-unproven (J2 / §1)

**What's wrong.** The marketed in-lesson agent (observe answer → insert scaffold/remediation/break) is real (real Claude via `litellm.acompletion`, `services/ai-svc/src/ai_svc/services/llm_gateway.py:186`; real orchestrator/guards/ladder, `services/tutor-svc/src/agent/orchestrator.ts:490-770`) but:
- **Off by default:** `tutorAgenticMode.defaultValue: false` and the metadata still labels it "Nova pilot … Nova (math) only" (`packages/feature-flags/src/enterprise-flags.ts:257-266`). It also requires `INTERNAL_SERVICE_TOKEN` to be live.
- **Non-load-bearing by design:** every non-action path returns a deterministic decision (`orchestrator.ts:20`), so the lesson runs on the deterministic player regardless.
- **Decision quality unproven:** the green `tutor:behavior` gate runs the real orchestrator but with a **faked model** that shifts pre-scripted replies off an array (`services/tutor-svc/scripts/agent-behavior-harness.ts`). It proves the guard/ladder/policy plumbing for all 14 — **not** that the real LLM makes good domain decisions for any tutor.

**Severity rationale.** Major: this is a marketed differentiator, but because the deterministic path is load-bearing, the platform still functions with the agent off.

**Fix guidance.**
- **Prove quality before flipping the flag on:** stand up an eval harness that runs the *real* model against the eval corpus / red-team suite per tutor and scores action appropriateness + safety; gate enablement on passing scores, not on the fake-model plumbing test.
- **Reconcile the stale metadata** (`enterprise-flags.ts:260`) with the actual all-14 roster (`apps/web-v2/lib/bff/agent-pilot.ts:20-38`) so operators aren't misled.
- **Decide the rollout:** keep off until per-tutor eval scores clear a bar; enable progressively (start with Nova/math where content is real).
- **Effort:** ~2–4 eng-weeks for a real-model eval harness + scoring; enablement is config.

---

### GAP-5 ⚠️ Syllabus & holiday paths are live-only and have a non-obvious second step (J3, J4)

**What's wrong (not stubs — operational caveats).** The full-term syllabus path delivers to the learner **only after** a separate "Generate pacing plan" action, and that handler (plus all pacing reads and the summer bridge) is **live-only** — without `INTERNAL_SERVICE_TOKEN` + a running brain-svc it returns `UPSTREAM_UNAVAILABLE` (`apps/web-v2/lib/bff/school-calendar.ts:362-385`). Saving a syllabus alone does not auto-pace it. (The weekly "this week at school" upload path *is* automatic and unaffected.) These fail closed honestly, but mean J3-fullterm and J4 do nothing in an environment lacking that token + brain-svc + curriculum-svc.

**Fix guidance.** (a) Trigger pacing generation automatically on syllabus save (or make the required second step unmissable in the UI). (b) Document the hard runtime dependency (brain-svc + curriculum-svc + internal token) in the deploy runbook and verify it in `prod:check`. (c) Consider a degraded read-only alignment when brain-svc is down rather than a blank focus. **Effort:** ~3–5 days.

---

### GAP-6 ℹ️ Gamification + one parent page are cosmetic/hardcoded (J1)

**What's wrong.** XP / level / engagement-streak on the learner home read a real `LearnerEngagement` row, but **nothing writes it** — lesson completion issues no XP/streak update and the only values come from seed math (`apps/web-v2/lib/.../seed.ts` derives `totalXp` from learner index). The parent `snapshot` page is a **static mockup** with hardcoded `learnerName="Emma"`, "2h 14m", etc. (`apps/web-v2/app/parent/learners/[learnerId]/snapshot/page.tsx`). The *real* parent views (`progress`, `gradebook`) are DB-backed and work.

**Fix guidance.** Implement an `awardXp`/streak write on `completeLessonRun` and an `EngagementStore.upsert`; either wire the `snapshot` page to real data or remove it in favor of `progress`/`gradebook`. **Effort:** ~3–5 days. (The team's `E2E_JOURNEY_GAP_ANALYSIS_2026-06.md` separately flags mobile "fake save" buttons incl. a therapist-notes clinical blocker — out of this web-focused trace but worth folding into the same cleanup.)

---

## 4. Prioritized Remediation Roadmap

Ordered by what blocks the *specified* product first. Each item has a definition of done (DoD).

### P0 — Truthfulness & safety (do first; cheap; de-risks everything)
1. **GAP-2 coverage truthfulness gate.** Stop declaring `"authored"` for bands without content.
   **DoD:** `pnpm curriculum:coverage` fails CI when any mode declares `"authored"` for a band lacking a non-draft skill graph + ≥N item-bank entries; all currently-overstated cells are downgraded to `"scaffold"`; runtime refuses to serve `"scaffold"` as production content. *(~3–5 days.)*
2. **GAP-4 metadata + flag honesty.** Reconcile the "Nova pilot only" label with the real all-14 roster; keep the agent flag off until eval-gated.
   **DoD:** flag metadata matches `agent-pilot.ts`; an ADR records "agent is off pending per-tutor real-model eval." *(~1 day.)*

### P1 — Deliver the differentiators the promise depends on
3. **GAP-1 wire domain surfaces for the launch subset.** Math/number-line, reading/passage, coding/sandbox end-to-end through the player.
   **DoD:** generated plans carry a validated `surface`; the production player mounts the domain surface for ≥3 tutors with content-derived (not fixture) specs; a runtime gate asserts non-generic surfaces and prevents regression. *(~3–5 weeks for the subset.)*
4. **GAP-2 author real content for the launch tutors.** Bring Nova/Sage (and Pixel) to a real K–2 range with genuine items.
   **DoD:** each launch tutor has authored skill-graph + ≥N item-bank items per skill/difficulty across the claimed bands; the coverage gate flips those cells to `"authored"` legitimately. *(weeks–months; long pole — start now.)*

### P2 — Architecture parity with the spec
5. **GAP-3 Sunday Creator (or week-preview).** Add day-of-week scheduling and a weekly per-learner/per-tutor generation (or preview) job reusing the on-demand generator.
   **DoD:** a scheduled job materializes the coming week's plan (or pre-built runs) per active learner; parents can see/review next week's plan; on-demand remains the fallback. *(~2–3 weeks + mapping work.)*
6. **GAP-4 real-model agent eval + progressive enablement.**
   **DoD:** per-tutor eval scores (real model) clear a published bar; agent enabled first for content-real tutors behind the flag. *(~2–4 weeks.)*

### P3 — Operational & cosmetic
7. **GAP-5** auto-trigger pacing on syllabus save + document live-only deps in `prod:check`. *(~3–5 days.)*
8. **GAP-6** write XP/streak on completion; fix/remove the `snapshot` mockup; fold in the mobile fake-save fixes from the team's E2E gap doc. *(~1 week + mobile.)*

---

## Appendix — What is genuinely real (so it isn't rebuilt)

The following were traced to real, DB-backed, mock-free critical paths and should be **preserved**, not re-litigated:

- **Learner lifecycle spine (J1):** onboarding → learner row → multi-tier baseline (bank/LLM/deterministic) with real scoring → per-learner learning path + brain-profile clone → generated lesson → server-derived completion → EWMA mastery. Production is hard-blocked from in-memory adapters (`apps/web-v2/lib/db/persistence/index.ts:193-206`).
- **Baseline inputs (J5/§5):** `parent_assessments`, `teacher_assessments`, `therapist_assessments`, `observational_assessments`/caregiver, IEP — all with tables, routes, and real consumption into question generation + functioning-level placement + accommodations.
- **Down-leveling (J5/§6):** `transformActivity` (STANDARD→…→PRE_SYMBOLIC, refuses uphill) + θ→delivery-band, closed into the live learning-svc lesson path via `brain_states`.
- **Recommendation + approval (J5/§6):** real PENDING→APPROVED→APPLIED human-in-the-loop gate with RBAC, durable effects, audit snapshots, notifications, parent UI. Brain clones gated `pending_parent_review` with COPPA/RAI.
- **Syllabus alignment (J3/§7)** and **holiday/summer-bridge (J4/§8):** real parsers, real `term_syllabi`/pacing tables, real next-grade catalogue logic (628KB `skill_graphs.json`), curriculum focus injected into both the generated lesson and the agent persona.
- **Tutor-agent infrastructure (J2/§1):** real LLM gateway, orchestrator, SessionMachine structural guard, degradation ladder, read/domain/write/memory tools with caps and consent gates — solid plumbing awaiting content + eval + enablement.

*End of report.*

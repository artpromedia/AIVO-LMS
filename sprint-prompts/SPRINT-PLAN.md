# Sprint Plans (Master Index) - two remediation suites merged 2026-06-12

- Suite A (relaxed-shannon): content/surface/creator remediation - sprint-01-honest-coverage ... sprint-12-engagement
- Suite B (elegant-brahmagupta): UX/a11y/platform remediation - sprint-01-parent-trust ... sprint-15-tutor-identity

---

# AIvo-LMS Remediation ΓÇö Sprint Plan (Master Index)

> **Source of truth:** `aivo-audit-report.md` (repo root). This plan closes every ≡ƒÜ¿ Blocker and ΓÜá∩╕Å Major gap from that audit, plus the Γä╣∩╕Å Minor gap, in dependency order.
> **Authored:** 2026-06-12, against branch `claude/relaxed-shannon-3f0aph` (HEAD `6f02cc44`), which already contains the merged `claude/blissful-ritchie-8f7ya1` work (waves AΓÇôF). All paths/line numbers below were verified read-only against this tree.
> **How to use:** execute one `sprint-NN-*.md` per Claude Code session, in order. Each prompt is self-contained ΓÇö the implementing session needs no memory of this plan. Review each sprint's Checkpoint before starting the next.

---

## 0. Refinements to the audit discovered during verification (read before planning around GAP-2)

The read-only verification pass that produced these prompts surfaced three facts that go **deeper** than the audit's GAP-2 and shape the content track:

1. **The "authored" launch packs are dead at runtime.** `defaultContentPackRefs` (e.g. `mathTutor.ts:35` ΓåÆ `"math-k-fall-2026"`) is **never dereferenced**. tutor-svc `planSession` loads the scaffold starter packs in `services/tutor-svc/src/content-packs/*.pack.ts` (e.g. `nova.pack.ts`, 4 activities, version `0.1.0`, "Status: scaffold") via `getStarterContentPack`, not the seeded `math-k-fall-2026`. Verified: a repo grep for `getSeededPack|SEEDED_PACKS|math-k-fall-2026` finds the seeded pack referenced only as a metadata string in `mathTutor.ts`.
2. **web-v2 lessons consume neither `@aivo/item-bank` nor `@aivo/content-pack`.** `apps/web-v2/package.json` does not depend on them. Lesson content is LLM-generated (Claude) or, in fallback, hardcoded inline questions in `apps/web-v2/lib/learner/lesson-plan.ts` (`"What is 2 + 3?"` at `:142`). So **authoring item-bank/content content changes the learner experience by zero** until the path is wired.
3. **The coverage gate passes via attestation, not content.** `scripts/curriculum-coverage-check.mjs` reads item counts from a hand-maintained `packages/item-bank/src/production-manifest.json` (not a live scan), and its promotion guard (`:398-538`) accepts `authored` cells whose graphs are signed off in `docs/quality/tutor-content-signoffs.json` ΓÇö which currently contains "project-owner-attestation" entries (dated 2026-06-06/07) for every 9-12/3-12 graph. The import CLI's persist adapter is a stub (`packages/item-bank/src/cli/import.ts:48-52`), so `item-bank:import` validates but persists nothing.

**Consequence:** the content remediation is **"unify one authored-content source and wire it to the learner,"** then make the gate truthful, then author depth. That is why Sprint 05 (wire authored content) precedes the authoring sprints, and Sprint 01 (truthful gate) replaces the manifest/attestation shortcuts.

---

## 1. Gap ΓåÆ Sprint coverage map

| Audit gap | Severity | Closed by sprint(s) |
|---|---|---|
| **GAP-1** ΓÇö per-tutor unique surfaces not wired | ≡ƒÜ¿ Blocker | 02 (contract + math), 03 (literacy + science), 04 (expressive + interactive; completes all 14) |
| **GAP-2** ΓÇö "14 fully-built tutors" inflated; authored content dead/disconnected | ≡ƒÜ¿ Blocker | 01 (truthful gate), 05 (wire authored content into lessons), 08 (Nova math K-2), 09 (Sage ELA + Pixel coding K-2) |
| **GAP-3** ΓÇö no Sunday Creator / weekly scheduler | ΓÜá∩╕Å Major | 06 (scheduler + pre-generate foundation), 07 (weekly fleet run + parent next-week view) |
| **GAP-4** ΓÇö agent off-by-default, non-load-bearing, quality unproven; stale flag | ΓÜá∩╕Å Major | 01 (flag honesty), 10 (real-model eval + gated enablement) |
| **GAP-5** ΓÇö syllabus/holiday live-only + non-obvious 2nd step | ΓÜá∩╕Å Major | 11 (auto-pace on syllabus save + live-dep docs) |
| **GAP-6** ΓÇö XP/streak static; parent snapshot mockup | Γä╣∩╕Å Minor | 12 (engagement writes + snapshot fix) |

Every Blocker and Major gap is covered. GAP-6 (Minor) is included for completeness.

---

## 2. Execution order, dependencies, and e2e state after each sprint

| # | Sprint | Closes | Depends on | Complexity | E2E-functional after this sprint |
|---|---|---|---|---|---|
| 01 | `sprint-01-honest-coverage-and-agent-flag` | GAP-2, GAP-4 | ΓÇö | M | `pnpm curriculum:coverage` fails any `authored` band lacking real, counted item-bank content; honest matrix committed; catalog shows "authoring in progress" badges; agentic-mode flag label/roster reconciled. |
| 02 | `sprint-02-surface-contract-and-math` | GAP-1 | ΓÇö (rec. after 01) | L | A **math** lesson in the real player renders an interactive **number line** sourced from lesson content; non-math lessons still render generic; lesson-plan contract carries a validated `surface`. |
| 03 | `sprint-03-literacy-and-science-surfaces` | GAP-1 | 02 | M | **Reading** lessons render a reading-annotation surface; **science** lessons render a labeled diagram/graph ΓÇö both in the real player. |
| 04 | `sprint-04-expressive-and-interactive-surfaces` | GAP-1 | 02 | L | **Coding** (sandbox), **art** (canvas), **music** (sequencer), **speech/world-lang** (voice) render their surfaces; every one of the 14 tutors maps to a domain-appropriate surface. GAP-1 fully closed. |
| 05 | `sprint-05-wire-authored-content-into-lessons` | GAP-2 | ΓÇö (rec. after 02) | L | web-v2 lessons draw guided-practice/checks from **authored** content (`@aivo/content-pack`/`@aivo/item-bank`) for the learner's (subject, skill, grade); the deterministic fallback is real grade content, not "2+3"; import CLI actually persists authored items. |
| 06 | `sprint-06-creator-scheduler-foundation` | GAP-3 | 05 (soft), 02 (soft) | L | A **day-of-week** SafeCron job (Sunday night) calls a new internal web-v2 route that **pre-generates** each active learner's next lesson as a `ready` run; the learner opens home and plays the pre-generated lesson (no wait). |
| 07 | `sprint-07-creator-weekly-and-parent-view` | GAP-3 | 06 | M | The Sunday job pre-generates the learner's **whole coming week** (per enrolled subject); a **parent "Next week" view** lists it; the learner picks them up deterministically. GAP-3 fully closed. |
| 08 | `sprint-08-nova-math-content-k2` | GAP-2 | 05, 01 | M | Real authored **K-2 math** items/activities exist, are **consumed** in Nova lessons, and legitimately satisfy the truthful coverage gate. |
| 09 | `sprint-09-sage-ela-and-pixel-coding-content-k2` | GAP-2 | 05, 01 | M | Real authored **K-2 ELA** (Sage) and **K-2 coding** (Pixel) content, consumed in lessons and gate-clean. Establishes the repeatable authoring pattern for the backlog. |
| 10 | `sprint-10-agent-eval-and-enablement` | GAP-4 | 01, 08, 09 (soft) | L | A **real-model** per-tutor eval harness scores action quality + safety; enablement is gated on passing scores; the agent runs in the real player for content-real tutors and demonstrably adapts a lesson. GAP-4 fully closed. |
| 11 | `sprint-11-syllabus-autopace` | GAP-5 | ΓÇö | S | Saving a school syllabus **auto-generates** the pacing plan (no separate click) when pacing is live; live dependencies documented and checked by `prod:check`. GAP-5 closed. |
| 12 | `sprint-12-engagement-and-snapshot` | GAP-6 | ΓÇö | S | Completing a lesson **writes** XP/streak; the learner home shows live values; the parent snapshot page shows real data (or is removed in favor of the real `progress`/`gradebook`). GAP-6 closed. |

Complexity: **S** Γëê half session ┬╖ **M** Γëê one focused session ┬╖ **L** Γëê a full session (largest; bounded so each still finishes e2e).

### Dependency graph (text)
```
01 ΓöÇΓöÇΓöÉ (de-risk; recommended first)
02 ΓöÇΓöÇΓö╝ΓöÇΓû╢ 03 ΓöÇΓû╢ (04)        surfaces track
02 ΓöÇΓöÇΓöÿ   ΓööΓöÇΓöÇΓöÇΓöÇΓû╢ 04
05 ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓû╢ 06 ΓöÇΓû╢ 07   creator track (05 = content wiring foundation)
01,05 ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓû╢ 08
01,05 ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓû╢ 09
01,(08,09) ΓöÇΓöÇΓöÇΓû╢ 10
11  (independent)
12  (independent)
```
Parallelizable tracks if multiple sessions run: {surfaces 02ΓåÆ03ΓåÆ04}, {content 05ΓåÆ08/09}, {creator 06ΓåÆ07 after 05}, {11}, {12}. Sprint 01 should land first. Sprint 10 last (needs content-real tutors to eval meaningfully).

---

## 3. Definition of "production-ready" this plan targets

A defensible launch, honestly scoped:
- **Adaptive spine** (already real): onboarding ΓåÆ multi-source baseline ΓåÆ functioning-level placement ΓåÆ generated lesson ΓåÆ completion ΓåÆ mastery ΓåÆ human-approved recommendations. Preserved, not rebuilt.
- **Surfaces:** every tutor renders a domain-appropriate learning surface (GAP-1 fully closed across 14 tutors).
- **Content:** one authored-content source wired to the learner; **Nova/Sage/Pixel** carry real, consumed, gate-clean K-2 content; the other 11 tutors are **honestly** marked "authoring in progress" (scaffold) rather than falsely "authored". Deepening the remaining grades/subjects is an ongoing curriculum backlog (track via `docs/quality/tutor-k12-coverage-gap-plan.md`), not a code blocker.
- **Creator:** a real Sunday-night weekly pre-generation pipeline (GAP-3 closed).
- **Agent:** enabled only behind a real-model eval gate, for content-real tutors (GAP-4 closed).
- **Operational honesty:** syllabus auto-paces (GAP-5); gamification is real (GAP-6); the coverage gate cannot be satisfied by attestation alone (GAP-2 truthfulness).

---

## 4. Conventions every sprint prompt assumes (shared primer)

- **Monorepo:** pnpm workspaces + turbo. TS services under `services/*` (Fastify), Python `services/brain-svc` (FastAPI, the "Learning Brain"). Shared packages `packages/*` published as `@aivo/<name>`. Frontends `apps/*`; **`apps/web-v2`** (Next.js App Router) owns the core learner lifecycle with its **own** persistence layer (`apps/web-v2/lib/db/persistence/`, memory + drizzle adapters; production is hard-blocked from memory mode by `assertNoMemoryAdapterInProduction`).
- **web-v2 is NOT a thin client.** The lesson lifecycle (generate, run, complete, mastery) lives in `apps/web-v2/lib/db/repos.ts` and is invoked through BFF routes under `apps/web-v2/app/api/bff/...`. Path alias `@/` = `apps/web-v2/`.
- **The 14 tutors** (codename ΓåÆ mode, `services/tutor-svc/src/modes/registry.ts:36-51`): nova=math, sage=ELA, spark=science, chrono=history, pixel=coding, echo=speech, harmony=SEL, atlas=geography, cadence=music, vigor=PE/health, lingua=world-languages, forge=STEM/engineering, compass=life-skills, muse=creative-arts. SubjectΓåötutor map in `packages/brand` (`TUTORS`, `LEARNER_SUBJECTS`, `getSubjectBySlug`).
- **Lesson generation** (the load-bearing path): `apps/web-v2/lib/db/repos.ts::createLessonRun` (~`:1865`) ΓåÆ `generateLessonPlanWithRetry(provider, input)` (`apps/web-v2/lib/ai/tutor.ts:96`) ΓåÆ validates against `GeneratedLessonPlanSchema` (`apps/web-v2/lib/validators/lesson.ts:110-157`, `.strict()`), with `generateDeterministicLessonPlan` (`apps/web-v2/lib/learner/lesson-plan.ts:239`) as both the LLM shape-anchor and the always-valid fallback. Real provider = Claude via `apps/web-v2/lib/ai/anthropic-tutor.ts`.
- **The agent** (enhancement layer, off by default, non-load-bearing): orchestrator `services/tutor-svc/src/agent/orchestrator.ts`, ai-svc turn `services/ai-svc/src/ai_svc/routes/tutor_agent.py` (real LLM via `litellm`). Flag `tutorAgenticMode` in `packages/feature-flags/src/enterprise-flags.ts`.
- **Learning Brain:** `services/brain-svc` (FastAPI). web-v2 reads brain profiles/pacing via `apps/web-v2/lib/db/repos.ts::getBrainProfile` and `apps/web-v2/lib/bff/brain-pacing.ts`.
- **Scheduling:** `@aivo/scheduling` (`packages/scheduling/src/index.ts`) ΓÇö `startSafeCron` (period-based, advisory-lock, fleet-safe). Services start their jobs in `services/<svc>/src/index.ts` (see admin-svc).
- **Tests/gates:** `pnpm test` (repo gate), `pnpm test:e2e` / `pnpm e2e` (Playwright in `apps/web-v2/e2e` + `e2e/`), domain gates like `pnpm curriculum:coverage`, `pnpm tutor:behavior`, `pnpm lessonrun:audit`, `pnpm prod:check`. Run the full suite at the end of every sprint so prior sprints stay green.
- **No commits** unless the reviewer explicitly says so. Leave changes in the working tree for review at each Checkpoint.

---

## 5. The implementation standard (every sprint repeats this verbatim)

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementationΓÇª" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.


---

# AIVO-LMS Remediation ΓÇö Master Sprint Plan

**Authored:** 2026-06-12 ┬╖ **Repo state:** HEAD `bad39c74` ┬╖ **Status:** awaiting owner review ΓÇö do NOT execute any sprint without explicit instruction.

## Source of truth

The brief named `aivo-audit-report.md` as input; **that file does not exist at the repo root**. The operative audit is **`aivo-product-quality-report.md`** (repo root, untracked ΓÇö identical to the copy the owner uploaded when commissioning this plan). Every gap below was re-verified against the working tree at HEAD `bad39c74` before a sprint was planned around it; no sprint is based on an assumed gap.

### Corrections discovered during path verification

The audit itself was verified 2026-06-12, but four of its remediation pointers needed adjustment after this planning session's read-only confirmation pass. The sprint prompts use the corrected facts:

| Audit statement | Verified reality | Effect on plan |
|---|---|---|
| Tutor art component cited as `packages/ui/src/baseline/TutorCard.tsx` | No such file. Real targets: `packages/ui/src/learner-dashboard/TutorAvatar.tsx`, `TutorAvatarCard.tsx`, `FeaturedLessonCard.tsx`; mobile target `packages/mobile-ui/src/TutorCard.tsx` | Sprint 06 work orders use real paths |
| "Mobile lacks high-contrast / has a parallel calm-focus-standard model" | `apps/mobile/context/SensoryModeProvider.tsx:65` already implements `["standard","calm","high-contrast"]` from `INCLUSIVE_WARM_BY_MODE` ΓÇö same trio as web | Sprint 05 scope narrowed: no high-contrast work needed; gap is dyslexia font + skeletons + stage consumption |
| "Voice selection not exposed to the learner on web" | `apps/web-v2/app/learner/settings/audio/{page,form}.tsx` exists and is wired to `getLearnerVoicePreference`/`upsertLearnerVoicePreference` | Sprint 03 carries only a small cross-link EDIT, not a new selector |
| Emoji "tutor avatars" cited at `learner/home/page.tsx:484,491,502` | Those lines are `MessageCard avatar=` props; tutor tiles render via `TutorAvatar` tone system (`page.tsx:136-149`) | Sprint 06 targets both correctly |

### Severity mapping

The audit doesn't use ≡ƒÜ¿/ΓÜá∩╕Å markers; this plan assigns them: ≡ƒÜ¿ **Blocker** = the audit's "three things that most undermine enterprise perception" (┬º1); ΓÜá∩╕Å **Major** = remaining Top-10 items (┬º4) + Quick-win/Structural roadmap rows (┬º5); ≡ƒƒí **Strategic** = ┬º5 Strategic rows included as late sprints or deferred with rationale.

## Gap register ΓåÆ sprint coverage

| ID | Sev | Gap (audit ref) | Closed by |
|---|---|---|---|
| B1 | ≡ƒÜ¿ | Phantom "Emma" on `/parent/home-v2` (┬º1.1, ┬º4 #1) | Sprint 01 |
| B2 | ≡ƒÜ¿ | Sensory adapter + reduced motion not wired into lesson runtimes, web & mobile (┬º1.2, ┬º4 #3) | Sprints 03 (web), 04 (mobile) |
| B3 | ≡ƒÜ¿ | Axe suites not a CI gate; admin a11y unmeasured (┬º1.3) | Sprint 02 |
| M1 | ΓÜá∩╕Å | Admin one-click destructive actions; URL-param feedback (┬º4 #7) | Sprint 10 |
| M2 | ΓÜá∩╕Å | Thin state coverage: 6/138 `loading.tsx`, chrome-less 404s, signup dead-button (┬º4 #9, ┬ºB) | Sprint 09 |
| M3 | ΓÜá∩╕Å | No toast/feedback layer; 128 raw `fetch(`; swallowed catches in lesson player (┬º4 #6, ┬ºF) | Sprint 08 |
| M4 | ΓÜá∩╕Å | Tutor faces/mascots/reward art missing from product (┬º4 #4) | Sprint 06 |
| M5 | ΓÜá∩╕Å | Learner home dashboard-first, six "0%" cards (┬º4 #5) | Sprint 07 |
| M6 | ΓÜá∩╕Å | Mobile parity: stage reduced-motion + SR announcements; dyslexia font; skeletons (┬º4 #8, narrowed per corrections) | Sprints 04, 05 |
| M7 | ΓÜá∩╕Å | Admin lists lack search/sort/pagination/bulk outside audit log (┬º4 #9-admin) | Sprint 11 |
| M8 | ΓÜá∩╕Å | God files: `lesson-player.tsx` 1,133 ln; `MobileSurfaceRenderer.tsx` 1,578 ln (┬º4 #10) | Sprints 12, 13 |
| M9 | ΓÜá∩╕Å | Parent-facing jargon: "Review brain clone" CTA (`lib/learner/readiness.ts:58`); hardcoded English on learner card (┬º5 jargon row) | Sprint 01 |
| M10 | ΓÜá∩╕Å | No Postgres RLS backstop; audit logging selective; dead `@aivo/ops-alert` package (┬ºE, ┬º5) | Sprint 14 |
| S1 | ≡ƒƒí | Per-tutor lesson identity + sensory/theme visual-regression matrix (┬º5 strategic) | Sprint 15 |

**Deferred ΓÇö decision-gated (not sprints; never plan around an assumption):**
- *Product analytics vs ADR-of-absence* (┬ºE): requires an owner decision (privacy posture). Prompt can be authored on request after the decision.
- *Admin i18n* (┬ºE): depends on whether district self-serve in non-English districts is on the roadmap.
- *Offline lesson content on mobile* (┬º5 strategic): large; schedule after Sprint 13 if prioritized.
- *Typography unification (web Satoshi vs brand Fredoka)* (┬ºA): brand decision, then a small sprint.
- *Command palette, Suspense/streaming adoption, docs-staleness CI gate*: quality-of-life; below Major threshold.

## Execution order & dependency graph

```
01 trust ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÉ
02 a11y-ci ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöñ  (independent starters)
03 web-sensory-stage ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÉ       Γöé
04 mobile-stage-a11y ΓöÇΓöÇΓöÉ       Γöé       Γöé
05 mobile-reading ΓöÇΓöÇΓöÇΓöÇΓöÇΓö╝ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöñ       Γöé
06 tutor-art ΓöÇΓöÇΓö¼ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöñ       Γöé       Γöé
               Γû╝       Γöé       Γöé       Γöé
07 learner-home-focus  Γöé       Γöé       Γöé
08 web-data-layer ΓöÇΓöÇΓö¼ΓöÇΓöÇΓöñ       Γöé       Γöé
                    Γû╝  Γöé       Γöé       Γöé
09 web-states       Γöé  Γöé       Γöé       Γöé
10 admin-safe-actions ΓöÇΓö╝ΓöÇΓöÇΓû║ 11 admin-tables
12 lesson-player-split ΓùäΓöÇ depends on 08
13 mobile-renderer-split ΓùäΓöÇ depends on 04
14 platform-hardening   (independent; services/db only)
15 tutor-identity ΓùäΓöÇ depends on 03, 06 (12 recommended first)
```

Recommended serial order: **01 ΓåÆ 02 ΓåÆ 03 ΓåÆ 04 ΓåÆ 05 ΓåÆ 06 ΓåÆ 07 ΓåÆ 08 ΓåÆ 09 ΓåÆ 10 ΓåÆ 11 ΓåÆ 12 ΓåÆ 13 ΓåÆ 14 ΓåÆ 15.** Hard dependencies are listed in each prompt's "Depends on"; everything else may be reordered.

## Sprint index

| # | File | One-line goal | Closes | Complexity | E2E-demoable result |
|---|---|---|---|---|---|
| 01 | `sprint-01-parent-trust-real-data.md` | `/parent/home-v2` shows only the real roster; "brain clone" never shown to parents | B1, M9 | **SΓÇôM** | Sign in as parent ΓåÆ home-v2 greets with Sky/Rio, real setup state; learner card CTA reads "Review learning profile" |
| 02 | `sprint-02-a11y-ci-gate.md` | Axe violations block PRs on web + first admin axe coverage | B3 | **SΓÇôM** | A seeded violation turns the new CI lane red; revert turns it green |
| 03 | `sprint-03-web-sensory-stage.md` | Sensory profile + reduced motion visibly govern the web lesson player | B2(web) | **MΓÇôL** | Toggle calm/high-contrast or a hyper-visual profile ΓåÆ stage slows/desaturates; `no-inert-prefs` proves consumers |
| 04 | `sprint-04-mobile-stage-a11y.md` | Mobile lesson runtime honors reduce-motion and announces feedback to TalkBack/VoiceOver | B2(mobile), M6a | **M** | With OS reduce-motion on, stage transitions are static; answers are announced |
| 05 | `sprint-05-mobile-reading-loading.md` | Dyslexia-friendly font on mobile + shimmer skeletons replace spinners | M6b | **M** | Toggle dyslexia font in settings ΓåÆ app-wide typeface swap; dashboards show skeletons on cold load |
| 06 | `sprint-06-tutor-art-mascots.md` | Tutors have faces and rewards have stickers across web + mobile | M4 | **M** | Learner home/baseline show tutor portraits (sensory-reduced variant in calm/HC); Rewards shows mascot art |
| 07 | `sprint-07-learner-home-focus.md` | Learner home leads with one primary action; no "0%" wall | M5 | **M** | Home shows a single Today's Mission hero; subjects live one tap away with stage-words, not percentages |
| 08 | `sprint-08-web-data-layer-toasts.md` | One mutation/query layer with toasts; zero swallowed catches in the lesson player | M3 | **L** | Kill the network mid-lesson ΓåÆ retry toast + recovery; messages/parent dashboard share the layer |
| 09 | `sprint-09-web-state-coverage.md` | Every heavy route has a skeleton; 404s keep role chrome; signup validates inline | M2 | **M** | Bad learner URL shows parent-chrome 404; signup shows per-field errors with an always-enabled submit |
| 10 | `sprint-10-admin-safe-actions.md` | Destructive admin actions confirm; feedback stops living in the URL | M1 | **M** | Revoking a SCIM token demands typed confirmation; errors render in an aria-live flash without navigation |
| 11 | `sprint-11-admin-table-ergonomics.md` | Tenants/users/learners/leads get search/sort/pagination/export + audited bulk actions | M7 | **MΓÇôL** | Search a user across 3 pages, bulk-revoke two invites, see both in the audit log |
| 12 | `sprint-12-lesson-player-decomposition.md` | Lesson player split into <400-line modules with zero behavior change | M8a | **L** | All lesson-player e2e suites green; file-length CI gate active for the directory |
| 13 | `sprint-13-mobile-renderer-decomposition.md` | MobileSurfaceRenderer split per-surface; mobile `any`-count ratcheted down | M8b | **L** | Stage plays all surface types; vitest suite green; lint ratchet enforced |
| 14 | `sprint-14-platform-hardening.md` | Postgres RLS backstop + audited-by-default write routes + dead package removed | M10 | **L** | Compose test proves an unscoped query returns zero rows; CI fails on un-audited write route; `@aivo/ops-alert` gone |
| 15 | `sprint-15-tutor-identity-theming.md` | Each tutor's lesson is visually theirs; sensory├ùtheme visual matrix in CI | S1 | **MΓÇôL** | Nova vs Sage lessons distinguishable in 5 s; snapshot matrix green across modes |

## Conventions used by every sprint prompt

- **Verification baseline:** all cited paths/line numbers verified at HEAD `bad39c74`. If the implementing session finds drift, it must re-locate by the quoted symbol/string, not skip the work order.
- **Dev runs:** web `corepack pnpm --filter @aivo/web-v2 dev` (port 5000; `AUTH_MODE` defaults to `mock` outside production ΓÇö `apps/web-v2/lib/env.ts:35-43`; mock session cookie `aivo_mock_session` Γêê {parent, learner, teacher, ΓÇª} per `apps/web-v2/lib/auth/mock-session.ts`). Admin e2e runs ride `docker-compose.e2e.yml` (job `sprint12-e2e`, `.github/workflows/ci.yml:742`). Mobile: `corepack pnpm --filter @aivo/mobile dev` (Expo web) + vitest; native checks called out where needed.
- **No new colors by hand:** raw hex in web app code fails ESLint (`eslint.config.mjs:79-115`). Use `iw-*` utilities / `@aivo/brand` tokens; mobile uses `useSensoryPalette()` / `packages/mobile-ui/src/theme.ts`.
- **i18n:** any new user-facing string lands in all 10 catalogs (`apps/web-v2/lib/i18n/messages/*.json`, `apps/mobile/i18n/*.json`); CI enforces parity.
- **Checkpoint discipline:** every sprint ends with a summary + pause; no commits without explicit owner instruction.

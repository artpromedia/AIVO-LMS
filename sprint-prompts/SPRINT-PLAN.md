# AIvo-LMS Remediation — Sprint Plan (Master Index)

> **Source of truth:** `aivo-audit-report.md` (repo root). This plan closes every 🚨 Blocker and ⚠️ Major gap from that audit, plus the ℹ️ Minor gap, in dependency order.
> **Authored:** 2026-06-12, against branch `claude/relaxed-shannon-3f0aph` (HEAD `6f02cc44`), which already contains the merged `claude/blissful-ritchie-8f7ya1` work (waves A–F). All paths/line numbers below were verified read-only against this tree.
> **How to use:** execute one `sprint-NN-*.md` per Claude Code session, in order. Each prompt is self-contained — the implementing session needs no memory of this plan. Review each sprint's Checkpoint before starting the next.

---

## 0. Refinements to the audit discovered during verification (read before planning around GAP-2)

The read-only verification pass that produced these prompts surfaced three facts that go **deeper** than the audit's GAP-2 and shape the content track:

1. **The "authored" launch packs are dead at runtime.** `defaultContentPackRefs` (e.g. `mathTutor.ts:35` → `"math-k-fall-2026"`) is **never dereferenced**. tutor-svc `planSession` loads the scaffold starter packs in `services/tutor-svc/src/content-packs/*.pack.ts` (e.g. `nova.pack.ts`, 4 activities, version `0.1.0`, "Status: scaffold") via `getStarterContentPack`, not the seeded `math-k-fall-2026`. Verified: a repo grep for `getSeededPack|SEEDED_PACKS|math-k-fall-2026` finds the seeded pack referenced only as a metadata string in `mathTutor.ts`.
2. **web-v2 lessons consume neither `@aivo/item-bank` nor `@aivo/content-pack`.** `apps/web-v2/package.json` does not depend on them. Lesson content is LLM-generated (Claude) or, in fallback, hardcoded inline questions in `apps/web-v2/lib/learner/lesson-plan.ts` (`"What is 2 + 3?"` at `:142`). So **authoring item-bank/content content changes the learner experience by zero** until the path is wired.
3. **The coverage gate passes via attestation, not content.** `scripts/curriculum-coverage-check.mjs` reads item counts from a hand-maintained `packages/item-bank/src/production-manifest.json` (not a live scan), and its promotion guard (`:398-538`) accepts `authored` cells whose graphs are signed off in `docs/quality/tutor-content-signoffs.json` — which currently contains "project-owner-attestation" entries (dated 2026-06-06/07) for every 9-12/3-12 graph. The import CLI's persist adapter is a stub (`packages/item-bank/src/cli/import.ts:48-52`), so `item-bank:import` validates but persists nothing.

**Consequence:** the content remediation is **"unify one authored-content source and wire it to the learner,"** then make the gate truthful, then author depth. That is why Sprint 05 (wire authored content) precedes the authoring sprints, and Sprint 01 (truthful gate) replaces the manifest/attestation shortcuts.

---

## 1. Gap → Sprint coverage map

| Audit gap | Severity | Closed by sprint(s) |
|---|---|---|
| **GAP-1** — per-tutor unique surfaces not wired | 🚨 Blocker | 02 (contract + math), 03 (literacy + science), 04 (expressive + interactive; completes all 14) |
| **GAP-2** — "14 fully-built tutors" inflated; authored content dead/disconnected | 🚨 Blocker | 01 (truthful gate), 05 (wire authored content into lessons), 08 (Nova math K-2), 09 (Sage ELA + Pixel coding K-2) |
| **GAP-3** — no Sunday Creator / weekly scheduler | ⚠️ Major | 06 (scheduler + pre-generate foundation), 07 (weekly fleet run + parent next-week view) |
| **GAP-4** — agent off-by-default, non-load-bearing, quality unproven; stale flag | ⚠️ Major | 01 (flag honesty), 10 (real-model eval + gated enablement) |
| **GAP-5** — syllabus/holiday live-only + non-obvious 2nd step | ⚠️ Major | 11 (auto-pace on syllabus save + live-dep docs) |
| **GAP-6** — XP/streak static; parent snapshot mockup | ℹ️ Minor | 12 (engagement writes + snapshot fix) |

Every Blocker and Major gap is covered. GAP-6 (Minor) is included for completeness.

---

## 2. Execution order, dependencies, and e2e state after each sprint

| # | Sprint | Closes | Depends on | Complexity | E2E-functional after this sprint |
|---|---|---|---|---|---|
| 01 | `sprint-01-honest-coverage-and-agent-flag` | GAP-2, GAP-4 | — | M | `pnpm curriculum:coverage` fails any `authored` band lacking real, counted item-bank content; honest matrix committed; catalog shows "authoring in progress" badges; agentic-mode flag label/roster reconciled. |
| 02 | `sprint-02-surface-contract-and-math` | GAP-1 | — (rec. after 01) | L | A **math** lesson in the real player renders an interactive **number line** sourced from lesson content; non-math lessons still render generic; lesson-plan contract carries a validated `surface`. |
| 03 | `sprint-03-literacy-and-science-surfaces` | GAP-1 | 02 | M | **Reading** lessons render a reading-annotation surface; **science** lessons render a labeled diagram/graph — both in the real player. |
| 04 | `sprint-04-expressive-and-interactive-surfaces` | GAP-1 | 02 | L | **Coding** (sandbox), **art** (canvas), **music** (sequencer), **speech/world-lang** (voice) render their surfaces; every one of the 14 tutors maps to a domain-appropriate surface. GAP-1 fully closed. |
| 05 | `sprint-05-wire-authored-content-into-lessons` | GAP-2 | — (rec. after 02) | L | web-v2 lessons draw guided-practice/checks from **authored** content (`@aivo/content-pack`/`@aivo/item-bank`) for the learner's (subject, skill, grade); the deterministic fallback is real grade content, not "2+3"; import CLI actually persists authored items. |
| 06 | `sprint-06-creator-scheduler-foundation` | GAP-3 | 05 (soft), 02 (soft) | L | A **day-of-week** SafeCron job (Sunday night) calls a new internal web-v2 route that **pre-generates** each active learner's next lesson as a `ready` run; the learner opens home and plays the pre-generated lesson (no wait). |
| 07 | `sprint-07-creator-weekly-and-parent-view` | GAP-3 | 06 | M | The Sunday job pre-generates the learner's **whole coming week** (per enrolled subject); a **parent "Next week" view** lists it; the learner picks them up deterministically. GAP-3 fully closed. |
| 08 | `sprint-08-nova-math-content-k2` | GAP-2 | 05, 01 | M | Real authored **K-2 math** items/activities exist, are **consumed** in Nova lessons, and legitimately satisfy the truthful coverage gate. |
| 09 | `sprint-09-sage-ela-and-pixel-coding-content-k2` | GAP-2 | 05, 01 | M | Real authored **K-2 ELA** (Sage) and **K-2 coding** (Pixel) content, consumed in lessons and gate-clean. Establishes the repeatable authoring pattern for the backlog. |
| 10 | `sprint-10-agent-eval-and-enablement` | GAP-4 | 01, 08, 09 (soft) | L | A **real-model** per-tutor eval harness scores action quality + safety; enablement is gated on passing scores; the agent runs in the real player for content-real tutors and demonstrably adapts a lesson. GAP-4 fully closed. |
| 11 | `sprint-11-syllabus-autopace` | GAP-5 | — | S | Saving a school syllabus **auto-generates** the pacing plan (no separate click) when pacing is live; live dependencies documented and checked by `prod:check`. GAP-5 closed. |
| 12 | `sprint-12-engagement-and-snapshot` | GAP-6 | — | S | Completing a lesson **writes** XP/streak; the learner home shows live values; the parent snapshot page shows real data (or is removed in favor of the real `progress`/`gradebook`). GAP-6 closed. |

Complexity: **S** ≈ half session · **M** ≈ one focused session · **L** ≈ a full session (largest; bounded so each still finishes e2e).

### Dependency graph (text)
```
01 ──┐ (de-risk; recommended first)
02 ──┼─▶ 03 ─▶ (04)        surfaces track
02 ──┘   └────▶ 04
05 ───────────▶ 06 ─▶ 07   creator track (05 = content wiring foundation)
01,05 ────────▶ 08
01,05 ────────▶ 09
01,(08,09) ───▶ 10
11  (independent)
12  (independent)
```
Parallelizable tracks if multiple sessions run: {surfaces 02→03→04}, {content 05→08/09}, {creator 06→07 after 05}, {11}, {12}. Sprint 01 should land first. Sprint 10 last (needs content-real tutors to eval meaningfully).

---

## 3. Definition of "production-ready" this plan targets

A defensible launch, honestly scoped:
- **Adaptive spine** (already real): onboarding → multi-source baseline → functioning-level placement → generated lesson → completion → mastery → human-approved recommendations. Preserved, not rebuilt.
- **Surfaces:** every tutor renders a domain-appropriate learning surface (GAP-1 fully closed across 14 tutors).
- **Content:** one authored-content source wired to the learner; **Nova/Sage/Pixel** carry real, consumed, gate-clean K-2 content; the other 11 tutors are **honestly** marked "authoring in progress" (scaffold) rather than falsely "authored". Deepening the remaining grades/subjects is an ongoing curriculum backlog (track via `docs/quality/tutor-k12-coverage-gap-plan.md`), not a code blocker.
- **Creator:** a real Sunday-night weekly pre-generation pipeline (GAP-3 closed).
- **Agent:** enabled only behind a real-model eval gate, for content-real tutors (GAP-4 closed).
- **Operational honesty:** syllabus auto-paces (GAP-5); gamification is real (GAP-6); the coverage gate cannot be satisfied by attestation alone (GAP-2 truthfulness).

---

## 4. Conventions every sprint prompt assumes (shared primer)

- **Monorepo:** pnpm workspaces + turbo. TS services under `services/*` (Fastify), Python `services/brain-svc` (FastAPI, the "Learning Brain"). Shared packages `packages/*` published as `@aivo/<name>`. Frontends `apps/*`; **`apps/web-v2`** (Next.js App Router) owns the core learner lifecycle with its **own** persistence layer (`apps/web-v2/lib/db/persistence/`, memory + drizzle adapters; production is hard-blocked from memory mode by `assertNoMemoryAdapterInProduction`).
- **web-v2 is NOT a thin client.** The lesson lifecycle (generate, run, complete, mastery) lives in `apps/web-v2/lib/db/repos.ts` and is invoked through BFF routes under `apps/web-v2/app/api/bff/...`. Path alias `@/` = `apps/web-v2/`.
- **The 14 tutors** (codename → mode, `services/tutor-svc/src/modes/registry.ts:36-51`): nova=math, sage=ELA, spark=science, chrono=history, pixel=coding, echo=speech, harmony=SEL, atlas=geography, cadence=music, vigor=PE/health, lingua=world-languages, forge=STEM/engineering, compass=life-skills, muse=creative-arts. Subject↔tutor map in `packages/brand` (`TUTORS`, `LEARNER_SUBJECTS`, `getSubjectBySlug`).
- **Lesson generation** (the load-bearing path): `apps/web-v2/lib/db/repos.ts::createLessonRun` (~`:1865`) → `generateLessonPlanWithRetry(provider, input)` (`apps/web-v2/lib/ai/tutor.ts:96`) → validates against `GeneratedLessonPlanSchema` (`apps/web-v2/lib/validators/lesson.ts:110-157`, `.strict()`), with `generateDeterministicLessonPlan` (`apps/web-v2/lib/learner/lesson-plan.ts:239`) as both the LLM shape-anchor and the always-valid fallback. Real provider = Claude via `apps/web-v2/lib/ai/anthropic-tutor.ts`.
- **The agent** (enhancement layer, off by default, non-load-bearing): orchestrator `services/tutor-svc/src/agent/orchestrator.ts`, ai-svc turn `services/ai-svc/src/ai_svc/routes/tutor_agent.py` (real LLM via `litellm`). Flag `tutorAgenticMode` in `packages/feature-flags/src/enterprise-flags.ts`.
- **Learning Brain:** `services/brain-svc` (FastAPI). web-v2 reads brain profiles/pacing via `apps/web-v2/lib/db/repos.ts::getBrainProfile` and `apps/web-v2/lib/bff/brain-pacing.ts`.
- **Scheduling:** `@aivo/scheduling` (`packages/scheduling/src/index.ts`) — `startSafeCron` (period-based, advisory-lock, fleet-safe). Services start their jobs in `services/<svc>/src/index.ts` (see admin-svc).
- **Tests/gates:** `pnpm test` (repo gate), `pnpm test:e2e` / `pnpm e2e` (Playwright in `apps/web-v2/e2e` + `e2e/`), domain gates like `pnpm curriculum:coverage`, `pnpm tutor:behavior`, `pnpm lessonrun:audit`, `pnpm prod:check`. Run the full suite at the end of every sprint so prior sprints stay green.
- **No commits** unless the reviewer explicitly says so. Leave changes in the working tree for review at each Checkpoint.

---

## 5. The implementation standard (every sprint repeats this verbatim)

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

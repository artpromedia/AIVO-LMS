# Assessment UX Remediation — Sprint Plan (Master Index)

> **Track:** Assessment Experience & Learning Brain ("Suite C").
> **Source of truth:** `aivo-assessment-ux-report.md` (repo root) — "AIVO Assessment Experience & Learning Brain Audit", 2026-06-12. Every sprint below closes items from that report: the Top 10 improvements (#1–#10), all three roadmap tiers, every scorecard cell ≤ 2 and every "Below bar" verdict, the §4.2 storyboard (screens 0–7), and the ❓ Unverified appendix.
> **Authored:** 2026-06-12 against HEAD `32ece1d3` (branch `claude/eager-goldberg-ifpn9t`). **All file paths and line numbers cited by the report were re-verified against this tree before being reused — zero drift found.** If an implementing session finds drift later, re-locate by the quoted symbol/string; never skip the work order.
> **How to use:** execute one `sprint-NN-*.md` per Claude Code session, in order (or per the parallel tracks below). Each prompt is self-contained. Review each sprint's Checkpoint before starting the next. **Do not execute anything until the owner explicitly says so.**

---

## 0. Relationship to the functional-remediation track (`sprint-prompts/`)

`sprint-prompts/SPRINT-PLAN.md` contains two merged suites: **Suite A** (content/surfaces/creator, `sprint-01-honest-coverage…`) and **Suite B** (UX/a11y/platform, `sprint-01-parent-trust…`). This track (Suite C) lives in its own directory, so filenames never collide. Coordination points — declared again inside each affected sprint:

| Their sprint | What it owns | How Suite C coordinates |
|---|---|---|
| **B-01** `parent-trust-real-data` | Parent-facing vocabulary: "brain clone" never shown to parents; readiness CTA becomes "Review learning profile" (`lib/learner/readiness.ts` labels) | **C-03** adopts the same vocabulary across the `brain_clone` i18n namespace. Whichever lands second must not regress the other's strings. |
| **B-02** `a11y-ci-gate` | The blocking axe CI lane (`test:a11y`, `@a11y` tag, `axe-playwright`, pattern in `apps/web-v2/e2e/role-a11y.playwright.ts`) | All Suite C per-route axe specs (C-03, C-07, C-08, C-09, C-10, C-11) follow that exact pattern and ride that lane. If B-02 hasn't landed, the specs still run via `pnpm --filter @aivo/web-v2 run test:a11y`. |
| **A-06/A-07** creator scheduler | Sunday pre-generation calls `createLessonRun` | **C-01**'s approval gate applies to the creator job too; C-01 verifies the job skips unapproved learners gracefully (log, not crash) if A-06/07 have landed. |
| **B-04/B-05** mobile stage/a11y | Mobile styling + a11y conventions | **C-04** (mobile approve) matches their component/test conventions. |
| **B-06** `tutor-art-mascots` | Tutor portraits incl. baseline | **C-09** (baseline a11y) touches the same question-card surface; rebase carefully if both in flight. |

Shared conventions (dev runs, mock auth cookie `aivo_mock_session`, `corepack pnpm --filter @aivo/web-v2 dev` on port 5000, test gates) are documented in `sprint-prompts/SPRINT-PLAN.md` §4 and assumed by every Suite C prompt.

---

## 1. Coverage map — report item → sprint

### Top 10 improvements (report §5)
| # | Item | Sprint(s) |
|---|---|---|
| 1 | Enforce approval server-side in web-v2 | **C-01** |
| 2 | Scope brain-svc read/rollback endpoints | **C-02** |
| 3 | Remove/truthify trust-moment claims (AES-256 chip, device-encryption line, grade-gap) | **C-03** |
| 4 | Fix the correction loop (per-inference review; amend lands editable; regenerate not silent) | **C-05** |
| 5 | Mobile approve: wire or hide | **C-04** |
| 6 | Build the teacher flow | **C-07** |
| 7 | Strengths stage + parent-language copy in the build sequence | **C-03** |
| 8 | Completion-tracking hub + automatic reminders | **C-08** |
| 9 | Approval ceremony + consent capture in web-v2 | **C-06** |
| 10 | Honor accessibility prefs inside baseline + switch scanning | **C-09** (prefs, part 1) + **C-15** (switch/AAC, part 2) |

### Roadmap rows (report §6)
| Tier | Row | Sprint |
|---|---|---|
| Quick win | Server-side approval gate | C-01 |
| Quick win | Scope brain-svc endpoints | C-02 |
| Quick win | Truthful trust chips + remove grade-gap | C-03 |
| Quick win | Hide/wire mobile approve | C-04 |
| Quick win | Stage copy re-voice + strengths reorder | C-03 |
| Quick win | Fix BFF brain-profile route | C-02 |
| Quick win | Raw enum cleanup (team badges) | C-03 |
| Structural | Correction loop (#4) + approval ceremony (#9) | C-05 + C-06 |
| Structural | Teacher flow (#6) | C-07 |
| Structural | Orchestration hub + reminders (#8) | C-08 |
| Structural | Baseline accessibility (#10 part 1) | C-09 |
| Structural | Therapist polish | C-10 |
| Strategic | One brain, one gate | C-12 |
| Strategic | Brain evolution + re-approval | C-13 |
| Strategic | The full reveal (§4.2) | C-14 |
| Strategic | Switch/AAC baseline | C-15 |
| Strategic | Contributor feedback loop | C-16 |

### Scorecard cells ≤ 2 and "Below bar" verdicts (report §1–§2)
| Finding | Sprint |
|---|---|
| Teacher flow — Below bar, all cells 1–2 | C-07 |
| Orchestration — Below bar; emotional fit 2, accessibility 2, completion friction 2 | C-08 (+ C-03 enum cleanup) |
| Learning Brain — trust & privacy 2; "Below bar on substance" | C-01, C-02, C-03, C-05, C-06, C-12, C-13, C-14 |
| Caregiver — accessibility 2 | C-10 |
| Therapist — accessibility 2 | C-10 |
| Parent assessment — no cell ≤ 2 (all 4s); report findings (autosave transparency, resume signal, step-10 overload, diagnosis softening) | **C-11** — included to "close every finding"; explicitly deferrable (Decision D5) |

### §4.2 storyboard screens 0–7
| Screen | Sprint |
|---|---|
| 0 — Review invitation (notification on clone-ready) | C-13 (infrastructure + copy), cohesion pass in C-14 |
| 1 — Inputs assembling (re-voiced, real contribution counts) | C-03 (re-voice now), C-14 (contribution counts, full build) |
| 2 — Strengths first | C-03 (stage exists, mandatory before levels), C-14 (enriched) |
| 3 — How she learns best (source chips + confidence dots) | C-14 |
| 4 — Where we'll start (growth framing, honest numbers) | C-03 (delete gap/grade-equiv), C-14 (curriculum-grounded option, per Decision D4) |
| 5 — Check our understanding (correction loop) | C-05 |
| 6 — Approval ceremony | C-06 |
| 7 — What happens next | C-06 (initial), C-14 (full, incl. share artifact) |

### ❓ Unverified appendix → verification tasks
| Item | Lands in |
|---|---|
| Runtime behavior (app never run during audit) | C-01 runtime-verification rider (first sprint that runs the app), incl. parent-assessment-at-mobile-viewport walk |
| Infra-level encryption-at-rest | C-03 (must be verified before replacement privacy copy is written) |
| Teacher insight submission on other surfaces (web-admin?) | C-07 |
| Per-route axe assertions for assessment flows | C-03 (brain-clone-watch), C-07 (teacher), C-08 (accept-invite), C-09 (baseline), C-10 (caregiver + therapist), C-11 (parent assessment) |
| Virus scanning of IEP uploads | C-10 (verify + Decision D6) |
| Mobile parent assessment rendering | C-01 rider (responsive-web walk at mobile viewport) |

---

## 2. Execution order, stacks, dependencies

Complexity: **S** ≈ half session · **M** ≈ one focused session · **L** ≈ a full session.

| # | Sprint file | One-line goal | Stack(s) | Depends on | Cx | What exists after this sprint |
|---|---|---|---|---|---|---|
| 01 | `sprint-01-teach-gate-web.md` | Lessons cannot be created from an unapproved brain in web-v2 — enforced server-side, typed error, regression-tested | `apps/web-v2` | — | M | `POST /today/start` returns a typed `brain_not_approved` blocker pre-approval; approved learners unaffected; runtime walkthrough evidence captured |
| 02 | `sprint-02-brain-access-control.md` | Every brain-svc brain/snapshot endpoint is learner-scoped; rollback restricted; broken/over-permissioned BFF brain-profile route fixed | `services/brain-svc`, `apps/web-v2` (1 BFF route) | — | M | A non-related TEACHER JWT gets 403 on any brain read; rollback is parent/admin-only; BFF route awaits + is parent-only |
| 03 | `sprint-03-truthful-reveal.md` | The reveal contains no claim the backend can't honor, leads with strengths, and speaks parent language | `apps/web-v2` (+ all 10 i18n locales), `apps/mobile` (string verification) | — (coordinate B-01) | L | No AES/gap-year/grade-equiv anywhere; strengths stage precedes levels; humanized team badges |
| 04 | `sprint-04-mobile-approve.md` | The mobile approve button never lies: real handoff (or real approval per D1) replaces the dead buttons | `apps/mobile` | — (Decision D1) | S | Mobile parents see an honest review-on-web handoff; no non-functional buttons |
| 05 | `sprint-05-correction-loop.md` | A parent can correct individual inferences before approving; amend lands somewhere editable; regenerate explains itself | `apps/web-v2` (parity w/ brain-svc `parent_modifications` contract — Decision D2) | 01, 03 (soft) | L | Storyboard screen 5 live; corrections persist and flow into lesson snapshots |
| 06 | `sprint-06-approval-ceremony.md` | Approval is a deliberate, recorded act: RAI + consent capture, dedicated approval record, audit in both stacks, decline archives | `apps/web-v2`, `services/brain-svc` | 05 | L | Storyboard screens 6–7 (initial); approval table with actor/consent/RAI versions; decline never destroys baseline work |
| 07 | `sprint-07-teacher-flow.md` | A teacher goes from invite to a submitted ≤10-minute autosaving assessment that feeds the clone | `apps/web-v2`, `services/assessment-svc`, `services/family-svc` (existing routes) | 03 (vocab, soft) | L | Teacher flow exists end-to-end; submission visible to parent; folded into clone |
| 08 | `sprint-08-orchestration-hub.md` | Parents see invited→accepted→contributed per person; automatic reminders ship; review shows "N of M voices" | `apps/web-v2`, `services/family-svc`, `services/comms-svc` | 07; 06 (soft) | L | Completion hub + 48h/pre-expiry reminder jobs + source-count chip |
| 09 | `sprint-09-baseline-a11y.md` | Learner font/spacing/size prefs demonstrably apply inside baseline; accessibility-contract enforced; mobile pacing synced; breaks explain themselves | `apps/web-v2`, `packages/accessibility-contract`, `apps/mobile` | — (coordinate B-06) | M | Baseline question card honors `accessibilityDefaults`; mobile `BREAK_EVERY`/subjects match web |
| 10 | `sprint-10-contributor-polish.md` | Therapist + caregiver inputs reach enterprise baseline: drafts, time expectations, context, announced outcomes, submission record | `apps/web-v2`, `services/family-svc` (small), `services/assessment-svc` (verify) | — | L | Therapist autosave/IEP-side-panel/summary record; caregiver examples/mood/edit-window/announced success |
| 11 | `sprint-11-parent-assessment-polish.md` | The strongest flow reaches best-in-class: visible save confidence, visible resume, step-10 split, softened diagnosis moment | `apps/web-v2` | — (Decision D5: deferrable) | M | "Saved ✓" indicator; resume badge; 12 calmer screens; reassurance beside the diagnosis grid |
| 12 | `sprint-12-one-brain-one-gate.md` | One approval/consent model governs every lesson pipeline, proven by cross-stack integration tests; FERPA disclosure log exists | all (`apps/web-v2`, `services/brain-svc`, `services/family-svc`, BFF) | 01, 02, 06 (Decision D3 at start) | L | Unified approval contract + ADR; explicit `approval_status` check in the services lesson path; disclosure log with query surface |
| 13 | `sprint-13-brain-evolution.md` | Parents are notified of meaningful profile changes; structural deltas require re-acknowledgement; a change timeline exists | `apps/web-v2`, `services/brain-svc`, `services/comms-svc` | 06; 12 (soft) | L | Screen 0 notification; re-approval policy; "what changed since you approved" timeline; regressions parent-readable |
| 14 | `sprint-14-full-reveal.md` | Storyboard screens 0–7 shipped as one coherent, instrumented reveal with a strengths-only share artifact | `apps/web-v2` | 03, 05, 06, 13 | L | Source chips + confidence dots; growth-framed starting points; share artifact; conversion + time-to-approve instrumented |
| 15 | `sprint-15-switch-aac-baseline.md` | The baseline is completable via switch scanning and the AAC bridge, verified by the vendor-certification suite | `apps/web-v2`, `packages/aac-bridge` | 09 | L | Switch-scanning input mode in baseline; certification suite green |
| 16 | `sprint-16-contributor-feedback-loop.md` | Contributors learn their input mattered; repeat-contribution is measured | `services/comms-svc`, `services/family-svc`, `apps/web-v2` | 06, 08 | M | "Your input shaped X" notifications; contributor summary surface; retention metric |

### Dependency graph
```
Trust wave (any order, 01 first recommended):
01 ──┐
02 ──┤ (independent of each other)
03 ──┤
04 ──┘
01,03 ─▶ 05 ─▶ 06 ─▶ {12, 13, 16}
03 ─▶ 07 ─▶ 08 ─▶ 16
09 ─▶ 15
10, 11 independent
01,02,06 ─▶ 12 ─▶ (13 soft)
06,13 ─▶ 14   (also needs 03, 05)
```
Parallelizable if multiple sessions run: {01..04 trust wave}, {07→08}, {09→15}, {10}, {11}, then {05→06→12/13→14, 16}.

---

## 3. Decisions needed (owner calls — each sprint that needs one halts at start until answered)

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | Mobile approve (C-04) | (a) Hide the dead buttons + honest "review on web" handoff now; full mobile approval parity as a later sprint after C-06/C-12. (b) Wire mobile to brain-svc `/approve` now, incl. building mobile consent + RAI UI. | **(a)** — the report's DoD ("either POSTs an approval that flips state or is not rendered") is satisfied by hiding; wiring without the ceremony would ship a consent-free approval, repeating the web-v2 mistake. |
| **D2** | Corrections data path (C-05) | (a) Implement in web-v2 persistence using the Python `parent_modifications` contract **shape** (`services/brain-svc/src/brain_svc/models/schemas.py:80-91`) as the spec. (b) Bridge web-v2 to call brain-svc `/approve` (ADR 0009 bypass exists). | **(a)** — the live lesson pipeline reads web-v2's store; bridging would gate the wrong store. Shape-compatibility keeps C-12 unification cheap. |
| **D3** | One-gate canonical model (C-12) | (a) web-v2 store stays the runtime source; the approval/consent contract is shared and brain-svc adopts it. (b) brain-svc becomes system-of-record for approval; web-v2 reads through the ADR-0009 bridge. (c) Retire one stack's pipeline. | **DECIDED: (a)** — [ADR 0042](../../docs/adr/0042-one-brain-one-gate.md) (Accepted). The approval/consent contract is shared (`packages/db/.../approval-contract.ts` + brain-svc `contracts/approval_contract.py`, parity-tested); brain-svc writes the shared record; the services lesson path now has an **explicit** `approval_status ∈ {approved,amended}` gate (learning-svc path-init), proven by a cross-stack test on both pipelines; FERPA cross-role reads are logged (`CHILD_PROFILE_DISCLOSED`) with a compliance query endpoint. The two stacks no longer disagree about the product's central promise. |
| **D4** | Grade framing in the reveal | (a) Delete grade-equivalents/gap entirely (C-03) and never reintroduce. (b) Delete now; C-14 may reintroduce "working on grade-N skills" **only** sourced from curriculum-svc catalogue (ADR 0040), labeled "starting point, not a label". | **(b)** — schools need grade language; fabricated math never returns either way. |
| **D5** | Parent assessment polish (C-11) | In scope / deferred. It closes report findings but no ≤2 cell or roadmap row. | **In scope, sequenced late** — cheap, and it takes the flagship flow to 5s. Veto freely. |
| **D6** | IEP upload scanning (C-10) | If infra-level AV is absent (verification task): (a) integrate scanning (e.g. ClamAV sidecar) in a named follow-up sprint; (b) accept risk, harden type/size/content checks only. | Verify first; if absent, **(a)** as a follow-up — C-10 ships the hardening either way. |
| **D7** | i18n breadth | All 10 locale files updated in-sprint (matches current convention — every locale carries the `brain_clone` keys today) vs. en-first + translation backlog. | **All 10 in-sprint** for changed/added keys. |
| **D8** | C-01 behavior change | The gate also blocks **teacher-assigned** lessons pre-approval (they snapshot the same unapproved brain state — `repos.ts:1945`). Confirm this is desired. | **Yes** — "nothing teaches from the brain before approval" admits no exception; the teacher-assignment UI shows the same waiting state. |

---

## 4. Conventions every Suite C prompt assumes

- **Dual-stack reality (the report's central finding — UNIFIED by C-12 / [ADR 0042](../../docs/adr/0042-one-brain-one-gate.md)):** web-v2 owns its own persistence (`apps/web-v2/lib/db/repos.ts` + `lib/db/persistence/` memory/drizzle adapters) and remains the runtime source of truth for the live parent/learner surface; `services/brain-svc` (FastAPI) keeps the clone/XAI/pacing pipeline. They no longer *disagree* about approval: a single **shared approval/consent contract** (status enum + record shape + revision semantics) is honored by both stacks (`packages/db/src/schema/approval-contract.ts` ↔ `services/brain-svc/.../contracts/approval_contract.py`, parity-tested), the teach gate is asserted **server-side on every lesson pipeline** (web `createLessonRun` + learning-svc path-init's explicit `approval_status ∈ {approved,amended}` check), and FERPA cross-role reads are logged (`CHILD_PROFILE_DISCLOSED`) with a compliance query surface. Every sprint declares its stack(s); no sprint fixes only the non-shipped stack while the user-facing surface stays broken.
- **Dev runs / auth:** `corepack pnpm --filter @aivo/web-v2 dev` (port 5000), `AUTH_MODE` defaults to mock outside production, mock session cookie `aivo_mock_session` ∈ {parent, learner, teacher, …} (`apps/web-v2/lib/auth/mock-session.ts`). brain-svc: FastAPI + pytest (`services/brain-svc/tests/`).
- **Tests:** repo gate `pnpm test`; web e2e Playwright (`apps/web-v2/e2e`); a11y lane `corepack pnpm --filter @aivo/web-v2 run test:a11y` (`@a11y` tag, pattern: `apps/web-v2/e2e/role-a11y.playwright.ts` — `injectAxe` + `checkA11y`). Persistence changes need memory+drizzle parity (pattern: `apps/web-v2/lib/db/persistence/__tests__/brain-profiles.parity.test.ts` and `__tests__/contract/brain-profiles.contract.ts`).
- **Scheduling:** `startSafeCron` from `@aivo/scheduling` with advisory lock + ledger — live example `services/comms-svc/src/index.ts:80`.
- **i18n:** all user-facing strings via `apps/web-v2/lib/i18n/messages/*.json` (10 locales — keep key parity across all of them, per D7).
- **No commits** unless the owner explicitly says so. Each sprint ends at its Checkpoint with changes left in the working tree.

---

## 5. Status

**Awaiting owner review. Do not execute any sprint without explicit instruction (e.g. "proceed with Sprint 01").**

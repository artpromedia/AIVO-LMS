# UX-17 — Prototype Testing, Design QA, and Engineering Handoff

> **Last refreshed**: 2026-05-17 — drafted in this sprint.
>
> **Source of truth.** Grounded in this `docs/ux/` doc set (UX-00 through UX-16), the live code in `apps/web-v2/**` + `apps/mobile/**`, the i18n audit (`pnpm i18n:audit`), the marketing PR/staging/production checks (`.github/workflows/marketing-{pr-check,deploy-staging}.yml` + `marketing-smoke-test.yml`), and the testing posture in `.local/skills/validation`. Note: `runTest` agent helper is disabled this session — testing in this doc is the **manual + CI-enforced** model, not subagent-driven.
>
> **Status legend:** ✅ shipped · 🟡 partial · ⬜ planned.

---

## 1. Why this is the closing sprint

The previous sixteen sprints describe what AIVO should _be_. This one describes how we know it actually _is_. It is the design-to-shipped pipeline: how we validate with users before code, how we keep design intent intact through engineering, and how we hand a sprint over without context loss.

The deliverable from this sprint is a repeatable process, not a single artifact. The acceptance test is whether the next person onboarding can pick up any UX-0x doc and ship from it.

---

## 2. The validation ladder

Each sprint advances along five rungs. A sprint that hasn't cleared the rung below it doesn't ship.

| Rung | Question                               | Method                                                                                                          | Owner             | Today                      |
| ---- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------- |
| 1    | Is this the right thing to build?      | Discovery interviews + UX-00 audit linkage                                                                      | Product           | ✅ UX-00 maintained        |
| 2    | Does the contract make sense?          | This `docs/ux/` doc set + architect / code-review pass                                                          | Design + Eng lead | ✅ 17 docs current         |
| 3    | Does the prototype work for our users? | Moderated usability sessions on canvas mockups (3 representative learners + 3 parents + 2 teachers per surface) | UX research       | 🟡 ad-hoc today            |
| 4    | Did engineering preserve the contract? | Design QA pass against UX-0x acceptance criteria                                                                | Design            | 🟡 ad-hoc today            |
| 5    | Does it keep working in prod?          | Smoke tests + scheduled checks + observability                                                                  | Eng + DevOps      | ✅ marketing; 🟡 dashboard |

Rung 3 and Rung 4 are the gaps this doc is mostly here to close.

---

## 3. Prototype testing (Rung 3)

### 3.1 When to prototype

Prototype on the canvas (via the mockup-sandbox skill) before code when **any** of these are true:

- Sweeping redesign affecting more than one surface.
- A flow that touches consent, safety, or money (UX-03, UX-15, UX-16 §4).
- A first-of-its-kind interaction (the Stage, the assessment wizard, brain-clone approval flow).
- More than one viable design direction is on the table.

Don't prototype when:

- The change is a bugfix or visual tune.
- The contract is already locked in a UX-0x doc and the work is just implementation.

### 3.2 Participants

Three buckets — each surface validates with a representative slice:

| Surface                  | Primary                                                                       | Secondary          |
| ------------------------ | ----------------------------------------------------------------------------- | ------------------ |
| Parent (UX-04)           | 3 parents of neurodiverse children (mixed age, mixed diagnoses)               | 1 caregiver        |
| Learner (UX-05/06/08/09) | 3 learners across 3 functioning levels (STANDARD, EMERGING_AAC, PRE_SYMBOLIC) | 1 AAC user         |
| Teacher (UX-10)          | 2 SPED teachers + 1 general-ed teacher                                        | 1 paraprofessional |
| Admin (UX-11)            | 1 district admin + 1 school admin                                             | 1 IT contact       |

Compensate every participant; use neurodiversity-affirming recruiting language ("learners who use AT", not "with deficits").

### 3.3 Session structure

50-minute moderated session, recorded with consent:

1. **5 min — context.** Confirm consent, explain the prototype is fake, plain language only.
2. **30 min — task list.** 3–5 tasks per session, in priority order, with the moderator silent during attempts.
3. **10 min — open exploration.** "Show me anything that surprised you" / "What would you want to do next".
4. **5 min — debrief.** Single ask: "If you could change one thing, what would it be?"

Tasks are written from the acceptance criteria of the relevant UX-0x doc. Never invent new tasks during a session.

### 3.4 What we score

| Signal             | Captured how                                                           |
| ------------------ | ---------------------------------------------------------------------- |
| Task completion    | Pass / partial / fail per task                                         |
| Time-on-task       | Stopwatch in the recording timeline                                    |
| Confusion moments  | Timestamped notes — single-word tag: copy, layout, terminology, flow   |
| Emotional friction | Timestamped notes — soft signals (sigh, "wait, what?", "I don't know") |
| Direct verbatims   | 1–3 per task                                                           |

Scores live in `docs/ux/usability-tests/<date>-<surface>.md` — one row per task per participant.

### 3.5 Decisions out of a round

A surface clears Rung 3 when:

- 80% of primary participants complete the primary task without moderator help.
- Zero participants hit a copy or terminology block-out (a confusion that prevents progress).
- No safety-critical surface (UX-15 §4) saw a participant get confused about what AIVO was doing on their behalf.

If any threshold fails, iterate on the canvas — don't ship.

---

## 4. Design QA (Rung 4)

### 4.1 The QA pass

Once engineering says a UX-0x sprint is done, design runs a structured pass against the doc's acceptance criteria — every checkbox is verified live, on the running app, on at least two viewports (mobile + desktop) and one reduced-motion / dark theme variant.

The output is `docs/ux/design-qa/<date>-UX-<NN>.md` — one row per acceptance criterion with: ✅ pass · 🟡 minor (logged, can ship) · 🔴 block (must fix).

### 4.2 What design QA is not

- **Not** a re-design pass. New ideas land in a new ticket against the next sprint's UX-0x doc, never as a QA block.
- **Not** a bug bash. Functional bugs go to engineering's QA. Design QA is specifically about whether the shipped surface honors the contract.
- **Not** a token audit. Token / primitive drift is caught by `components/ui/*` lints (⬜ planned per UX-02), not eyeballed.

### 4.3 The four lenses

Every design QA pass uses these four lenses, in this order:

1. **Contract.** Does the surface match the UX-0x doc? (Sitemap, route names, state set, copy.)
2. **States.** Empty / loading / error / partial / offline — each rendered, screenshotted, attached to the QA report.
3. **A11y.** UX-14 §8 four-pass method (keyboard / SR / 200% zoom / reduced motion) on the surface.
4. **Cross-role symmetry.** If the surface has a parent view + learner view + teacher view, all three are checked against each other for consistency (one mastery word ladder, one readiness Badge palette, etc.).

### 4.4 Tooling

| Tool                                                                       | Purpose                            | Status                                  |
| -------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| Storybook / mockup sandbox preview                                         | State-by-state screenshots         | ✅ via `artifacts/mockup-sandbox`       |
| Playwright visual snapshots                                                | Regression detection on top routes | ⬜ planned                              |
| Axe DevTools                                                               | Per-surface a11y violation scan    | 🟡 manual today; CI planned in UX-14 §7 |
| `pnpm i18n:audit`                                                          | Locale-file parity                 | ✅ in CI                                |
| `scripts/verify-marketing-deploy.sh` + `scripts/verify-marketing-build.sh` | Marketing route markers            | ✅ in CI                                |

---

## 5. Engineering handoff

### 5.1 The handoff packet

When design hands a surface to engineering, the packet is exactly five things — no more, no less:

1. The UX-0x doc (the contract).
2. The mockup-sandbox URL (if the surface was prototyped on canvas).
3. The token / primitive reference (UX-02 components used, in priority order).
4. The acceptance-criteria checklist (the same list that becomes the design QA scorecard).
5. A list of unresolved questions, if any, flagged inline with "??" so engineering can answer or escalate.

No PNG mockups, no Figma links, no "see the prototype". The packet is text. If a doc isn't enough, the doc is incomplete — fix it before handoff.

### 5.2 Engineering questions design must answer in the doc

Every UX-0x doc must already answer these — surface them on every PR template:

- What routes are added / removed / changed?
- What new BFFs are required? Existing BFFs to extend?
- What new tables / columns / enum values?
- What new consent or permission gates apply?
- What new telemetry events?
- What new copy strings (and their `next-intl` keys)?
- What new accessibility primitives or modes?
- What states must be visually represented (empty / loading / error / partial / offline / consent-gated / permission-gated)?

If a UX-0x doc skips one of these, design QA blocks on it.

### 5.3 Code review hand-back

Engineering returns the surface to design only when:

- Every acceptance criterion in the UX-0x doc is checked off in the PR description.
- All four design QA lenses (§4.3) have a planned slot on the staging build.
- A new state ("admin in a not-yet-rostered school") that the doc didn't anticipate is documented as an _open question_ in a new draft against the same UX-0x doc — not silently invented in code.

### 5.4 Avoiding scope drift

The single biggest risk in handoff is silent scope expansion: engineering invents a state, design accepts it without re-validating with users, and the surface ships with an untested code path.

Mitigation: any code path that doesn't trace to a UX-0x state ID gets a `// TODO(UX-NN): not in contract, validate` comment + a one-line note in the PR description. Design QA grep-scans for `TODO(UX-` before signing off.

---

## 6. Per-release process

A "release" = one UX-0x sprint shipping to production. The full pipeline:

| Stage             | Gate                                                    | Artifact                                      |
| ----------------- | ------------------------------------------------------- | --------------------------------------------- |
| 1. Discovery      | UX-00 ticket exists with a problem statement            | `docs/ux/UX-00-audit.md` row                  |
| 2. Design         | UX-0x doc drafted, architect-reviewed                   | `docs/ux/UX-NN-*.md`                          |
| 3. Prototype      | Canvas mockup + Rung-3 thresholds met (§3.5)            | `docs/ux/usability-tests/<date>-<surface>.md` |
| 4. Implementation | PRs link the UX-0x doc + tick acceptance criteria       | PR description                                |
| 5. Design QA      | Four-lens pass (§4.3), all ✅ or 🟡                     | `docs/ux/design-qa/<date>-UX-NN.md`           |
| 6. CI             | i18n audit, marketing markers, a11y CI, type-check      | GitHub Actions green                          |
| 7. Staging        | Vercel preview verified                                 | `marketing-deploy-staging.yml` log            |
| 8. Production     | Replit autoscale (marketing) or Hetzner K3s (dashboard) | `marketing-smoke-test.yml` first-run-green    |
| 9. Observability  | First 24h dashboards reviewed                           | `/admin/platform/{ai-generation,alerts}`      |
| 10. Retrospective | Findings folded into UX-00                              | next UX-00 entry                              |

A sprint is "done" when stage 9 reports clean. A sprint is "in service" when stage 10 has updated UX-00.

---

## 7. The change-budget rule

A single UX-0x sprint may not change more than one cross-cutting surface at a time. Examples of cross-cutting surfaces: consent model, AI generation state machine, mastery ladder, navigation IA, theme system.

If a feature would require changing two cross-cutting surfaces, split it across two sprints. This is what keeps the design + engineering + testing loop short enough to actually iterate.

The change-budget enforcement: any PR that touches `lib/db/types.ts` `+` `lib/auth/types.ts` `+` `components/ui/*` simultaneously is flagged for explicit reviewer attention. (⬜ planned check in `.github/workflows/`.)

---

## 8. Documentation upkeep

Every UX-0x doc carries a "Last refreshed" header. The cadence:

- **Sprint refresh.** When the doc is the source of truth for an active sprint, refresh at sprint start.
- **Code-drift refresh.** When code changes a citation the doc relies on, the same PR that changes the code refreshes the doc.
- **Quarterly audit.** Once a quarter, walk the doc set top-to-bottom, refresh "Last refreshed" headers, mark anything still current as _verified current_.

The next quarterly audit is **2026-08-17**. Reminder lives in the `docs/ux/UX-00-audit.md` backlog (⬜ planned row to add).

---

## 9. Deliverables

1. ✅ This sprint's process contract.
2. ⬜ `docs/ux/usability-tests/` and `docs/ux/design-qa/` subdirs with a starter README.
3. ⬜ PR template (`/.github/pull_request_template.md`) carrying the §5.2 question set.
4. ⬜ Storybook / mockup-sandbox state-by-state harness for the top 10 surfaces.
5. ⬜ The cross-cutting-surface PR check (§7).
6. ⬜ Quarterly audit reminder in UX-00.

---

## 10. Acceptance criteria

- [ ] Every shipped UX-0x sprint has a usability-test entry and a design-QA entry on disk.
- [ ] No PR merges without ticking off its UX-0x acceptance checklist.
- [ ] No code path exists without a UX-0x state ID it traces to (or a `TODO(UX-NN)` for review).
- [ ] No sprint changes more than one cross-cutting surface at a time.
- [ ] Every UX-0x doc has a "Last refreshed" header within the current quarter.
- [ ] The next person onboarding to AIVO design can ship a sprint by reading one UX-0x doc plus this one.

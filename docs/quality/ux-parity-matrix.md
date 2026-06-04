# UI / UX Parity Matrix

> Sprint **GREEN-00** stub; populated by Sprint **GREEN-08**.
>
> **Rule:** A surface is green only when it has loading, empty, error, retry,
> permission-denied, consent-required, offline, and long-running-AI states
> wired up — and a visual regression baseline.

## Roles in scope

- Learner
- Parent
- Teacher
- District / School admin
- Platform admin
- Marketing visitor (public)

## Status legend

- 🟢 green — design-system aligned, all UX states covered, VR baseline saved
- 🟡 yellow — partial; missing one or more required states or VR baseline
- 🔴 red — placeholder dashboard / emoji-only tutor visuals / dead states

## Surfaces to verify

| Role    | Surface                       | Status | Notes                                                                 |
| ------- | ----------------------------- | ------ | --------------------------------------------------------------------- |
| Learner | Today's Mission home          | ⚫ TBD | must center mission card                                              |
| Learner | Lesson player                 | ⚫ TBD | one-task layout, tutor panel, hint/scaffold, read-aloud               |
| Learner | Quests / progress path        | ⚫ TBD | no fake progress                                                      |
| Learner | Homework Helper               | ⚫ TBD |                                                                       |
| Learner | Subjects                      | ⚫ TBD |                                                                       |
| Parent  | Dashboard                     | ⚫ TBD | learner readiness, progress, support-used, next-step, privacy/consent |
| Parent  | Learner detail                | ⚫ TBD |                                                                       |
| Parent  | Consent / privacy center      | ⚫ TBD |                                                                       |
| Parent  | Billing                       | ⚫ TBD |                                                                       |
| Teacher | Roster                        | ⚫ TBD | standards-aware                                                       |
| Teacher | Needs-attention               | ⚫ TBD |                                                                       |
| Teacher | Assignment builder            | ⚫ TBD | standards-aligned objectives                                          |
| Teacher | Learner detail (safe summary) | ⚫ TBD | no raw IEP                                                            |
| Admin   | Audit tables                  | ⚫ TBD |                                                                       |
| Admin   | AI safety queue               | ⚫ TBD |                                                                       |
| Admin   | Billing / seats               | ⚫ TBD |                                                                       |
| Admin   | Roster import health          | ⚫ TBD |                                                                       |
| Admin   | Incident / status             | ⚫ TBD |                                                                       |
| Mobile  | Role chooser                  | ⚫ TBD |                                                                       |
| Mobile  | Learner Mode                  | ⚫ TBD | parent lock for protected actions                                     |
| Mobile  | Parent Mode                   | ⚫ TBD |                                                                       |
| Mobile  | Teacher Mode                  | ⚫ TBD | roster-scoped                                                         |
| Mobile  | Admin-Lite Mode               | ⚫ TBD |                                                                       |

## Required UX states (every surface, every role)

- Loading
- Empty
- Error
- Retry
- Permission denied
- Consent required
- Offline
- Long-running AI generation

## GREEN-08 deliverable

`scripts/ux-parity-check.mjs` (run via `pnpm ux:parity`, required gate in
`green:check` as of 2026-06-04) enforces:

- canonical UX-state primitives exist on disk and export the expected
  symbols (`EmptyState` in `@aivo/ui` and `apps/web-v2/components/ui`,
  `OfflineBanner` in `apps/web-v2/components/offline`, canonical app
  shell at `apps/web-v2/app/layout.tsx`);
- every shipping role surface (learner, parent, teacher, admin/school,
  admin/district) uses `EmptyState` in at least one `page.tsx` — no
  silent empty-data dead ends;
- the curated web⇄mobile parity matrix in
  `scripts/web-mobile-parity-check.mjs` is clean under `--strict`
  (subprocess invocation; non-zero exit fails the gate).

Out of scope for this gate (tracked elsewhere):

- axe-core / keyboard / screen-reader / reduced-motion snapshots — owned
  by GREEN-09 `a11y:audit`;
- per-surface visual-regression baseline — downstream content sprint;
- "no emoji-only tutor visuals" — downstream tutor-quality sprint
  (`learner/baseline/intro` still uses an emoji avatar).

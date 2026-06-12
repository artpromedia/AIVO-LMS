# AIVO-LMS Remediation — Master Sprint Plan

**Authored:** 2026-06-12 · **Repo state:** HEAD `bad39c74` · **Status:** awaiting owner review — do NOT execute any sprint without explicit instruction.

## Source of truth

The brief named `aivo-audit-report.md` as input; **that file does not exist at the repo root**. The operative audit is **`aivo-product-quality-report.md`** (repo root, untracked — identical to the copy the owner uploaded when commissioning this plan). Every gap below was re-verified against the working tree at HEAD `bad39c74` before a sprint was planned around it; no sprint is based on an assumed gap.

### Corrections discovered during path verification

The audit itself was verified 2026-06-12, but four of its remediation pointers needed adjustment after this planning session's read-only confirmation pass. The sprint prompts use the corrected facts:

| Audit statement | Verified reality | Effect on plan |
|---|---|---|
| Tutor art component cited as `packages/ui/src/baseline/TutorCard.tsx` | No such file. Real targets: `packages/ui/src/learner-dashboard/TutorAvatar.tsx`, `TutorAvatarCard.tsx`, `FeaturedLessonCard.tsx`; mobile target `packages/mobile-ui/src/TutorCard.tsx` | Sprint 06 work orders use real paths |
| "Mobile lacks high-contrast / has a parallel calm-focus-standard model" | `apps/mobile/context/SensoryModeProvider.tsx:65` already implements `["standard","calm","high-contrast"]` from `INCLUSIVE_WARM_BY_MODE` — same trio as web | Sprint 05 scope narrowed: no high-contrast work needed; gap is dyslexia font + skeletons + stage consumption |
| "Voice selection not exposed to the learner on web" | `apps/web-v2/app/learner/settings/audio/{page,form}.tsx` exists and is wired to `getLearnerVoicePreference`/`upsertLearnerVoicePreference` | Sprint 03 carries only a small cross-link EDIT, not a new selector |
| Emoji "tutor avatars" cited at `learner/home/page.tsx:484,491,502` | Those lines are `MessageCard avatar=` props; tutor tiles render via `TutorAvatar` tone system (`page.tsx:136-149`) | Sprint 06 targets both correctly |

### Severity mapping

The audit doesn't use 🚨/⚠️ markers; this plan assigns them: 🚨 **Blocker** = the audit's "three things that most undermine enterprise perception" (§1); ⚠️ **Major** = remaining Top-10 items (§4) + Quick-win/Structural roadmap rows (§5); 🟡 **Strategic** = §5 Strategic rows included as late sprints or deferred with rationale.

## Gap register → sprint coverage

| ID | Sev | Gap (audit ref) | Closed by |
|---|---|---|---|
| B1 | 🚨 | Phantom "Emma" on `/parent/home-v2` (§1.1, §4 #1) | Sprint 01 |
| B2 | 🚨 | Sensory adapter + reduced motion not wired into lesson runtimes, web & mobile (§1.2, §4 #3) | Sprints 03 (web), 04 (mobile) |
| B3 | 🚨 | Axe suites not a CI gate; admin a11y unmeasured (§1.3) | Sprint 02 |
| M1 | ⚠️ | Admin one-click destructive actions; URL-param feedback (§4 #7) | Sprint 10 |
| M2 | ⚠️ | Thin state coverage: 6/138 `loading.tsx`, chrome-less 404s, signup dead-button (§4 #9, §B) | Sprint 09 |
| M3 | ⚠️ | No toast/feedback layer; 128 raw `fetch(`; swallowed catches in lesson player (§4 #6, §F) | Sprint 08 |
| M4 | ⚠️ | Tutor faces/mascots/reward art missing from product (§4 #4) | Sprint 06 |
| M5 | ⚠️ | Learner home dashboard-first, six "0%" cards (§4 #5) | Sprint 07 |
| M6 | ⚠️ | Mobile parity: stage reduced-motion + SR announcements; dyslexia font; skeletons (§4 #8, narrowed per corrections) | Sprints 04, 05 |
| M7 | ⚠️ | Admin lists lack search/sort/pagination/bulk outside audit log (§4 #9-admin) | Sprint 11 |
| M8 | ⚠️ | God files: `lesson-player.tsx` 1,133 ln; `MobileSurfaceRenderer.tsx` 1,578 ln (§4 #10) | Sprints 12, 13 |
| M9 | ⚠️ | Parent-facing jargon: "Review brain clone" CTA (`lib/learner/readiness.ts:58`); hardcoded English on learner card (§5 jargon row) | Sprint 01 |
| M10 | ⚠️ | No Postgres RLS backstop; audit logging selective; dead `@aivo/ops-alert` package (§E, §5) | Sprint 14 |
| S1 | 🟡 | Per-tutor lesson identity + sensory/theme visual-regression matrix (§5 strategic) | Sprint 15 |

**Deferred — decision-gated (not sprints; never plan around an assumption):**
- *Product analytics vs ADR-of-absence* (§E): requires an owner decision (privacy posture). Prompt can be authored on request after the decision.
- *Admin i18n* (§E): depends on whether district self-serve in non-English districts is on the roadmap.
- *Offline lesson content on mobile* (§5 strategic): large; schedule after Sprint 13 if prioritized.
- *Typography unification (web Satoshi vs brand Fredoka)* (§A): brand decision, then a small sprint.
- *Command palette, Suspense/streaming adoption, docs-staleness CI gate*: quality-of-life; below Major threshold.

## Execution order & dependency graph

```
01 trust ──────────────────────────────┐
02 a11y-ci ────────────────────────────┤  (independent starters)
03 web-sensory-stage ──────────┐       │
04 mobile-stage-a11y ──┐       │       │
05 mobile-reading ─────┼───────┤       │
06 tutor-art ──┬───────┤       │       │
               ▼       │       │       │
07 learner-home-focus  │       │       │
08 web-data-layer ──┬──┤       │       │
                    ▼  │       │       │
09 web-states       │  │       │       │
10 admin-safe-actions ─┼──► 11 admin-tables
12 lesson-player-split ◄─ depends on 08
13 mobile-renderer-split ◄─ depends on 04
14 platform-hardening   (independent; services/db only)
15 tutor-identity ◄─ depends on 03, 06 (12 recommended first)
```

Recommended serial order: **01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15.** Hard dependencies are listed in each prompt's "Depends on"; everything else may be reordered.

## Sprint index

| # | File | One-line goal | Closes | Complexity | E2E-demoable result |
|---|---|---|---|---|---|
| 01 | `sprint-01-parent-trust-real-data.md` | `/parent/home-v2` shows only the real roster; "brain clone" never shown to parents | B1, M9 | **S–M** | Sign in as parent → home-v2 greets with Sky/Rio, real setup state; learner card CTA reads "Review learning profile" |
| 02 | `sprint-02-a11y-ci-gate.md` | Axe violations block PRs on web + first admin axe coverage | B3 | **S–M** | A seeded violation turns the new CI lane red; revert turns it green |
| 03 | `sprint-03-web-sensory-stage.md` | Sensory profile + reduced motion visibly govern the web lesson player | B2(web) | **M–L** | Toggle calm/high-contrast or a hyper-visual profile → stage slows/desaturates; `no-inert-prefs` proves consumers |
| 04 | `sprint-04-mobile-stage-a11y.md` | Mobile lesson runtime honors reduce-motion and announces feedback to TalkBack/VoiceOver | B2(mobile), M6a | **M** | With OS reduce-motion on, stage transitions are static; answers are announced |
| 05 | `sprint-05-mobile-reading-loading.md` | Dyslexia-friendly font on mobile + shimmer skeletons replace spinners | M6b | **M** | Toggle dyslexia font in settings → app-wide typeface swap; dashboards show skeletons on cold load |
| 06 | `sprint-06-tutor-art-mascots.md` | Tutors have faces and rewards have stickers across web + mobile | M4 | **M** | Learner home/baseline show tutor portraits (sensory-reduced variant in calm/HC); Rewards shows mascot art |
| 07 | `sprint-07-learner-home-focus.md` | Learner home leads with one primary action; no "0%" wall | M5 | **M** | Home shows a single Today's Mission hero; subjects live one tap away with stage-words, not percentages |
| 08 | `sprint-08-web-data-layer-toasts.md` | One mutation/query layer with toasts; zero swallowed catches in the lesson player | M3 | **L** | Kill the network mid-lesson → retry toast + recovery; messages/parent dashboard share the layer |
| 09 | `sprint-09-web-state-coverage.md` | Every heavy route has a skeleton; 404s keep role chrome; signup validates inline | M2 | **M** | Bad learner URL shows parent-chrome 404; signup shows per-field errors with an always-enabled submit |
| 10 | `sprint-10-admin-safe-actions.md` | Destructive admin actions confirm; feedback stops living in the URL | M1 | **M** | Revoking a SCIM token demands typed confirmation; errors render in an aria-live flash without navigation |
| 11 | `sprint-11-admin-table-ergonomics.md` | Tenants/users/learners/leads get search/sort/pagination/export + audited bulk actions | M7 | **M–L** | Search a user across 3 pages, bulk-revoke two invites, see both in the audit log |
| 12 | `sprint-12-lesson-player-decomposition.md` | Lesson player split into <400-line modules with zero behavior change | M8a | **L** | All lesson-player e2e suites green; file-length CI gate active for the directory |
| 13 | `sprint-13-mobile-renderer-decomposition.md` | MobileSurfaceRenderer split per-surface; mobile `any`-count ratcheted down | M8b | **L** | Stage plays all surface types; vitest suite green; lint ratchet enforced |
| 14 | `sprint-14-platform-hardening.md` | Postgres RLS backstop + audited-by-default write routes + dead package removed | M10 | **L** | Compose test proves an unscoped query returns zero rows; CI fails on un-audited write route; `@aivo/ops-alert` gone |
| 15 | `sprint-15-tutor-identity-theming.md` | Each tutor's lesson is visually theirs; sensory×theme visual matrix in CI | S1 | **M–L** | Nova vs Sage lessons distinguishable in 5 s; snapshot matrix green across modes |

## Conventions used by every sprint prompt

- **Verification baseline:** all cited paths/line numbers verified at HEAD `bad39c74`. If the implementing session finds drift, it must re-locate by the quoted symbol/string, not skip the work order.
- **Dev runs:** web `corepack pnpm --filter @aivo/web-v2 dev` (port 5000; `AUTH_MODE` defaults to `mock` outside production — `apps/web-v2/lib/env.ts:35-43`; mock session cookie `aivo_mock_session` ∈ {parent, learner, teacher, …} per `apps/web-v2/lib/auth/mock-session.ts`). Admin e2e runs ride `docker-compose.e2e.yml` (job `sprint12-e2e`, `.github/workflows/ci.yml:742`). Mobile: `corepack pnpm --filter @aivo/mobile dev` (Expo web) + vitest; native checks called out where needed.
- **No new colors by hand:** raw hex in web app code fails ESLint (`eslint.config.mjs:79-115`). Use `iw-*` utilities / `@aivo/brand` tokens; mobile uses `useSensoryPalette()` / `packages/mobile-ui/src/theme.ts`.
- **i18n:** any new user-facing string lands in all 10 catalogs (`apps/web-v2/lib/i18n/messages/*.json`, `apps/mobile/i18n/*.json`); CI enforces parity.
- **Checkpoint discipline:** every sprint ends with a summary + pause; no commits without explicit owner instruction.

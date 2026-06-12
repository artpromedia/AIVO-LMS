# Sprint 01 — Parent trust: real learners on home-v2, no clinical jargon

## Goal

At the end of this sprint, `/parent/home-v2` renders **only the signed-in parent's real learners** — greeting, hero CTA, setup track, and metric cards all derive from the same data source as `/parent/home` — and no parent-facing surface anywhere in web-v2 says "brain clone" or any "cloning" language. Today the page hardcodes a phantom child ("Emma") and fabricated setup/metric state, and the parent roster card's primary CTA literally says "Review brain clone". This sprint closes audit gaps **B1 (🚨 phantom learner)** and **M9 (⚠️ clinical jargon + hardcoded English)**.

## Context

You are in the AIVO-LMS pnpm/turbo monorepo. The learner/parent web app is `apps/web-v2` (Next.js 15 App Router, React Server Components + server actions).

- **Auth in dev:** `AUTH_MODE` defaults to `"mock"` outside production (`apps/web-v2/lib/env.ts:35-43`). A mock session is just a cookie `aivo_mock_session=<role>`; the seeded parent is "Riley Parent" with learners **Sky** and **Rio** (`apps/web-v2/lib/auth/mock-session.ts`). Run with `corepack pnpm --filter @aivo/web-v2 dev` → port 5000.
- **Data layer:** pages call typed repo functions from `apps/web-v2/lib/db/repos.ts` (memory adapter in dev, Postgres in prod — same API). The reference implementation for this sprint is **`apps/web-v2/app/parent/home/page.tsx`**, which already does it right: it imports `listLearnersForParent` and `refreshLearnerReadiness` from `@/lib/db/repos` (`repos.ts:149` and `repos.ts:200`) and renders `LearnerCard`s.
- **Readiness engine:** `apps/web-v2/lib/learner/readiness.ts` computes each learner's next actionable step (label + href). This is the canonical source for "what should the parent do next" — the home-v2 setup track must consume it rather than invent its own state.
- **The offending page:** `apps/web-v2/app/parent/home-v2/page.tsx`. Lines 39–44 contain:
  ```ts
  // Placeholder content data — wiring to listLearnersForParent is a
  // separate task and is intentionally out of scope here.
  const learnerFirstName = "Emma";
  const learnerHref = "/parent/learners/emma";
  ```
  Below that, `setupSteps` hardcodes `status: "done"` values, and the metric-card grid hardcodes copy like "Planned: 35 minutes. Emma can start whenever." The page is linked from `apps/web-v2/app/parent/learners/[learnerId]/snapshot/page.tsx:91`, so real users can reach it.
- **Jargon sources (verified):**
  - `apps/web-v2/lib/learner/readiness.ts:58` → `label: "Review brain clone"` (this string surfaces on the parent roster card's primary button).
  - `apps/web-v2/components/parent/learner-card.tsx:41-48` → hardcoded English (`Open profile`, plus the readiness label) instead of `next-intl` keys.
  - `apps/web-v2/lib/i18n/messages/en.json:961-965` → the brain-clone-watch experience copy: `"clone_eyebrow": "Cloning Brain"`, `"clone_master_label": "AIVO Master Brain"`, `"clone_caption": "Cloning AIVO's learning model into {name}'s personal brain…"`, etc. (12 `clone` occurrences in the catalog). Note: the `awakening_*` strings nearby ("Meet your brain") are intentional learner copy — **keep those**; only "clone/cloning" phrasing goes.
- **i18n:** all user-facing strings live in `apps/web-v2/lib/i18n/messages/{en,es,fr,de,zh,ja,ko,hi,ar,pt}.json`. CI enforces catalog parity (`scripts/ci/check-i18n-coverage.mjs`), so every key you add/change must land in all 10 files.
- **Styling:** raw hex is banned by ESLint in web-v2 (`eslint.config.mjs:79-115`); use existing `iw-*` utilities and components (`@aivo/ui`, `apps/web-v2/components/ui/*`).

## Work orders

### DELETE
1. `apps/web-v2/app/parent/home-v2/page.tsx:39-44` — the placeholder comment block and the `learnerFirstName` / `learnerHref` constants. Also delete the hardcoded `setupSteps` literal statuses and every metric-card string that asserts data we are not actually reading (e.g., "Planned: 35 minutes…", the static "Stress / support signal: Calm" card). **Do not leave any card rendering invented values.**

### CREATE
1. `apps/web-v2/e2e/parent-home-v2.playwright.ts` — Playwright spec (mock parent session via `aivo_mock_session=parent` cookie, mirroring existing specs in `apps/web-v2/e2e/`):
   - asserts the hero greeting names a learner returned by the roster (Sky or Rio in the seed), **and** asserts the string "Emma" appears nowhere on the page;
   - asserts the zero-learner state: clear the seed (use whatever helper existing specs use for store reset; see `apps/web-v2/e2e/learner-smoke.playwright.ts` for the pattern) → page renders the add-learner empty state, not a crash;
   - tag at least one assertion block `@a11y` and run `injectAxe`/`checkA11y` on the page (pattern: `apps/web-v2/e2e/audit-a11y.playwright.ts:7,26-27`).

### REFACTOR
1. `apps/web-v2/app/parent/home-v2/page.tsx` — make it a real data page:
   - `const session = await requirePageRole(["parent"])` (already present) → `const learners = await listLearnersForParent(session.userId, session.tenantId)` (match the exact signature used by `app/parent/home/page.tsx`; copy its call shape).
   - **Zero learners:** render the existing `EmptyState` component (`apps/web-v2/components/ui/empty-state.tsx`) with the same add-learner CTA `/parent/learners/new` that `/parent/home` uses.
   - **One or more learners:** feature the learner whose readiness has the most actionable next step (reuse `refreshLearnerReadiness` per learner, as `/parent/home` does). Hero greeting uses that learner's real first name; hero CTA href = the readiness `next.href`; if more than one learner, render a compact "and N more" link to `/parent/learners`.
   - **Setup track:** derive each step's `status` from the readiness/consent data the readiness engine already exposes — do not re-derive from scratch and do not hardcode. If a given step's state is not derivable from existing repos, drop that step from the track (shrinking the track is acceptable; faking state is not).
   - **Metric cards:** keep only cards with a real backing read. Verified-available sources: baseline status (the readiness engine and `app/parent/learners/[learnerId]/baseline/*` pages read it) and pending-approvals count (the source backing `PendingRecommendationsPanel` on `app/parent/learners/[learnerId]/page.tsx`). Wire those two; remove the others (stress signal, mastery trend, learning time, IEP support) **unless** you find a real repo read for them — check `repos.ts` first; if absent, they go.
2. `apps/web-v2/components/parent/learner-card.tsx` — route all visible strings through `next-intl` (`getTranslations`/`useTranslations` per the file's server/client nature): `Open profile` and the readiness CTA label. Follow the key style used in `parent.*` namespaces in `en.json`.

### EDIT
1. `apps/web-v2/lib/learner/readiness.ts:58` — change `label: "Review brain clone"` to a translation **key** (e.g., `parent.readiness.review_learning_profile`) resolved at render time in `learner-card.tsx`, with English copy **"Review learning profile"**. Scan the rest of `readiness.ts` for other display-English labels and convert them the same way (they all surface on parent cards).
2. `apps/web-v2/lib/i18n/messages/en.json` — rewrite the `clone_*` display strings (lines ~961-965) without clone/cloning language. Suggested: eyebrow "Building {name}'s learning profile", master label "AIVO learning model", caption "Shaping AIVO's learning model around {name}…". Keep keys and interpolations identical so no component changes are needed; keep `awakening_*` strings as-is. Apply equivalent rewrites to the other 9 locale files (translate faithfully; if you cannot produce a quality translation for a locale, mirror that locale's existing register using the English meaning — never leave a catalog key missing).
3. Add the new keys from work orders REFACTOR-2 / EDIT-1 to **all 10** catalogs.
4. Run `grep -rn -i "clone" apps/web-v2/lib/i18n/messages/ apps/web-v2/components apps/web-v2/app/parent` and confirm every remaining hit is either a code identifier (routes like `brain-clone-watch`, variable names — these stay) or learner-internal `awakening_*` copy. No parent-facing *display string* may contain "clone".

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. `corepack pnpm --filter @aivo/web-v2 dev` → set cookie `aivo_mock_session=parent` → open `http://localhost:5000/parent/home-v2`:
   - greeting names **Sky or Rio** (never Emma), hero CTA navigates to that learner's real next step;
   - setup track statuses change when you complete a step (e.g., finish consent via `/onboarding/consent` and reload — the step flips);
   - every metric card displays a value you can trace to a repo read.
2. `http://localhost:5000/parent/learners` roster card primary button reads **"Review learning profile"** (when readiness is in that state) and is translated (switch locale cookie to `es` — no English leakage on the card).
3. Commands all green:
   - `corepack pnpm --filter @aivo/web-v2 typecheck && corepack pnpm --filter @aivo/web-v2 lint`
   - `corepack pnpm --filter @aivo/web-v2 test`
   - `corepack pnpm --filter @aivo/web-v2 exec playwright test parent-home-v2`
   - `node scripts/ci/check-i18n-coverage.mjs` (catalog parity)
4. The grep from EDIT-4 returns no parent-facing display-string hits.

## Tests

- New: `apps/web-v2/e2e/parent-home-v2.playwright.ts` (see CREATE-1).
- Update: any unit test snapshotting readiness labels (`apps/web-v2/lib/learner/*.test.ts` — search for "Review brain clone") must be updated to the new key/label.
- Run the **full** web-v2 suite (`test`, `e2e` for touched specs) plus `node scripts/ci/check-i18n-coverage.mjs`; previously green suites must stay green.

## Out of scope

- Any visual redesign of home-v2 (layout/hero stay as-is; only data wiring + copy).
- The learner-home IA changes (Sprint 07), toast/data-layer work (Sprint 08), renaming routes or DB fields containing `brain`/`clone` (identifiers are not user-facing).
- Mobile and admin surfaces.

## Depends on

Nothing. This is the first sprint.

## Checkpoint

At sprint end: summarize every file changed (path + one line), paste the DoD command outputs, list the i18n keys added/changed, and **pause for owner review. Do not commit, stage, or push unless explicitly instructed.**

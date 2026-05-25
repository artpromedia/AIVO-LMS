# 0005 — Web learner i18n foundation: namespace + audit visibility + coverage gate

- **Status:** Accepted
- **Date:** 2026-05-25
- **Related:** Sprint 4

## Context

`apps/web-v2/lib/i18n/messages/*.json` (10 locales, en + 9) shipped with
only 86 keys, and 75 of those 86 (87%) were still identical to English
in fr/de/ar/zh — the audit script (`scripts/i18n-audit.mjs`) didn't
include web-v2 at all, so this drift was invisible. Across the 37 .tsx
files under `apps/web-v2/app/learner/**`, only 2 actually called
`useTranslations`/`getTranslations` (the brain-clone awakening client
and `accept-invite-form`). The learner UI was effectively English-only
regardless of the locale a parent picked.

A full extraction of all 254 web .tsx files is multi-sprint work. The
gap the platform team has to close first is the *foundation*: the
audit must see the web catalog, a parity test must prevent silent key
drift, and a couple of high-traffic pages must demonstrate the
pattern so the curriculum-content team can copy it.

## Decision

We add a focused i18n foundation for the web learner UI:

- **Catalog expansion** — `apps/web-v2/lib/i18n/messages/en.json` now
  exposes a `learner` namespace covering errors, progress mastery
  labels, notifications, tutor, homework, and the subjects page (31
  new keys). All 9 non-en locales receive credible first-pass
  translations for the new namespace; the existing 86-key surface is
  untouched.

- **Audit visibility** — `scripts/i18n-audit.mjs` now includes
  `apps/web-v2/lib/i18n/messages/` in its `APPS` list, so the
  per-locale untranslated count for the web catalog appears in every
  `pnpm i18n:audit` run.

- **Coverage gate** — new
  `apps/web-v2/lib/i18n/i18n-coverage.test.ts` (vitest) asserts:
  - every non-en locale has the same flattened key set as en;
  - no `learner.*` value is identical to its English counterpart,
    modulo a per-locale loanword allowlist (`Notifications` in fr,
    `Conversation` in fr/pt — both legitimate spellings).

- **Backlog scanner** — `scripts/i18n-extract.mjs` (root script
  `pnpm i18n:extract`) walks `apps/web-v2/app/learner/**` and reports
  hardcoded English candidates in JSX text, `aria-label`,
  `placeholder`, and `title` attributes. Output is informational — the
  scanner exits 0 — and seeds the remaining extraction backlog. First
  run reports 174 candidates.

- **Demonstration extractions** — four representative pages now consume
  the new namespace:
  - `apps/web-v2/app/learner/error.tsx` (client) — `useTranslations`
  - `apps/web-v2/app/learner/notifications/page.tsx` — `getTranslations`
  - `apps/web-v2/app/learner/progress/page.tsx` — `getTranslations`,
    with the `masteryLabel` helper now translator-aware.
  - `apps/web-v2/app/learner/subjects/page.tsx` — both `learner.subjects`
    and `learner.progress` namespaces, with `masteryLabel` shared.

## Consequences

- **Positive:**
  - Web catalog appears in `pnpm i18n:audit` for the first time
    (`[web] base=117 keys`); untranslated rate on non-Latin locales
    drops from 87% to ~64% for the namespaces we touched.
  - The coverage test makes it impossible to add a `learner.*` key in
    en without adding (and translating) it in all 9 other locales.
  - Four end-to-end examples show the extraction pattern for the
    remaining 174-string backlog.
- **Negative:**
  - Translations were authored in a single pass without native-speaker
    review. They are credible but should be human-validated before any
    customer-facing launch in those locales. The coverage test only
    confirms "not identical to en," not "high quality."
  - The legacy `parent.add_learner` block (50 keys) is still
    English-only in fr/de/ar/hi/ja/ko/pt/zh. That predates this sprint
    and is tracked as a follow-up.
- **Neutral / follow-ups:**
  - 174 candidate strings remain hardcoded under
    `apps/web-v2/app/learner/**`; the scanner gives a deterministic
    backlog to chew through.
  - The audit currently treats web as warn-only (no hard failures from
    web). Once the backlog is depleted, the gate can be promoted to a
    hard-fail in `scripts/ci/check-i18n-coverage.mjs`.

## Alternatives Considered

- **Big-bang extraction of all 37 learner pages.** Rejected: would
  produce a 200+ key namespace with no native-speaker review path,
  blocking the sprint for weeks. The phased approach lets translation
  quality and key churn both stabilise.
- **Auto-translate everything via DeepL / Google Cloud Translation in
  CI.** Considered: that's the right long-term move (per `i18n-translate.mjs`
  in the Sprint 4 prompt). Out of scope for this sprint because it
  requires an API key + a queue file for human review.

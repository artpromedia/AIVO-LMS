# 0006 — Mobile i18n parity gate + missing-keys regression closed

- **Status:** Accepted
- **Date:** 2026-05-25
- **Related:** Sprint 5, ADR 0005

## Context

`scripts/i18n-audit.mjs` reported the mobile catalog as **18 hard
failures** before this sprint: every non-en locale (`ar`, `de`, `es`,
`fr`, `hi`, `ja`, `ko`, `pt`, `zh`) was missing the same two keys —
`learnerSettings.language` and `learnerSettings.languageDesc` — added
to `en.json` after the locales were last regenerated. Hard failures
block the release gate.

On top of the missing-keys regression, every non-Spanish locale had
~613 "untranslated" warnings (values still identical to English) — the
backlog of un-translated strings carried forward from the catalog
expansion. Translating ~600 strings × 8 locales × native-speaker review
is not a platform-sprint scope item; it belongs with a translator
workstream.

## Decision

This sprint closes the hard failure and locks in the parity contract.
The translation backlog itself moves to an explicit, prioritised
ownership ledger.

- **Missing keys.** `apps/mobile/i18n/{ar,de,es,fr,hi,ja,ko,pt,zh}.json`
  receive `learnerSettings.language` and `learnerSettings.languageDesc`
  with real translations. `pnpm i18n:audit` mobile section now reports
  `missing=0` for every locale.

- **Parity gate.** `apps/mobile/__tests__/i18n-coverage.test.ts` (new,
  20 tests, mirrors the web gate from ADR 0005):
  - asserts the 10-locale shape (en + 9);
  - asserts every non-en locale has the same flattened key set as en
    (catches both missing and orphan keys);
  - pins the two Sprint-5 keys: they must exist AND must not be
    identical to English.

- **Ownership doc.** `apps/mobile/i18n/README.md` documents the locale
  inventory, RTL note for Arabic, the add/rename/remove workflow, and
  a five-step prioritised translation backlog.

The translation pipeline itself (an automated DeepL / Google Cloud
Translation step with a queue file for human review) is not added in
this sprint — that is the natural next move once a vendor key is in
place.

## Consequences

- **Positive:**
  - Mobile i18n audit: **18 hard failures → 0**. The release gate is
    unblocked.
  - The parity test catches new missing/orphan keys at PR time, before
    the audit script runs in CI, so future drift is impossible to merge
    silently.
  - The README gives translators (and engineers triaging audit
    warnings) a clear ledger of what is done vs outstanding.
- **Negative:**
  - The ~600 still-untranslated strings per non-Spanish locale remain
    untranslated. They appear as `warn` lines in `pnpm i18n:audit` and
    do not block CI today, but the gate will tighten as the backlog
    closes.
  - No automated translation pipeline yet. Adding one needs a vendor
    decision (DeepL vs Google vs Anthropic) and a queue mechanism for
    human review.
- **Neutral / follow-ups:**
  - Sprint 8 (RTL pass) will visit `ar` rendering end-to-end; the
    catalog is parity-complete and ready when that sprint starts.
  - The web gate (ADR 0005) and this mobile gate are structurally
    identical; a future refactor could lift the parity test into a
    shared helper. Not blocking; left as a non-urgent cleanup.

## Alternatives Considered

- **Translate all ~600 strings × 9 locales in this sprint.** Rejected:
  multi-week translator-team work, not a platform sprint. The honest
  scope is to close the hard failure and pin parity.
- **Drop the unused non-en locales until they have translators.**
  Rejected: the catalog skeletons are useful for the eventual
  translator workflow, and removing them would break locale negotiation
  for users who pick a locale we haven't translated yet (silent
  fall-back to en is a worse UX than skeleton-with-en-strings).

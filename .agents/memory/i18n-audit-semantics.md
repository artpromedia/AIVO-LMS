---
name: web-v2 i18n audit semantics
description: How scripts/i18n-audit.mjs decides pass/fail, and the phantom-Emma e2e payload gotcha.
---

# i18n audit semantics (web / marketing / mobile)

`scripts/i18n-audit.mjs` (run via `pnpm i18n:audit`) compares each locale file's
flattened keys against the app's `en.json` base **only**:

- **missing** (key in `en`, absent in locale) → hard FAIL
- **orphan** (key in locale, absent in `en`) → hard FAIL
- **untranslated** (locale value byte-identical to English) → WARNING only

`i18n:audit` does **not** pass `--strict-untranslated`, so untranslated warnings
never fail CI (only `i18n:audit:verbose`/`--strict-untranslated` would).

**It never scans source code for key usage.** "orphan" means "in locale but not
in base", NOT "unused in code". So unused message keys are harmless to the audit
— do not waste effort deleting keys to satisfy "orphan by usage" (that concept
doesn't exist here).

**How to apply:** when you add message keys, add the SAME keys to all 10 web-v2
locale files (`apps/web-v2/lib/i18n/messages/{en,ar,de,es,fr,hi,ja,ko,pt,zh}.json`).
English fallback values are fine — they only produce untranslated *warnings*, not
failures. A small node deep-merge script that inserts missing keys into every
locale is the reliable way to keep parity.

## Phantom-Emma e2e gotcha

`apps/web-v2/e2e/parent-home-v2.playwright.ts` asserts the rendered page never
shows the phantom learner "Emma" — but it checks `body.innerText()` (visible
text), not page source. The i18n key
`parent.add_learner.first_name_placeholder = "e.g. Emma"` gets serialized into
the NextIntl client-messages `<script>` payload, so `grep Emma` on the raw SSR
HTML returns a hit even when no learner named Emma is rendered. The guard still
passes. Verify with `sed 's/<script[^>]*>.*<\/script>//g; s/<[^>]*>/ /g'` before
worrying about a real regression.

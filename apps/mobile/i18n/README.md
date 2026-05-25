# Mobile i18n catalogs

10 locale JSON files (en + 9). Each non-en locale has the same flattened
key set as `en.json` — drift breaks `__tests__/i18n-coverage.test.ts`
and the repo-level `pnpm i18n:audit` gate.

## Locale inventory

| Locale | File | Direction | Native name | Status |
|---|---|---|---|---|
| `en` | `en.json` | LTR | English | Source of truth — 804 keys |
| `es` | `es.json` | LTR | Español | Largely translated (~42 strings still match en) |
| `fr` | `fr.json` | LTR | Français | Skeleton — ~615 strings still match en |
| `de` | `de.json` | LTR | Deutsch | Skeleton — ~611 strings still match en |
| `pt` | `pt.json` | LTR | Português | Skeleton — ~613 strings still match en |
| `ar` | `ar.json` | **RTL** | العربية | Skeleton — ~613 strings still match en |
| `hi` | `hi.json` | LTR | हिन्दी | Skeleton — ~613 strings still match en |
| `ja` | `ja.json` | LTR | 日本語 | Skeleton — ~613 strings still match en |
| `ko` | `ko.json` | LTR | 한국어 | Skeleton — ~613 strings still match en |
| `zh` | `zh.json` | LTR | 中文 | Skeleton — ~613 strings still match en |

## Workflow

1. **Adding a key.** Add to `en.json` first. The parity test will fail
   for every non-en locale until the same key is added there. Use a
   real translation, not the English string — the audit script will
   warn (not fail) on identical-to-en values, but the gate's hard
   ceiling for untranslated strings will eventually tighten.

2. **Renaming a key.** Update every locale in the same commit. The
   parity test catches drift in either direction (missing OR orphan).

3. **Removing a key.** Same — remove from every locale.

4. **Translation pipeline.** No automated pipeline ships yet; until
   one does (`scripts/i18n-translate.mjs` is in the Sprint 4 / Sprint 5
   prompts), translations go through the `apps/mobile/i18n/*.json`
   files directly with human review.

## RTL note

Arabic (`ar`) renders right-to-left. The mobile app's RTL layout pass
is tracked by Sprint 8 (`docs/adr/0006-...`-onwards). Until that lands,
ar strings still render but with LTR layout.

## Audits

- `pnpm i18n:audit` — repo-level, surfaces missing/orphan key counts
  per locale plus an "untranslated" warning when a value is identical
  to English (modulo a per-locale loanword allowlist in the script).
- `pnpm --filter @aivo/mobile test __tests__/i18n-coverage.test.ts` —
  package-local parity gate; runs in CI before the mobile bundle is
  built.

## Translation backlog ownership

The ~600 still-identical-to-en strings per non-Spanish locale are not
ignored — they are tracked as the "mobile translation backlog" and
worked through namespace by namespace. Priority order (highest impact
first):

1. `common`, `tabs`, `auth` — every learner sees these.
2. `learnerStage`, `learnerHomework`, `learnerHomeworkSession`,
   `learnerTutor` — the lesson-player and tutor surfaces.
3. `learner`, `learnerSettings`, `learnerGamification`, `learnerShop` —
   navigation and engagement.
4. `parentOnboard`, `parentBilling`, `parent`, `parentSettings` —
   guardian-only.
5. Therapist + teacher namespaces — internal-only, lowest priority.

A separate sprint (Sprint 5-cont) will translate batches 1–3 across
all locales once a native-speaker review path is in place.

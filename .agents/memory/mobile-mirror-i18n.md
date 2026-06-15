---
name: Mobile "mirror of web" screens & i18n parity
description: How new apps/mobile parent screens that mirror web surfaces handle theming + i18n correctly
---

When mirroring a web parent surface onto `apps/mobile`, copy `app/(parent)/reports.tsx` structure: `useSensoryPalette()` for Family tokens (palette.ink/inkMuted/bgPage/bgRaised/border/accent/accentSoft/primary — no raw hex), `ResponsiveScreen` + `Card` (from `@/components/ui`) + `EmptyState`/`LoadingState` (from `@aivo/mobile-ui`), `fontFamilies` for type. Register the screen in `app/(parent)/_layout.tsx` as `<Tabs.Screen name="..." options={{ href: null }} />` (reachable via navigation, not a bottom tab) and add an explicit entry-point link so it isn't orphaned.

**i18n rule — add keys to all 10 catalogs, do NOT ship inline-default-only.** New user-facing copy must get real keys in `apps/mobile/i18n/en.json` AND every one of the 9 non-en files (English placeholder values are acceptable until translated; the untranslated-string check is warn-level and only hard-pins two `learnerSettings.language*` keys). Keep inline `t("ns.key", "English default")` as a safety fallback, but the catalog key is authoritative.

**Why:** the project constitution mandates 10 locales + RTL. `apps/mobile/__tests__/i18n-coverage.test.ts` enforces *exact* flattened-key parity (every `en.json` key in all 9 locales, zero orphans) — but it only compares catalog key *sets*. Using a key that exists in NO catalog (inline default only) silently bypasses the parity gate and renders English in every locale. `reports.tsx` does exactly this (`parentReports.*` is absent from catalogs) — that is a known gap, NOT the pattern to copy. Architect review flagged the same inline-only shortcut on the resources screen as a substantive miss.

**How to apply:** a small Node script can inject a nested namespace object into all 10 `i18n/*.json` at once (read → `obj.<ns> = {...}` → `JSON.stringify(obj,null,2)` preserving trailing newline) — that yields additions-only diffs since the files are already 2-space pretty-printed.

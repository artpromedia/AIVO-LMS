---
name: Inclusive-Warm design-system conversion
description: The cross-app migration onto the Inclusive-Warm (iw-*) design system — where the plan lives and the non-obvious token-contract gotchas.
---

# Inclusive-Warm conversion

The "new design system" rolled out across all apps is **Inclusive-Warm** (`iw-*` Tailwind tokens via
`@aivo/brand`; RN uses the `@aivo/brand` JS exports). The full audit + phased remediation plan lives at
**`docs/design-language/inclusive-warm-conversion-plan.md`** (token cheat-sheet, per-app current state,
Phase 0 token foundation → Phase 1 shared packages → Phase 2 apps, dependency graph, open decisions).

## Token-contract gotchas (not obvious from a quick grep)
- **Canonical universal status token is `iw-error`, NOT `iw-danger`.** Don't write `iw-danger` unless
  you first add a `danger`→`error` alias.
- **Soft/`-subtle` universal-status utilities are NOT wired through the preset**, even though the hexes
  (`successSoft`/`warningSoft`/`dangerSoft`/`infoSoft`) exist in `packages/brand/src/inclusive-warm.ts`.
  Exposing them is the single cross-app blocker for migrating `bg-emerald-50`/`bg-amber-50`/`bg-rose-50`
  status chips. **Why:** every status-color sweep needs a real target token first.
- **Rich domain status tokens already exist** — `iw-consent-*`, `iw-billing-*`, `iw-risk-*` (each with
  `-subtle`/`-default`). Map consent/billing/risk chips to these; do **not** flatten them into generic
  success/warning/error.
- **Edit the token SOURCE, never the compiled artifact.** Change `packages/brand/tokens/*.json` /
  `src/inclusive-warm.ts` then `pnpm --filter @aivo/brand build` to regenerate; never hand-edit
  `packages/brand/dist/tailwind/preset.cjs`.

## Conversion-order facts
- Already converted: `packages/mobile-ui`, `packages/nav` (logic-only). Do shared packages
  (`ui` S, `stage-ui` S, `learner-ui` M, `admin-ui` M) before the apps that consume them.
- `data-sensory-mode` (standard/calm/high-contrast) + `data-brand="inclusive-warm"` are the live root
  attrs in code, but `docs/design-language/migration.md` still says `data-theme`/`data-age-mode` — pick
  one canonical contract before sweeping (see plan §7).

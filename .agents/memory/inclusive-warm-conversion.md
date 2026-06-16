---
name: Inclusive-Warm design-system conversion
description: The cross-app migration onto the Inclusive-Warm (iw-*) design system — where the plan lives and the non-obvious token-contract gotchas.
---

# Inclusive-Warm conversion

The "new design system" rolled out across all apps is **Inclusive-Warm** (`iw-*` Tailwind tokens via
`@aivo/brand`; React Native uses the `@aivo/brand` JS exports, NOT Tailwind classes). The full audit +
phased remediation plan lives at **`docs/design-language/inclusive-warm-conversion-plan.md`** (token
cheat-sheet, per-app current state, Phase 0 token foundation → Phase 1 shared packages → Phase 2 apps).
The authoritative class-by-class mapping used to drive sweeps is **`.local/iw-conversion-rules.md`**.

## Token-contract gotchas (not obvious from a quick grep)
- **Canonical universal status token is `iw-error`, NOT `iw-danger`.** `iw-danger` has NO alias in the
  preset and silently fails to render — if you see it, replace `iw-danger`→`iw-error`.
- **`iw-info` is the brand PURPLE (`#7c3aed`) by design** — base/subtle/strong = `#7c3aed`/`#ede9fe`/`#6d28d9`.
  So "info" is purple, not blue. **Map calm/break/secondary surfaces that were sky/blue/cyan to the TEAL
  accent (`bg-iw-accent-soft` + `text-iw-teal-800/700` + `border-iw-accent`), never to `iw-info`** —
  otherwise they turn purple and collide with the primary. Reserve `iw-info-*` for true info status only.
- **`bg-white`/`text-white` are accepted in IW and used widely in the reference app (web-v2).** Do NOT
  mass-convert them to `bg-iw-card`; only use `bg-iw-card` for brand-new adaptive surfaces.
- Universal status `-subtle`/`-strong` utilities ARE wired through the preset now (success/warning/error/info).
  `-subtle` = pastel chip bg, `-strong` = AA-accessible chip text.
- **Rich domain status tokens exist** — `iw-consent-*`, `iw-billing-*`, `iw-risk-*`, `iw-mastery-*`,
  `iw-safety-*`, `iw-completion-*` (each `-subtle`/default/`-strong`). Map consent/billing/risk/etc. chips to
  these; do NOT flatten into generic success/warning/error.
- Brand gradients are preset `backgroundImage` utilities: `bg-iw-brand` (fixed identity), `bg-iw-sensory-brand`
  (mode-aware in-product), `bg-iw-hero` (page wash). For arbitrary legacy gradients keep the gradient with
  iw-palette stops (`iw-purple-*`, `iw-teal-*` have full scales) or flatten where no scale exists.

## Intentional exceptions (deliberate — do NOT "fix" in a sweep)
- **marketing inline dark footers** (`bg-slate-900` + `text-slate-400 hover:text-white`): kept raw — there is no iw dark-surface + muted-light-text token pair to map them onto.
- **Decorative identity gradients** keep their multi-hue stops: `FunctioningLevels` level `bg` and tutor `data.ts` `bg` are level/tutor identity artwork, not surface chrome.
- **marketing `--visual-*` auth pages** (signup/reset/forgot) + their gradient pill submit buttons: own visual-primary system, left per guardrail.
- **mobile fixed colors** kept: `#4285F4` Google blue, password-strength ramp, `#1A1A2E` immersive bg, mascot/splash art, AAC switch-scan white, test fixtures.
- **F3 (eslint legacy-class ban) deferred (architect-endorsed):** a blanket ban would fail lint on the skips above. If ever added, scope it with explicit allowlists / file-level disables — never blanket-ban.

## Editing the token source (never the artifact)
- Change `packages/brand/tokens/core/color.json` AND the `iw` preset map in
  `packages/brand/scripts/build-tokens.mjs`, then `pnpm --filter @aivo/brand build` to regenerate dist.
  Never hand-edit `packages/brand/dist/**`.
- **The emitted `preset.cjs` aligns key→value with VARIABLE whitespace.** Any test that asserts preset
  substrings must normalize whitespace first (collapse `\s+`→` `), or single-space `toContain` checks fail.
- `iw-purple` and `iw-teal` expose full numeric scales (50–950); `iw-info`/status families are
  base + `-subtle` + `-strong` only (no numeric scale).

## Conversion-order facts
- Do shared packages before the apps that consume them. `packages/{ui, stage-ui, learner-ui}` are converted
  (Phase 1 done); `stage-ui/src/native/*` are RN and were intentionally left for the mobile pass.
- Root attrs are `data-sensory-mode` (standard/calm/high-contrast) + `data-brand="inclusive-warm"`.
- `apps/web-admin` is a deliberately SEPARATE register (loads only `admin-tokens.css`, not `tokens.css`, so
  `iw-*` won't resolve there) — converting it reverses that decision; confirm with the user first.

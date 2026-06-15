---
name: web-admin console tokens & palette
description: How apps/web-admin gets its colors — it does NOT load brand tokens.css; admin chart palette is a dedicated brand emission.
---

# web-admin color/token wiring

**apps/web-admin does NOT import `@aivo/brand/tokens.css`.** Its `globals.css` only pulls
in Tailwind + a dedicated `@aivo/brand/admin-tokens.css`. Consequence: the brand Tailwind
preset's `iw-*` / `brand-*` utilities (which map to `--aivo-*` CSS vars) **silently do not
resolve in web-admin** because those vars are never injected. Admin UI uses its own
`admin-*` classes (`admin-h1`, `admin-button`, `admin-tabular`) defined in admin globals,
plain Tailwind palette utilities (`text-slate-*`), and the `--admin-chart-*` vars.

**Admin chart palette = single source in `@aivo/brand`.** Edit the brand `admin.json`
semantic token file only; the brand build emits both a TS palette (`ADMIN_CHART_PALETTE`)
and an `admin-tokens.css` of `--admin-chart-*` / `--admin-login-sidebar` vars. admin-ui's
chart tones consume the TS palette (no hardcoded hex). Reference ramp: violet `#7C3AED`,
teal `#0D9488`, orange `#EA580C`, pink `#DB2777`, slate `#64748B`. After changing the JSON,
rebuild brand then admin-ui. **Why:** one token source keeps charts on-brand and AA-contrast
(a brand test locks each series ≥3:1 on white).

**⌘K command palette scope = tenants/users/learners only.** The admin shell's global search
hits a permission-gated web-admin route that fans to admin-svc `/search`, which currently
covers tenants/users/learners. **Pilots are deliberately deferred** to the later
search-endpoint pass — don't add a pilots section to the palette (or "pilots" to its
placeholder copy) until admin-svc `/search` actually returns them, or it fabricates an empty
promise. Learners have no detail route, so they deep-link to the learners list with a search
query.

**Why:** the admin console is intentionally a separate visual register from the
Inclusive-Warm consumer apps; pulling in the full brand var set risks repainting admin
surfaces unpredictably. Keep admin palette additions in `admin.json` / `admin-tokens.css`,
not the global `tokens.css`.

**ESLint hex ban scope:** the `no-restricted-syntax` hex rule in `eslint.config.mjs` covers
only `apps/web-v2/**` + `apps/marketing/**`. `apps/web-admin` legacy files are NOT hex-banned
(frozen by the CI ratchet baseline). Don't flip the global ban onto web-admin in a refine
pass — many legacy admin files still use raw hex / Tailwind palette colors.

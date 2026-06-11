# White-label theming (Sprint B6)

_A district sees its own logo, accent palette, and support link across
AIVO's post-login surfaces — with WCAG contrast enforced so white-labeling
can never degrade accessibility._

## Scope (MVP)

The override surface is deliberately tiny:

| Surface                          | Overridable                                  |
| -------------------------------- | -------------------------------------------- |
| Header logo (web-v2 app shell)   | ✅ validated PNG/SVG data URL                |
| Web-admin district/school shells | ✅ logo above the console wordmark           |
| Primary accent (buttons, focus)  | ✅ `--aivo-color-interactive-primary-*` vars |
| Secondary accent                 | ✅ `--aivo-brand-secondary` / accent var     |
| Support link (shell help menu)   | ✅ `supportUrl` (or `mailto:` supportEmail)  |
| Mobile parent home header        | ✅ logo only (see below)                     |
| Everything else                  | ❌                                           |

Storage is `district_settings.branding` (jsonb) — managed by platform
admins per tenant (`/platform/tenants/[id]/branding`) and self-serve for
districts with the `districtEnterpriseMode` flag (`/district/branding`,
Sprint B2 resolver). All writes flow through identity-svc, which owns
validation and audits every change to the tenant's hash-chained activity
log.

## Contrast is enforced, not suggested

`@aivo/brand`'s `evaluateBrandPalette` checks every candidate primary /
secondary against the REAL brand tokens:

1. color as text on the light surfaces (card `#FFFFFF`, page `#FAF7F4`)
   — WCAG AA **≥ 4.5:1**
2. white text on the color (primary buttons) — WCAG AA **≥ 4.5:1**
3. color as a UI accent on the dark chrome (`#1A1614`) — WCAG 1.4.11
   non-text **≥ 3:1**

The identity-svc write route rejects failing palettes with the specific
per-check messages ("primary on dark chrome fails: 2.68:1 (needs 3:1)"),
and the admin UI shows the same verdicts live before save. The shipped
AIVO violet passes all checks — the guard can never reject the default.

## Learner sensory palettes are NOT overridable

Learner surfaces (web `data-role-theme="learner"` and every mobile
screen) keep their playful/calm sensory palettes unchanged, regardless
of tenant branding. These palettes are clinically tuned for neurodiverse
learners — predictable color, contrast, and stimulus levels are part of
the product's accessibility contract, not decoration. A district accent
that is fine in an admin header could be a sensory regression in a
learner session. The app shell therefore skips branding entirely for the
learner theme, and on mobile — where parent and teacher screens also
render through the sensory palette system — the override surface is the
logo only.

## Pre-auth surfaces stay AIVO-branded

Login, marketing, and onboarding render before any tenant is known, so
they always show AIVO branding. Branding applies from the first
post-login paint (the public, presentation-safe
`GET /api/branding/public/:tenantId` endpoint, cached 5 minutes).

## Custom domains are out of scope

This sprint ships logo/palette/support-link white-labeling only. Custom
domains (district.aivolearning.com or CNAMEs) involve TLS issuance,
cookie scoping, SSO redirect-URI changes, and email deliverability work
— explicitly excluded here and tracked as future enterprise work.

## Wiring map

- `services/identity-svc` — storage, validation (`validateBrandingPatch`
  → `evaluateBrandPalette`), validated logo upload, public read,
  activity-log audits.
- `apps/web-v2/lib/branding.ts` — session-tenant fetch (60s memo) +
  `brandingCssVars`; injected by `components/layout/app-shell.tsx`
  (non-learner roles), incl. the sidebar support link; `GET
  /api/bff/branding` for client surfaces.
- `apps/web-admin/lib/tenant-branding.ts` — district/school shells show
  the tenant logo; `components/branding-form.tsx` is the shared editor
  with live contrast verdicts.
- `apps/mobile/hooks/useBranding.ts` — post-login logo on the parent
  home header.
- Guard: `scripts/brand-asset-check.mjs` pins this wiring; two-tenant
  isolation is proven by `e2e/specs/admin/branding.spec.ts`.

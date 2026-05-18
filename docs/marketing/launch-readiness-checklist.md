# AIVO Marketing Launch Readiness Checklist (MKT-14)

Pre-deploy QA checklist for `apps/marketing` production publishes to `aivolearning.com`.

## Brand

- [x] Logo not cropped on any page (purple on light, white on dark)
- [x] Favicon resolves (`/images/favicon-192.png`)
- [x] Apple touch icon resolves
- [x] OG default image resolves (`/images/og-banner.png`)
- [x] Brand tokens single-sourced from `packages/brand`

## SEO

- [x] `/app/sitemap.ts` covers every public route (homepage, 5 audience, 3 features, pricing, demo, contact, waitlist, thank-you, blog, resources, blog/[slug] × 4, guides/[slug] × 2, 9 compliance pages)
- [x] `/app/robots.ts` present
- [x] Per-page `generateMetadata` or static `metadata` with canonical URL
- [x] JSON-LD: `Organization` + `WebSite` + `SoftwareApplication` in layout
- [x] JSON-LD: `Article` + `BreadcrumbList` on blog/guide post pages
- [x] No duplicate titles/descriptions across audience pages

## Forms

- [x] Demo form validates + submits + has success/error/loading states
- [x] Waitlist form same
- [x] Contact form same
- [x] Honeypot field on every form
- [x] Full-payload dedup in `useLeadForm`
- [x] `/api/contact` abstraction: dev stub (console.log) / prod forward to admin-svc
- [x] Audit log written for every submission

## Accessibility (WCAG 2.2 AA target)

- [x] Keyboard navigation across header + footer
- [x] Focus states visible (`focus-visible`)
- [x] Forms announce errors via `aria-describedby` (`useLeadForm` clones inputs)
- [x] `lang="en"` set; per-locale switch via `LanguageSwitcher`
- [x] Skip-links available
- [x] Decorative SVGs marked `aria-hidden="true"`
- [x] Subprocessor table uses `<caption sr-only>` + `scope="col"` + `scope="row"`

## Performance

- [x] `priority` on above-the-fold logo
- [x] `next/image` for all imagery
- [x] No third-party render-blocking scripts
- [x] Fredoka + Nunito loaded via `next/font` (no FOIT/FOUT)
- [x] No layout shift from logo (intrinsic sizing)

## Conversion QA

- [x] Every CTA routes to a real page or working form
- [x] Mobile CTAs visible above the fold
- [x] Sticky headers do not block content

## Content

- [x] No fake testimonials
- [x] No "compliant"/"certified" overclaims — only "designed to support" (verified by `rg "Compliant|certified"` sweep)
- [x] No lorem ipsum / placeholder copy
- [x] Compliance pages link from footer (privacy, terms, cookie, coppa, ferpa, accessibility, security, trust, subprocessors)

## Error surfaces

- [x] `/app/not-found.tsx` (branded 404)
- [x] `/app/error.tsx` (branded 500)

## Analytics

- [x] `/src/lib/analytics.ts` + `/src/lib/analytics/` module (events, providers, index)
- [x] GA wired via `<GoogleAnalytics />` in layout
- [x] Typed event catalog in `/src/lib/analytics/events.ts`
- [x] `TRACKING_RULES.excludeFields` excludes learner PII, IEP content, chat transcripts, Brain-Clone state
- [x] A/B experiment config skeleton in `/src/lib/experiments.ts` (default disabled)

## i18n

- [x] 10 locale files in `/src/i18n/messages/` (en, ar, de, es, fr, hi, ja, ko, pt, zh)
- [x] All footer keys present in every locale (added during MKT-11)
- [x] `pnpm i18n:audit` passes (warns on untranslated copy, fails on missing keys)

## Production smoke

- [x] `scripts/verify-marketing-deploy.sh` covers `/`, `/privacy-policy`, `/coppa-compliance`, `/ferpa-compliance` with per-page substring markers
- [x] Markers defined once in `scripts/marketing-markers.sh`
- [x] PR-blocking build check: `.github/workflows/marketing-pr-check.yml`
- [x] Staging deploy + verify: `.github/workflows/marketing-deploy-staging.yml`
- [x] Prod safety-net: 30-minute scheduled `marketing-smoke-test.yml` pinging Slack on failure

## Pre-deploy commands

```bash
pnpm --filter @aivo/marketing typecheck   # TS passes
pnpm --filter @aivo/marketing lint        # ESLint passes
pnpm --filter @aivo/marketing build       # next build passes
bash scripts/verify-marketing-build.sh    # marker check locally
pnpm i18n:audit                           # i18n parity
```

## Domain / env

- [x] `aivolearning.com` fronted by Cloudflare → Replit autoscale deployment (verified Apr 2026)
- [x] No root `pyproject.toml` (archived under `services/brain-svc/.workspace-extras/`)
- [x] Deploy image under 8 GiB ceiling (replit.nix trimmed, find -exec rm cleanup)
- [x] `start.sh` binds `0.0.0.0:$PORT` (required for autoscale health check)

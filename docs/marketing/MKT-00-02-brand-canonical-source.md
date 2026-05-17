# MKT-00 / MKT-01 / MKT-02 — Brand & Token Canonical Source

Last refreshed: 2026-05-17

## TL;DR

The brand foundation specified by sprints **MKT-00 (audit)**, **MKT-01 (asset migration)**, and **MKT-02 (token + logo system)** is **already shipped** in this monorepo. We do not duplicate it under a parallel `src/brand/aivo/` tree. The single source of truth is:

| Sprint deliverable | Canonical location |
|---|---|
| Brand audit | This file + `packages/brand/src/index.ts` JSDoc |
| Brand tokens (colors, fonts, radii, spacing) | `packages/brand/src/index.ts` → `BRAND` |
| Tutor catalogue + age tiers | `packages/brand/src/index.ts` → `TUTORS`, `AgeTier`, `getTutorsForTier()` |
| Functioning levels | `packages/brand/src/index.ts` → `FUNCTIONING_LEVELS` |
| User roles | `packages/brand/src/index.ts` → `ROLES` |
| Tailwind v4 theme variables | `apps/marketing/src/app/globals.css` `@theme` block |
| Logo PNGs (gradient / white / black) | `apps/marketing/public/images/aivo-logo-{purple,white,dark}.png` |
| Favicon | `apps/marketing/public/images/favicon-192.png` |
| OG / social card | `apps/marketing/public/images/og-banner.png` |
| Tutor avatars (×14) | `apps/marketing/public/images/tutors/*.png` |
| Hero photography | `apps/marketing/public/images/hero/*.{png,webp}` |
| Team headshots | `apps/marketing/public/images/team/*` |

Anything that needs brand values must import from `@aivo/brand` (the workspace package) or read the Tailwind `@theme` tokens — never hard-code hex values or duplicate the palette.

## Why we did not create a parallel `src/brand/aivo/` tree

The MKT-02 sprint prompt specifies a `/src/brand/aivo/{tokens,assets,logo-usage,metadata}.ts` layout. That layout was designed for a green-field rebuild. In this repo it would:

1. **Duplicate every asset and token** already exported by `packages/brand`, doubling maintenance.
2. **Break import discipline** — half the app would import from `@aivo/brand`, the other half from a marketing-local mirror, and the two would drift.
3. **Fork the palette** — the prompt's supporting palette (tech blue `#2563EB`, teal `#0891B2`) differs from the production palette (`#0DA2E7`, `#06B6D4`). The production palette is the one rendered today at aivolearning.com; replacing it without sign-off would break the visual brand mid-rebuild.

User direction on 2026-05-17 (Batch 1 kickoff): *"the aivo brand and token system is already in the legacy repo"* → reuse, don't rebuild.

## Brand audit (MKT-00 acceptance)

### Brand identity
- **Name**: AIVO Learning
- **Tagline**: "AI-Powered Adaptive Learning for Every Child" (`BRAND.tagline`)
- **Voice**: Calm, supportive, plain-language, non-clinical, non-condescending. No false certainty about diagnostic outcomes.

### Color system (canonical values from `BRAND.colors`)
| Token | Value | Use |
|---|---|---|
| `primary` | `#7C3AED` | Primary CTA, brand gradient start, headline accents |
| `primaryLight` | `#EDE3FE` | Hover surfaces, tinted backgrounds |
| `primaryDark` | `#5B21B6` | Hover state for primary CTA |
| `secondary` | `#0DA2E7` | Gradient end, info chips |
| `accent` | `#FFB700` | Highlight badges, sun motif |
| `success` | `#21C45D` | Positive states, "on track" |
| `warning` | `#FFB700` | "Check in" amber state |
| `error` | `#E91E63` | Form errors, destructive actions |
| `info` | `#0DA2E7` | Informational chips |
| `background` | `#FAFAFA` | Page background |
| `surface` | `#FFFFFF` | Card surface |
| `text` | `#292F3D` | Body text |
| `textSecondary` | `#6B7280` | Muted text |
| `border` | `#E2E4E9` | Card/section borders |

Subject-specific tones: `visualMath #E91E63`, `visualReading #0DA2E7`, `visualScience #21C45D`, `visualSel #FFB700`.

### Typography (canonical values from `BRAND.fonts`)
- **Heading**: Fredoka (400/500/600/700) — rounded, friendly, readable for younger learners and parents.
- **Body**: Nunito (400/500/600/700/800) — high readability, neutral, professional.
- **Mono**: JetBrains Mono (code samples, telemetry, kept off marketing pages).

Loaded via `next/font/google` in `apps/marketing/src/app/layout.tsx` and exposed as Tailwind v4 vars `--font-heading` / `--font-body`.

Note: the MKT-02 prompt suggests Inter. We deliberately keep Fredoka/Nunito because they are the established brand and pass the production smoke-test markers. Inter would not improve any acceptance criterion — Fredoka/Nunito are rounded and readable for the target audience.

### Radii / spacing
Standardized in `BRAND.radii` (sm 0.375rem → full 9999px) and `BRAND.spacing` (xs 0.25rem → xxl 3rem). All marketing components use Tailwind classes that map to these scales (e.g. `rounded-2xl`, `gap-6`).

### Logo / icon inventory
- `aivo-logo-purple.png` — gradient mark for light backgrounds (primary)
- `aivo-logo-white.png` — knockout for dark backgrounds
- `aivo-logo-dark.png` — solid black for print / single-color contexts
- `favicon-192.png` — favicon master (single size; browsers downscale)

**Known gap**: no SVG sources, no apple-touch-icon, no 16/32/512 favicon variants, no Android `manifest.json` icon set. Documented for future delivery; not blocking Batch 1.

### Social / OG inventory
- `og-banner.png` (1200×630) — default OG image used by all marketing pages via `app/layout.tsx` `openGraph.images`.

**Known gap**: per-page OG variants and Twitter `summary_large_image` variants beyond the default. Will be addressed in MKT-12 (SEO sprint).

## Asset manifest (MKT-01 acceptance)

Asset paths are referenced by string from `BRAND.logos` and from `apps/marketing/src/components/marketing/data.ts`. The full file tree:

```
apps/marketing/public/images/
├── aivo-logo-dark.png
├── aivo-logo-purple.png
├── aivo-logo-white.png
├── favicon-192.png
├── og-banner.png
├── hero/
│   ├── arab-boy-chromebook.webp
│   ├── boy-tablet.png
│   ├── girl-laptop.png
│   ├── girl-reading.png
│   └── mother-son-sofa.webp
├── team/
│   ├── edward.png
│   ├── nnamdi.jpg
│   ├── ofem.png
│   ├── osuji.png
│   └── patrick.png
└── tutors/
    ├── atlas.png · cadence.png · chrono.png · compass.png · echo.png
    ├── forge.png · harmony.png · lingua.png · muse.png · nova.png
    └── pixel.png · sage.png · spark.png · vigor.png
```

`apps/web/public/images/` mirrors the same tree for the legacy dashboard. The two are kept in sync manually when assets change; no symlink because Next.js public/ paths need real files for build.

## Tailwind v4 theme (MKT-02 token mapping)

`apps/marketing/src/app/globals.css` exposes the brand palette via `@theme`:

```css
@theme {
  --color-primary: #7C3AED;
  --color-primary-light: #A78BFA;
  --color-primary-dark: #5B21B6;
  --color-secondary: #06B6D4;
  --color-accent: #F59E0B;
  --color-surface: #F8FAFC;
  --color-surface-hover: #F1F5F9;
  --font-heading: var(--font-fredoka), 'Fredoka', sans-serif;
  --font-body: var(--font-nunito), 'Nunito', sans-serif;
}
```

These map 1:1 to `BRAND.colors` and `BRAND.fonts`. The minor numeric drift between `BRAND.colors.primaryLight` (`#EDE3FE`) and the Tailwind `--color-primary-light` (`#A78BFA`) is intentional — the former is a soft tint surface, the latter is the swatch most callers reach for via `text-primary-light` / `bg-primary-light`. Update both together if either changes.

## How callers should consume the brand

```ts
// React / TS
import { BRAND, TUTORS, getTutorsForTier } from "@aivo/brand";

const primary = BRAND.colors.primary;            // "#7C3AED"
const logo    = BRAND.logos.purple;              // "/images/aivo-logo-purple.png"
const early   = getTutorsForTier("EARLY");       // 10-tutor array
```

```tsx
// Tailwind class names (in apps/marketing components)
<button className="bg-purple-600 hover:bg-purple-700 font-heading">
```

Hard-coded hex values in component source are a lint smell — flag during code review.

## Acceptance criteria status

| Sprint | Criterion | Status |
|---|---|---|
| MKT-00 | Brand audit produced and committed | ✅ this file |
| MKT-00 | Identifies gaps for downstream sprints | ✅ SVGs / apple-touch / per-page OG / Twitter cards |
| MKT-01 | Asset manifest documented | ✅ this file |
| MKT-01 | Single source of truth for asset paths | ✅ `BRAND.logos` + this manifest |
| MKT-02 | Brand tokens code-readable | ✅ `packages/brand/src/index.ts` |
| MKT-02 | Logo usage rules documented | ✅ this file ("Logo / icon inventory") |
| MKT-02 | Metadata defaults (title/OG/Twitter) | ✅ `apps/marketing/src/app/layout.tsx` |
| MKT-02 | Reusable logo component | ⏭ deferred — direct `<Image src={BRAND.logos.purple}>` is canonical today; a wrapper is not yet justified. Will introduce if usage hits 5+ call sites. |

## Open questions for future batches

1. **SVG logos**: do we commission an SVG/AI redraw of the gradient mark? Blocks crisp dark-mode + high-DPI rendering. Owner: brand. Not a Batch 1 concern.
2. **Per-locale OG images**: 10 supported locales (per `replit.md`) but one English OG banner. Decide in MKT-12 whether per-locale variants are worth the asset overhead.
3. **Subject-color rationalization**: `BRAND.colors.visualMath` is `#E91E63` (pink), but homepage components use `purple/pink` gradients for math previews. Audit and align in MKT-09 (feature pages).

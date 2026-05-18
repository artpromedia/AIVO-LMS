# AIVO Brand Asset Manifest (MKT-00 / MKT-01 / MKT-02)

Single source of truth for AIVO marketing brand assets in this monorepo.

## Source of truth

- **Brand tokens (TS):** `packages/brand/src/index.ts` — exports `BRAND` (colors, fonts, radii, spacing, logos), `TUTORS`, `FUNCTIONING_LEVELS`, `ROLES`.
- **Brand consumers:** `apps/marketing` (Next.js site), `apps/web-v2` (dashboards), `apps/mobile` (Expo).
- All marketing logo references go through `/public/images/` paths on disk; the same file names are exposed by `BRAND.logos`.

## Logo inventory (apps/marketing/public/images/)

| File                   | Use                                     |
| ---------------------- | --------------------------------------- |
| `aivo-logo-purple.png` | Light-background nav, legal pages, hero |
| `aivo-logo-white.png`  | Dark-background footer, hero overlays   |
| `aivo-logo-dark.png`   | Light-on-light contexts                 |
| `favicon-192.png`      | Favicon + apple-touch-icon              |
| `og-banner.png`        | Default Open Graph share image          |

## Colors

Primary palette (from `BRAND.colors`):

- `primary` `#7C3AED` — purple
- `primaryLight` `#EDE3FE`
- `primaryDark` `#5B21B6`
- `secondary` `#0DA2E7` — tech blue
- `accent` `#FFB700`
- `success` `#21C45D`
- `error` `#E91E63`
- `text` `#292F3D`
- `surface` `#FFFFFF`

## Typography

- Heading: Fredoka (loaded via `next/font` in `apps/marketing/src/app/layout.tsx`)
- Body: Nunito
- Mono: JetBrains Mono

## Metadata wiring

- `apps/marketing/src/app/layout.tsx`:
  - Title template, description, keywords (compliance-scrubbed per MKT-11)
  - Open Graph + Twitter card defaults pointing at `/images/aivo-logo-purple.png`
  - JSON-LD: `Organization`, `WebSite`, `SoftwareApplication`
- Favicon configured via `metadata.icons.icon = "/images/favicon-192.png"`

## Logo usage rules (do)

- Always use the unmodified brain icon and `AIVO LEARNING` wordmark
- Preserve transparent backgrounds
- Render at native aspect ratio (no fixed width/height without intrinsic sizing)
- Use `aivo-logo-purple.png` on light surfaces, `aivo-logo-white.png` on dark surfaces

## Logo usage rules (don't)

- Never crop the logo
- Never recolor the gradient or icon stroke
- Never substitute "Agentic AI" for the wordmark
- Never rasterize the source SVG unnecessarily

## Acceptance status

- [x] Brand tokens centralized in `packages/brand`
- [x] Logo, favicon, OG image present in `apps/marketing/public/images/`
- [x] Marketing layout consumes brand assets via stable paths
- [x] No hardcoded off-brand colors in marketing pages (Tailwind config + brand tokens drive style)

# Lighthouse Accessibility Audit — Inclusive Lab — Warm home page

Tool: Lighthouse 12.8.2 (Chromium 138.0.7204.100, headless, accessibility category only)

## Results

| URL                                                        | When                 | Score   | Report                 |
| ---------------------------------------------------------- | -------------------- | ------- | ---------------------- |
| https://aivolearning.com/                                  | 2026-05-18T21:00:01Z | **89**  | `home-a11y-prod.html`  |
| https://aivolearning.com/ferpa-compliance                  | 2026-05-18T21:00:49Z | **96**  | `ferpa-a11y-prod.html` |
| http://127.0.0.1:4173/ (local `next start` of this branch) | 2026-05-18T20:56:31Z | **100** | `home-a11y.html`       |
| http://127.0.0.1:4173/ferpa-compliance (this branch)       | 2026-05-18T20:56:52Z | **100** | `ferpa-a11y.html`      |

## What this shows

- **Production today** is at **89 / 96** — home page is below the ≥ 95 bar
  required by the parent task's Done criteria.
- **This branch** clears the bar at **100 / 100** for both pages. Once it
  ships through the normal `Marketing Deploy Production` workflow,
  https://aivolearning.com/ will hit ≥ 95 too. The agent cannot trigger
  that deployment from here.

## Failing audits on production / home (before the fixes on this branch)

| Audit                       | Elements | Root cause                                                                                                  |
| --------------------------- | -------: | ----------------------------------------------------------------------------------------------------------- |
| color-contrast              |       25 | `text-slate-400` (#90a1b9) on white = 2.63:1, and `text-white/80` on `#7c3aed` = 3.64:1 in the CTA card     |
| target-size                 |       17 | Carousel indicator dots (8 × 8 px) and tutor selector dots (12–16 px) — below WCAG 2.5.5's 24 × 24 px floor |
| aria-prohibited-attr        |        4 | `<div aria-label="…">` 5-star rating with no role                                                           |
| label-content-name-mismatch |        3 | TutorCarousel side buttons (after fixes the i18n label includes the visible text)                           |
| heading-order               |        1 | Footer column titles were `<h4>` with no preceding `<h3>`                                                   |

## Fixes applied on this branch

Re-running the same audit against the locally-built site clears every audit
above. Each fix is committed in this branch:

- **Contrast:** `text-slate-400` → `text-slate-500` in `Hero.tsx`,
  `Testimonials.tsx`, `TrustStrip.tsx`, `FunctioningLevels.tsx`,
  `BrainClone.tsx`. CTA card `text-white/80` → `text-white` in
  `app/page.tsx`.
- **Touch target:** slide dots in `Hero.tsx` and tutor selector dots in
  `TutorCarousel.tsx` wrapped in 24 × 24 px button hit areas while the
  visual dot stays small.
- **ARIA role:** added `role="img"` to the star-rating `<div>`s in
  `Testimonials.tsx` and `app/page.tsx`.
- **Heading order:** footer column titles `<h4>` → `<h3>` in `Footer.tsx`.

## Reproducing

```bash
# 1. Install Chromium once (already done in this env via the Nix layer)
# 2. Build + start the marketing site locally
pnpm --filter @aivo/brand run build
pnpm --filter @aivo/marketing run build
cp -r apps/marketing/.next/static apps/marketing/.next/standalone/apps/marketing/.next/
cp -r apps/marketing/public apps/marketing/.next/standalone/apps/marketing/
PORT=4173 HOSTNAME=0.0.0.0 node apps/marketing/.next/standalone/apps/marketing/server.js &
# 3. Run Lighthouse
CHROME_PATH=$(which chromium) npx lighthouse http://127.0.0.1:4173/ \
  --only-categories=accessibility \
  --chrome-flags="--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu" \
  --output=html --output-path=artifacts/lighthouse/home-a11y.html
```

## Re-verify after deploy

Once this branch reaches production, re-run the Lighthouse commands above
against `https://aivolearning.com/` and `https://aivolearning.com/ferpa-compliance`
and overwrite `*-prod.html`. The expected scores are both ≥ 95.

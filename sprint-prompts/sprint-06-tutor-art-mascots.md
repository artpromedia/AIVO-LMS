# Sprint 06 — Learner delight: tutors get faces, rewards get mascots

## Goal

At the end of this sprint, the 14 AI tutors appear in the **product** with their real portrait art (today that art ships only on the marketing site), the learner home's message cards use brand mascots instead of raw emoji, and the Rewards screen's empty sticker book shows mascot/illustration art instead of being text-only. Sensory safety is built in: calm/high-contrast modes and reduced-visual-load profiles get the `-reduced.svg` art variants that already exist. Closes audit gap **M4 (⚠️)** — "the marketing site literally shows richer tutor art than the product."

## Context

- **The art (exists, verified):** `apps/marketing/public/images/tutors/` holds **28 files** — `{slug}.png` + `{slug}-reduced.svg` for all 14 tutor slugs: `atlas, cadence, chrono, compass, echo, forge, harmony, lingua, muse, nova, pixel, sage, spark, vigor`. Mascots: `packages/brand/assets/mascots/` — `aivo-owl-*`, `pip-fox-*`, `echo-whale-*` SVGs, 6 expressions each. Illustrations/patterns: `packages/brand/assets/{illustrations,patterns}/`.
- **The registry:** `TUTORS` in `packages/brand/src/index.ts:92+` — per tutor: `name`, `domain`, `icon` (emoji), `color`, `tier`, `tiers`, `avatar: "/images/tutors/<slug>.png"`. The `avatar` paths are *already correct for web-v2* — the files just don't exist under `apps/web-v2/public/`.
- **Web render sites (verified):**
  - `packages/ui/src/learner-dashboard/TutorAvatar.tsx`, `TutorAvatarCard.tsx`, `FeaturedLessonCard.tsx` — current tutor visuals are tone-colored chips (`TutorAvatarTone`: lavender/sky/mint/sunshine; tone map in `apps/web-v2/app/learner/home/page.tsx:136-149`).
  - Learner home: featured tutor resolved via `tutorForSubjectSlug` (`page.tsx:228`); tutor grid beneath (`:236+`); `MessageCard` emoji avatars at `page.tsx:479-505` (`avatar="✨"`, `"🛡"`, `"🌿"`) — these are **message** avatars, not tutor tiles; `MessageCard` lives at `packages/ui/src/learner-home/MessageCard.tsx`.
  - Baseline intro names the tutor: `apps/web-v2/app/learner/baseline/intro/page.tsx` (~`:90-94`).
  - Rewards: `apps/web-v2/app/learner/rewards/page.tsx` — sticker book + quest world cards, currently text-only.
- **Mobile render site:** `packages/mobile-ui/src/TutorCard.tsx` (used by the learner home tutors carousel, `apps/mobile/app/(learner)/index.tsx`). React Native requires static `require()` for bundled images.
- **Sensory rules:** web sensory mode is on `<html data-sensory-mode>` (`standard|calm|high-contrast`); Sprint 03 adds `--stage-*` vars. Use the `-reduced.svg` variant under calm/high-contrast (flatter, lower-stimulation art). All art is decorative: `alt=""`/`aria-hidden` with the tutor's name as adjacent visible text — the a11y lint gates (web axe lane from Sprint 02; mobile `eslint-plugin-react-native-a11y`) must stay green.
- **Image conventions:** check `grep -rn "next/image" packages/ui/src` first — `packages/ui` components are consumed only by web-v2; follow whatever the package already does (plain `<img>` with explicit `width/height` + `loading="lazy"` is acceptable if `next/image` isn't already the package norm).

## Work orders

### DELETE
- None (emoji `icon` fields in `TUTORS` stay as fallbacks).

### CREATE
1. `packages/brand/assets/tutors/` — canonical copies of all 28 art files from `apps/marketing/public/images/tutors/` (byte-identical). Brand package is the source of truth going forward; marketing's copies stay untouched this sprint (dedup is a later cleanup — note it in the checkpoint, do not do it).
2. `apps/web-v2/public/images/tutors/` — the same 28 files, so the existing `TUTORS[*].avatar` paths resolve in the product.
3. `apps/mobile/assets/images/tutors/` — the 14 `{slug}.png` files (PNG only on mobile this sprint; SVG bundling via metro is riskier — the reduced treatment on mobile is handled in REFACTOR-3).
4. `apps/mobile/src/lib/tutor-art.ts` — `TUTOR_ART: Record<TutorSlug, ImageSourcePropType>` static `require()` map + `getTutorArt(slug)` with a typed fallback (tone chip) for unknown slugs.
5. `packages/ui/src/learner-home/__tests__/` or the package's existing test location — render tests for the updated `TutorAvatar` (asset mode, reduced mode, fallback mode).

### REFACTOR
1. `packages/ui/src/learner-dashboard/TutorAvatar.tsx` — accept `tutor?: TutorSlug` (alongside the existing tone props for backward compatibility). When a slug is provided: render the portrait (`TUTORS[slug].avatar`), and when the document is in `data-sensory-mode="calm"|"high-contrast"` (read via a prop `reduced?: boolean` supplied by callers from their existing sensory context — keep the package context-free), render `/images/tutors/<slug>-reduced.svg` instead. Image is decorative (`alt=""`); size variants follow the component's existing size props; tone ring remains as the loading/fallback state. Add `avatarReduced` to the `TUTORS` entries in `packages/brand/src/index.ts` (`"/images/tutors/<slug>-reduced.svg"`) rather than string-concatenating paths at call sites.
2. `packages/ui/src/learner-home/MessageCard.tsx` — widen `avatar` from emoji-string to `string | { src: string; reducedSrc?: string }` (or a small `MascotName` union resolving against brand mascot assets — pick whichever matches the package's existing asset-handling style). Mascot art must also have a static path under `apps/web-v2/public/images/mascots/` — copy the needed mascot SVGs from `packages/brand/assets/mascots/` (only the expressions you use).
3. `packages/mobile-ui/src/TutorCard.tsx` — accept an optional `art?: ImageSourcePropType`; when present render the portrait (rounded, decorative, `accessibilityElementsHidden`/`importantForAccessibility="no"` since the name is adjacent text); under sensory mode calm/high-contrast apply the reduced treatment (desaturate via overlay using the palette — no new hex) until SVG variants land on mobile.

### EDIT
1. `apps/web-v2/app/learner/home/page.tsx` — pass the tutor slug into the featured-lesson card and tutor grid (`FeaturedLessonCard`/`TutorAvatarCard` call sites around `:228-260`); replace the three `MessageCard` emoji avatars (`:484, :491, :502`) with mascots: AIVO/tutor sender → `aivo-owl` (happy/idle per context), break card → the calm-appropriate mascot or illustration; pass `reduced` from the page's sensory-mode context.
2. `apps/web-v2/app/learner/baseline/intro/page.tsx` — render the resolved tutor's portrait beside the existing name/emoji line (reduced variant rule applies).
3. `apps/web-v2/app/learner/rewards/page.tsx` — empty sticker book state gets mascot/illustration art (e.g., `aivo-owl` + an `illustrations/empty-state` asset) with encouraging existing-register copy (new i18n keys → all 10 catalogs); quest-world cards may take a subtle pattern asset background **only if** it passes contrast against existing text tokens (verify with the axe spec).
4. `apps/mobile/app/(learner)/index.tsx` — tutors carousel passes `getTutorArt(slug)` into `TutorCard`.
5. Visual snapshots: the design-language visual suite (`apps/web-v2/e2e/visual-a11y.playwright.ts` + its `-snapshots` dir) will diff on learner home/rewards — intentionally update the stored snapshots and say so in the checkpoint (the anti-blank guard must still pass).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. Web (`corepack pnpm --filter @aivo/web-v2 dev`, learner session): learner home shows tutor portraits in the grid + featured card; message cards show mascots (zero emoji avatars rendered); baseline intro shows the tutor's face; rewards empty state shows mascot art. Switch to calm/high-contrast → art swaps to the `-reduced` variants (verify via devtools `src`).
2. Mobile: tutors carousel renders portraits (Expo run or component test snapshot — state which).
3. Commands green: web-v2 `typecheck`/`lint`/`test`, `corepack pnpm --filter @aivo/web-v2 run test:a11y` (axe lane — new images must not introduce violations), `corepack pnpm --filter @aivo/web-v2 exec playwright test visual-a11y` with updated snapshots; mobile `test` + `lint`; `packages/ui` tests green.
4. No raw hex anywhere new (ESLint gate); all art decorative with adjacent text names.
5. `ls apps/web-v2/public/images/tutors | wc -l` → 28; brand package carries the canonical set.

## Tests

- New: `TutorAvatar` render tests (asset/reduced/fallback); mobile `tutor-art.test.ts` asserting the map covers exactly the `TUTORS` slugs (import both and diff keys — catches a future 15th tutor without art).
- Update: visual snapshots (intentional). Run full web-v2 + mobile suites; green stays green.

## Out of scope

- Learner home information architecture (Sprint 07 — do not move/remove sections here). Per-tutor lesson *theming* (Sprint 15). Sticker-economy mechanics or new reward art beyond the empty state. Marketing app changes. Generating new artwork — only existing assets move.

## Depends on

Nothing hard. Do before Sprint 07 (the new home hero reuses the portrait work).

## Checkpoint

Summarize: asset inventory moved (counts per destination), component API changes (`TutorAvatar`, `MessageCard`, `TutorCard`), before/after screenshots (standard + calm), snapshot updates, DoD outputs. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**

# Inclusive-Warm conversion plan

Audit + remediation plan for migrating all remaining UI across the monorepo onto the
**Inclusive-Warm** design system (`iw-*` Tailwind tokens / `@aivo/brand`). Generated from a
code-wide audit of `apps/web-v2`, `apps/marketing`, `apps/web-admin`, `apps/mobile`, and the
shared `packages/*` UI libraries. Visual target = the attached "AIVO Family" parent-dashboard
screens (white soft-shadow cards, purple/teal palette, left-rail nav with active purple pill,
cloud-mascot encouragement card, stepper, pill CTAs, pastel status chips).

---

## 1. What "converted" means (the rules)

Canonical references: `docs/design-language/{migration,tokens,components,principles}.md`,
`packages/brand/src/inclusive-warm.ts`, `packages/brand/dist/tailwind/preset.cjs`.

**Web (Tailwind):**
- **Color** — `bg-iw-primary`, `bg-iw-primary-hover`, `text-iw-primary-fg`, `bg-iw-accent`,
  `bg-iw-accent-soft`, `bg-iw-warm-soft`, `text-iw-ink`, `text-iw-ink-muted`; brand-scale
  `bg-brand-{primary,canvas,surface}` / `text-brand-ink`; universal status `text-iw-{success,warning,error,info}`
  (canonical name is `iw-error`, **not** `iw-danger`); domain status `iw-{consent,billing,risk}-*`.
- **Radius** — `rounded-iw-card` (cards), `rounded-iw-card-lg` (large/hero cards),
  `rounded-iw-control` (buttons/inputs, pill), `rounded-iw-chip` (chips/badges).
- **Type** — families `font-iw-display` / `font-iw-body` / `font-iw-dyslexia`; sizes
  `text-iw-hero`, `text-iw-display`, `text-iw-body`, `text-iw-caption`, `text-iw-label`,
  `text-iw-metric-{sm,md,lg,xl}`, `text-iw-tabular`.
- **Shadow** — `shadow-soft-1` / `shadow-soft-3` / `shadow-soft-5` (no ad-hoc `shadow-[...]`).
- **Gradient** — `bg-iw-brand` (static) / `bg-iw-sensory-brand` (sensory-reactive).
- **Theming** — components react to `data-sensory-mode` (`standard|calm|high-contrast`) and live under
  `data-brand="inclusive-warm"`; colors resolve through `--aivo-sensory-*` / `--aivo-color-*` vars.

**Mobile (React Native):** no CSS vars — "converted" means color/type/radius come from the
`@aivo/brand` JS exports (`INCLUSIVE_WARM_PALETTE`, `INCLUSIVE_WARM_BY_MODE`, `SEMANTIC`) via
`useSensoryPalette()` and `apps/mobile/components/ui/*`, **not** hardcoded hex literals.

### Legacy → token cheat-sheet (what the audit searched for)

| Legacy signature (unconverted) | Replace with |
| --- | --- |
| `bg-purple-600`, `bg-purple-50`, `text-purple-700` | `bg-iw-primary`, `bg-iw-accent-soft`, `text-iw-primary` |
| `text-gray-*`, `text-slate-*`, `bg-slate-50/100` | `text-iw-ink` / `text-iw-ink-muted`, `bg-brand-surface` |
| `bg-emerald-50` / `text-emerald-700` (success) | `bg-iw-success-subtle` / `text-iw-success` *(soft token gap — Phase 0)* |
| `bg-amber-50` / `text-amber-900` (warning) | `bg-iw-warning-subtle` / `text-iw-warning` *(soft token gap)* |
| `bg-rose-50` / `text-red-600` (error) | `bg-iw-error-subtle` / `text-iw-error` — canonical token is `iw-error`, not `iw-danger` *(soft token gap)* |
| `bg-sky-50`, `bg-violet-50` (info) | `bg-iw-info-subtle` / `text-iw-info` *(soft token gap)* |
| consent / billing / risk status chips | existing **domain** tokens `iw-consent-*`, `iw-billing-*`, `iw-risk-*` (`-subtle`/`-default`) — do **not** flatten to generic status |
| `rounded-xl` / `rounded-2xl` / `rounded-3xl` | `rounded-iw-card` / `rounded-iw-card-lg` |
| `rounded-full` (buttons/inputs) | `rounded-iw-control` |
| `font-sans`, `Fredoka`, `Nunito`, `Nunito-Bold` | `font-iw-display` / `font-iw-body` |
| `shadow-lg/xl/2xl`, `shadow-[0_..._rgba()]` | `shadow-soft-1/3/5` |
| old `--aivo-primary`, `bg-aivo-*`, `var(--tutor-accent)` | `iw-*` tokens |
| `--visual-*` system (marketing auth) | `iw-*` tokens |
| `--admin-*` system + `admin-*` CSS classes | `iw-*` tokens (Scholar/neutral mapping — see open decision) |
| RN hardcoded hex (`#7c3aed`, `#22c55e`, `#fff`) | `useSensoryPalette()` / `SEMANTIC` from `@aivo/brand` |

---

## 2. Current state (audit roll-up)

| Surface | Status | Overall effort |
| --- | --- | --- |
| `packages/mobile-ui` | ✅ Converted (uses `@aivo/brand` JS) | — |
| `packages/nav` | ✅ N/A (logic only) | — |
| `packages/ui` | 🟡 Mostly converted; stray `rounded-xl/2xl` | S |
| `packages/stage-ui` | 🔴 Legacy (`bg-sky-100`, `rounded-3xl`) | S |
| `packages/learner-ui` | 🔴 Legacy (Playful primitives on std Tailwind) | M |
| `packages/admin-ui` | 🔴 Legacy (`admin-*` classes, slate/blue) | M |
| `apps/web-v2` | 🟡 Core converted; long tail of status colors / `bg-aivo-*` / ad-hoc shadows | M |
| `apps/marketing` | 🟡 0% `iw-*`; uses `--aivo-sensory-*` + legacy Tailwind + `--visual-*` auth | M–L |
| `apps/web-admin` | 🔴 0% `iw-*`; self-contained legacy admin language (~65 files) | L |
| `apps/mobile` | 🟡 Core learner flows converted; feature screens on hardcoded hex / legacy `Aiv*` | M |

---

## 3. Phase 0 — Foundation (do first; blocks status-color work everywhere)

The single biggest cross-cutting blocker: **soft status tokens are not exposed.** The base universal
status colors exist in the preset as `iw-{success,warning,error,info}` (the canonical name is
`iw-error`, **not** `iw-danger`), and the soft hexes (`successSoft #dcfce7`, `warningSoft #fef3c7`,
`dangerSoft #fee2e2`, `infoSoft #ede9fe`) exist in `packages/brand/src/inclusive-warm.ts` — but
there are **no soft/`-subtle` universal-status utilities** wired through. Every `bg-emerald-50` /
`bg-amber-50` / `bg-rose-50` chip in web-v2, marketing, and web-admin needs these as their
replacement target, so they must land before the per-surface color sweeps. (Rich **domain** status
tokens already exist — `iw-consent-*`, `iw-billing-*`, `iw-risk-*` with `-subtle`/`-default` — and
consent/billing/risk chips should map to those, not to flattened generic status.)

- [ ] **F0. Token-contract decision (do before F1).** Settle three contracts the rest of the work
  depends on: (a) the universal status alias — keep `iw-error` or add a `danger`→`error` alias;
  (b) the soft-suffix convention — `-subtle` (matches the domain tokens) vs `-soft` (matches sensory
  `accent-soft`/`warm-soft`); (c) the canonical root attributes — code uses `data-sensory-mode` +
  `data-brand="inclusive-warm"`, but `migration.md` still says `data-theme`/`data-age-mode`. Pick one
  set and **update `migration.md`** so apps don't drift.
- [ ] **F1.** Add the soft status variants in the **source of truth** — the `tokens/{semantic,modes}`
  JSON and/or `src/inclusive-warm.ts` exports consumed by `scripts/build-tokens.mjs` — then
  **regenerate** the compiled artifacts with `pnpm --filter @aivo/brand build` (do **not** hand-edit
  `dist/tailwind/preset.cjs`). Wire mode-scoped overrides so soft chips stay legible in `calm` /
  `high-contrast`. Add a brand-package test asserting the chosen `bg-iw-*-{subtle|soft}` utilities and
  the `error`/`danger` alias resolve.
- [ ] **F2.** Confirm the radius/shadow aliases referenced throughout this plan resolve
  (`rounded-iw-card-lg`, `rounded-iw-chip`, `shadow-soft-1/3/5`); add any missing alias.
- [ ] **F3.** (Guardrail) **Extend the existing rule, don't reinvent it:** root `eslint.config.mjs`
  already bans hardcoded hex (`no-restricted-syntax`) for `apps/web-v2/**` + `apps/marketing/**`.
  Broaden it to also flag legacy class signatures (`bg-purple-`, `bg-slate-`, `bg-emerald-50`,
  `rounded-2xl`, `font-sans`, …) and to cover `packages/{ui,learner-ui,stage-ui}` `src` dirs.
  ⚠️ **Flat-config gotcha:** a later block re-declaring `no-restricted-syntax` for an overlapping glob
  *replaces* (doesn't merge) the options and silently drops the ban for those dirs — keep the legacy
  selectors in every block touching those paths. **Scope out** documented exceptions via file-level
  disables: decorative SVG/mascot art (e.g. `components/auth/cloud-mascot.tsx`), RN
  `app.json`/native splash, marketing legal/asset pages, fixed-brand gradients (`bg-iw-brand`).
  `apps/web-admin` is intentionally excluded today — only opt it in after the §7 decision.

**Effort: S.** Blocks: all status-color sweeps in Phases 1–2.

---

## 4. Phase 1 — Shared packages (highest leverage; one fix → many screens)

Do packages before the apps that consume them so app sweeps don't re-touch shared components.

- [ ] **P1. `packages/ui`** (S) — swap remaining `rounded-xl/2xl` → `rounded-iw-*` in
  `learner-dashboard/{LearnerProfileCard,TutorAvatar,StatChip}.tsx` and `states/AIGenerationStatusCard.tsx`.
  _Consumed by web-v2 + web-admin._
- [ ] **P2. `packages/stage-ui`** (S) — `StageBreakCloud.tsx` (`bg-sky-100`/`rounded-3xl`),
  `BeatPreview.tsx`, `ProgressPath.tsx` (legacy `aivo-*` namespacing). _Consumed by web-v2._
- [ ] **P3. `packages/learner-ui`** (M) — migrate the Playful-Calm primitives to semantic tokens:
  `primitives/{Button,Card}.tsx`, `feedback/{BreakCloud,PreviewOverlay}.tsx`,
  `layout/{LearnerShell,TabsRail}.tsx`, `a11y/SkipLink.tsx`. Migration-guide step 4 wants learner
  screens on these primitives, so this unlocks the cleanest web-v2 learner conversion. _Consumed by web-v2._
  Coordinate with P2 (shared cloud/break patterns).
- [ ] **P4. `packages/admin-ui`** (M) — `AdminCard`, `AdminKpiCard`, `DataTable`,
  `BulkSelectionBar`, `ConfirmDangerDialog`, and the `admin-*` CSS classes. **Blocked by the open
  decision** in §7 (full IW vs. a neutral/Scholar admin variant). _Consumed by web-admin._
- `packages/mobile-ui`, `packages/nav` — no work.

---

## 5. Phase 2 — Apps

### 5a. `apps/web-v2` (M) — finish the long tail
Core (layout, `components/ui/*`, login, learner home, assessment) is done. Remaining:
- [ ] **Status-color sweep** (needs Phase 0): `accept-invite/*`, `notifications/unsubscribe/*`,
  learner `player/beats/{answer-feedback,welcome-beat,guided-beat}.tsx`, `learner/select`,
  parent `team/team-hub`, `milestones`, settings `billing/subscribe-form` — replace
  `emerald/amber/rose/sky/red` with `iw-{success,warning,error,info}[-subtle]`. **Use domain tokens
  where they fit:** `parent/consent` → `iw-consent-*`, billing surfaces → `iw-billing-*`, risk →
  `iw-risk-*` (don't flatten these to generic status).
- [ ] **Legacy aliases**: `bg-aivo-*` / `var(--tutor-accent-*)` in learner/parent (gradebook,
  milestones, teacher reports) → `iw-*`.
- [ ] **Ad-hoc shadows**: brain-clone visualizations (`learner/.../awakening-client`,
  `parent/.../building-client`), `onboarding/pin` → `shadow-soft-*` or scoped vars.
- [ ] **Staff dashboards** (larger): `teacher/*`, `caregiver/*`, `district/*` status colors + radii.
- Depends on: P1 (`packages/ui`), P2 (`stage-ui`), P3 (`learner-ui`).

### 5b. `apps/marketing` (M–L)
- [ ] **Shared chrome first** (high bang-for-buck): `StickyHeader`, `Footer`,
  `forms/FormField` (`fieldInputClass`).
- [ ] **Home/landing sections** — ⚠️ **keep in visual sync with web-v2's landing per `replit.md`;
  convert the twin files together** (`page.tsx`, `Hero`, `home/LearnerFunctionShowcase`,
  `HomeHeroDevice`, `TutorCarousel`, `CTASection`).
- [ ] **Audience pages** via `LandingPageLayout` + `sections/*`, **Pricing**, **Blog/Resources**, **Legal/Company**.
- [ ] **Auth forms** (L): migrate `signup` / `forgot-password` / `reset-password` off the bespoke
  `--visual-*` system and their `globals.css` overrides onto `iw-*`.
- Mostly independent of Phase 1 (marketing doesn't consume the UI packages), but **after Phase 0**
  for status colors.

### 5c. `apps/web-admin` (L)
- [ ] **Prerequisite — IW tokens don't resolve here yet.** `web-admin` does **not** import
  `@aivo/brand/tokens.css` (only `admin-tokens.css`), so `iw-*` / `brand-*` utilities silently resolve
  to nothing. Any IW migration must first inject the brand token vars (+ `data-brand`/sensory attrs) at
  the admin root — which **will repaint** existing admin surfaces, so it is gated by the §7 decision.
- [ ] **Blocked by P4 (`packages/admin-ui`)** and the §7 decision. Note `admin-ui` is consumed via its
  **built dist** — run `pnpm --filter @aivo/admin-ui run build` after each component change or
  web-admin `tsc` reads stale types.
- [ ] Then per-route: `login/*`, `platform/*` (ops — largest), `district/*`, `school/*`, shared
  `admin-shell` / `command-palette`, and `app/globals.css` (`--admin-*` + hardcoded hex → `iw-*`).
- ~65 files with legacy color classes, ~32 with legacy radii. The CI hex-ban deliberately **excludes**
  web-admin (ratchet baseline) — only opt it into F3 after the §7 decision.

### 5d. `apps/mobile` (M)
- [ ] Replace hardcoded hex with `useSensoryPalette()` / `SEMANTIC`: `quests/index` (`WORLD_TINTS`),
  `homework/index` (`STATUS_COLORS`) + `homework/[sessionId]` (legacy `colors.*`, `Nunito-Bold`,
  `AivoCard`), `baseline/run` (`#22c55e`), `components/messages/MessagesInbox` (`#ef4444`/`#fff`),
  `(parent)/home-v2` (`#fff`/`colors.textSecondary`), `surfaces/ArtCanvasSurface` (`#1B1B1B`).
- [ ] Migrate the ~12 `(learner)` screens off legacy `@aivo/mobile-ui` `AivoCard`/`AivoButton` to
  `apps/mobile/components/ui/*`. ⚠️ **Verify first:** the package audit reports `mobile-ui` consumes
  brand constants, but the screen audit reports its `Aiv*` primitives aren't sensory-mode reactive —
  confirm whether the fix is at the screen call-sites or inside the package before sweeping.
- Independent of the web phases (depends only on `@aivo/brand`, already converted).

---

## 6. Sequencing & dependencies

```
Phase 0 (tokens) ──┬─> P1 ui ─────┐
                   ├─> P2 stage   ├─> 5a web-v2
                   ├─> P3 learner ┘
                   ├─> P4 admin-ui ─> 5c web-admin   (also gated by §7 decision)
                   ├─> 5b marketing   (parallel; only needs Phase 0)
                   └─> 5d mobile      (parallel; only needs @aivo/brand)
```
- **Critical path:** Phase 0 → P4 admin-ui → web-admin (the longest chain).
- **Parallelizable after Phase 0:** marketing and mobile run independently; web-v2 starts once
  P1–P3 land.

## 7. Open decisions (need a call before work starts)
- **Token contract (Phase 0 / F0):** the universal status alias (`iw-error` vs `iw-danger`), the
  soft-suffix convention (`-subtle` vs `-soft`), and the canonical root attributes
  (`data-sensory-mode`/`data-brand` vs `migration.md`'s `data-theme`/`data-age-mode`). Settle these
  and update `migration.md` before any token or sweep work — everything downstream references them.
- **Admin aesthetic:** does `web-admin` adopt the full Inclusive-Warm look, or stay a separate
  professional register? ⚠️ There is an **existing deliberate decision** that the admin console is a
  separate visual register and does *not* load the consumer `tokens.css` (pulling in the full brand
  var set risks repainting admin surfaces unpredictably; its colors live in `admin-tokens.css` /
  `--admin-*`). So "convert web-admin" really means "reverse that decision" — confirm with stakeholders
  before P4 / §5c. If admin stays separate, realistic scope shrinks to aligning the `admin-*` token
  *values* with IW rather than swapping to `iw-*` classes. This is the gate for the largest chunk of work.
- **Marketing auth `--visual-*`:** confirm it can be fully retired (no other consumer) before deleting
  its `globals.css` blocks.

## 8. Verification (per area)
- `pnpm typecheck` + `pnpm lint` on the touched package/app.
- Visual diff against the 7 reference screens; capture before/after in
  `screenshots/design-language/` (migration-guide step 6).
- **Sensory-mode parity:** toggle `standard` / `calm` / `high-contrast` and confirm status chips,
  gradients, and focus rings still meet contrast (AAA in high-contrast).
- Keep marketing ↔ web-v2 landing pages in sync (`replit.md`).
- Phase-0 CI grep check stays green (allowlist shrinks each phase).
- `pnpm i18n:audit` only if copy changes (most of this is class-only).

## 9. Rough effort roll-up
Phase 0 **S** · ui **S** · stage-ui **S** · learner-ui **M** · admin-ui **M** ·
web-v2 **M** · marketing **M–L** · web-admin **L** · mobile **M**.

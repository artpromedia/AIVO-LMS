# AIVO Mobile — Phone & Tablet Responsiveness Hardening

A hardening, consistency, and device-verification pass over the **existing**
responsive foundation. No parallel breakpoint system was added; every change
adopts the established primitives:

- `src/design/responsive.ts` — `BREAKPOINTS`, `classifyWidth`, `gridColumns`,
  `CONTENT_MAX_WIDTH`, `pickBySizeClass`.
- `src/design/useWindowSizeClass.ts` — live size class + `isLandscape`.
- `src/components/layout/ResponsiveScreen.tsx` — screen scaffold (safe-area
  top inset, size-class horizontal padding, centered content-width cap).
- `RoleTabletShell` / `TabletScaffold` — rail vs. bottom-tabs nav surface.
- `SplitPane` — tablet master/detail.
- `useStageLayout` / `stageLayout.ts` — immersive stage geometry.

Breakpoints are unchanged (`compact <600`, `medium 600–839`, `expanded ≥840`,
`xlarge 1200`), so `__tests__/ipad-multitasking.test.ts` and
`role-shell-multitasking.test.ts` stay green.

---

## Workstream A — `ResponsiveScreen` adoption

Top-level surfaces that previously rooted in a bare `ScrollView` /
`SafeAreaView` with hand-rolled `insets.top` + `paddingHorizontal` math were
migrated to `ResponsiveScreen`, which centralises that math and caps content
width on tablets.

### Migration list

| File | Was | Now (`maxWidth`) | Notes |
|------|-----|------------------|-------|
| `app/messages.tsx` | raw `ScrollView` + `insets.top` | `reading` | Inbox column capped at 720dp. `allow` path uses `scroll={false}` + `innerStyle.flex` so the threaded `MessagesInbox` keeps its own master/detail scrolling. |
| `app/notifications.tsx` | raw `ScrollView` + `insets.top` | `reading` | All four access outcomes share one `ResponsiveScreen` shell. |
| `app/(parent)/recommendations.tsx` | raw `ScrollView` + manual `contentWidth` | `dashboard` (phone path) | Tablet `SplitPane` console path is unchanged by design (queue + detail). Phone/compact path now routes through `ResponsiveScreen`; duplicated width math removed. |
| `app/(learner)/shop.tsx` | raw `ScrollView` + `insets.top` | `dashboard` | See Workstream B — also moved to `gridColumns`. |

### Audit — screens already compliant (no change needed)

These already root through `ResponsiveScreen`:
`(learner)/subjects/index.tsx`, `(learner)/subjects/[subjectId].tsx`,
`(learner)/library.tsx`.

### Audit — role dashboards (intentionally NOT `ResponsiveScreen`)

`(parent)/index.tsx`, `(teacher)/index.tsx`, `(therapist)/index.tsx`,
`(caregiver)/index.tsx`, and `(learner)/index.tsx` keep their own
`ScrollView` roots **on purpose**: each pairs a `RefreshControl` with a
size-class-aware `contentWidth` (`CONTENT_MAX_WIDTH.dashboard`) and the same
`pickBySizeClass` horizontal padding `ResponsiveScreen` uses, so they already
honour the cap and inset rules. They are not full-bleed regressions. Folding
them into `ResponsiveScreen` was scoped out to avoid churn on the highest-
traffic screens in the same pass that introduces the helper elsewhere; they
remain a clean follow-up once the scaffold has soaked.

---

## Workstream B — size-class card grids

`gridColumns(sizeClass)` returns **2 compact / 3 medium / 4 expanded**.

### Grids driven by `gridColumns`

| File | Grid content | Columns source |
|------|--------------|----------------|
| `(learner)/index.tsx` | world tiles + quick-action tiles | `gridColumns(sizeClass)` (pre-existing) |
| `(learner)/badges.tsx` | badge tiles | `gridColumns(sizeClass)` (pre-existing) |
| `(learner)/shop.tsx` | cosmetic item tiles | **migrated** from hard-coded `width: "47%"` to `gridColumns(sizeClass)` |
| `(learner)/subjects/index.tsx` | subject tiles | `useColumns()` from `@aivo/mobile-ui` — the sanctioned shared mirror of the same ladder, not a parallel source. Left as-is. |

### Single-column **by design** (grids would hurt)

- `(parent)/index.tsx` — child cards are rich, full-width cards with an avatar
  row **and** a 5-button action footer (brain / progress / IEP / team /
  milestones). Tiling these 2–4 wide would crush the footer. Single column.
- `(teacher)/index.tsx`, `(therapist)/index.tsx`, `(caregiver)/index.tsx` —
  student / client / child entries are wide list **rows** (avatar + name +
  level badge + chevron), scannable as a vertical list. A 4-up grid of tiny
  chips reads worse, not better. Single column (list).
- `(learner)/challenges.tsx` — stacked challenge cards (progress + CTA per
  row): a reading list, single column.
- `(learner)/library.tsx`, `(learner)/subjects/[subjectId].tsx` — long-form
  reading lists, single column.

---

## Workstream C — orientation & immersive surfaces

### Policy

The app ships **`orientation: "default"`** (`app.json`) — i.e. all
orientations are allowed and the OS follows the device. Combined with the
already-correct native config (iOS `supportsTablet: true`,
`requireFullScreen: false`; Android `resizeableActivity: true`), every surface
rotates and multitasks freely.

**No global or per-screen orientation locks are applied, and
`expo-screen-orientation` is intentionally NOT added.** A lock would only be
justified to pin a single game that genuinely requires it; none currently
does. Adding the native module for a no-op policy would cost a native rebuild
for zero behavioural gain, so the JS-only hardening pass leaves it out. If a
future game needs a lock, add `expo-screen-orientation`, wire it in
`app/_layout.tsx`, and document the per-route exception here.

### Verification — geometry adapts, it does not lock

- `(learner)/stage/[sessionId].tsx` — consumes
  `useWindowSizeClass().{ isTablet, isLandscape, sizeClass }`; the session map
  shows only in tablet landscape. Stage geometry resolves through
  `useStageLayout` → `resolveStageLayout(width, height)`, which recomputes on
  rotation and split-view drag (covered by
  `__tests__/ipad-multitasking.test.ts` → stage-layout cases and
  `stage-layout.test.ts`).
- `(learner)/adventure.tsx`, `(learner)/audio.tsx` — flex-based layouts
  (`flex: 1` + size-class padding), no fixed full-screen pixel dimensions or
  `aspectRatio` locks, so they reflow cleanly across portrait↔landscape with
  no clipping. Fixed dimensions present are only small control affordances
  (44/48dp buttons).

---

## Workstream D — device verification matrix

`isTablet` is **width-driven** (`width >= 600dp`), so multitasking panes fold
onto the same `compact / medium / expanded` ladder as physical devices. The
nav-surface column below is enforced statically by
`role-shell-multitasking.test.ts`; the width→size-class mapping by
`ipad-multitasking.test.ts`.

| Device class | Example | Portrait | Landscape | Split / multi-window |
|---|---|---|---|---|
| Small phone | iPhone SE / Pixel 4a | bottom tabs (compact) | bottom tabs (compact) | n/a |
| Large phone | Pixel 8 Pro / iPhone 15 Pro Max | bottom tabs (compact) | bottom tabs (compact) | n/a |
| Foldable | Galaxy Z Fold | folded → bottom tabs; unfolded → rail (medium) | rail | n/a |
| Small tablet | iPad mini / Galaxy Tab A | rail (medium, 768dp) | rail/drawer | ⅓ split → compact (bottom tabs) |
| Large tablet | iPad Pro 12.9" / Tab S9 Ultra | rail (expanded portrait, 1024dp) | 240pt drawer (expanded) | ½ split landscape → rail (medium, 678dp) |
| Android tablet | Pixel Tablet | rail | drawer | split-screen → folds by pane width |

Per-cell checks performed: correct nav surface, content width capped (no
full-bleed stretch), no clipping, safe-area honoured, rotation stable, and —
on tablets — grids reflow to 3/4 columns where applicable.

> **Screenshots:** attach the per-cell captures to the PR (run
> `pnpm --filter @aivo/mobile start` against the iPad + Galaxy Tab
> simulators). They are binary artifacts and live on the PR, not in-repo.

---

## Tests

- `__tests__/responsive-adoption.test.ts` (new) — asserts the migrated
  screens import and render `ResponsiveScreen` with the documented `maxWidth`,
  that true grids call `gridColumns(sizeClass)`, and that shop no longer pins
  `width: "47%"`.
- `__tests__/ipad-multitasking.test.ts`, `role-shell-multitasking.test.ts`,
  `stage-layout.test.ts`, `split-pane-layout.test.ts` — unchanged, still green
  (breakpoints untouched).

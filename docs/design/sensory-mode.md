# Sensory Mode — Design Reference

AIVO supports three sensory modes to accommodate learners with varying perceptual and sensory needs. The mode is selected per-learner (or per-device for guests) and propagates to every visual surface.

| Mode | Description | Motion | Contrast |
|------|-------------|--------|----------|
| **Standard** | Full brand palette and motion. | `motionScale: 1` | WCAG AA |
| **Calm** | Lower saturation, softer shadows, reduced motion. | `motionScale: 0.5` | WCAG AA |
| **High Contrast** | Maximum contrast, no motion. | `motionScale: 0` | WCAG AAA targets |

---

## Web implementation

On `web-v2` the active mode is stored in a `data-sensory-mode` attribute on `<html>`. CSS variables in `@aivo/brand` emit per-mode overrides that are applied automatically to all components that use design tokens.

See `packages/brand/src/inclusive-warm.ts` for the full token set.

---

## Mobile implementation

React Native cannot read CSS variables. Instead, the active palette is distributed through a React context (`SensoryModeProvider`) in `apps/mobile/context/SensoryModeProvider.tsx`.

Components call:

```ts
// Full context (mode + palette + motion/shadow scalars)
const { mode, palette, motionScale, shadowStrength } = useSensoryMode();

// Shortcut when only colours are needed
const palette = useSensoryPalette();
```

The `palette` object mirrors the token set from `INCLUSIVE_WARM_BY_MODE` in `@aivo/brand`:

```ts
// Key palette fields used by charts:
palette.primary       // brand colour (shifts in high-contrast)
palette.ink           // primary text / ring label
palette.inkMuted      // secondary text / bar percentage labels
palette.border        // empty-state dashed border
palette.bgRaised      // brand-tone soft fill / ring track
```

---

## Mobile chart primitives and sensory modes

The `@aivo/mobile-ui/chart` kit (`packages/mobile-ui/src/chart/`) is the mobile mirror of `@aivo/ui/chart`. All three primitives — **Sparkline**, **BarMini**, and **ProgressRing** — accept an optional `palette` prop:

```tsx
import { Sparkline, BarMini, ProgressRing } from "@aivo/mobile-ui";
import { useSensoryPalette } from "@/context/SensoryModeProvider";

export function MyChart() {
  const palette = useSensoryPalette();   // resolves per active mode

  return (
    <>
      <Sparkline series={[1, 3, 2, 5]} palette={palette} />
      <BarMini bars={[{ label: "Math", value: 80, maxValue: 100 }]} palette={palette} />
      <ProgressRing value={0.72} palette={palette} />
    </>
  );
}
```

### How each mode affects chart rendering

| Element | Standard | Calm | High Contrast |
|---------|----------|------|---------------|
| Brand stroke / ring arc | `#7c3aed` | `#6d28d9` | `#4c1d95` |
| Ring / bar track fill | `#f8f9f8` (bgRaised) | `#f7f8f7` | `#ffffff` |
| Centre text / bar labels | `#090909` (ink) | `#0f0f10` | `#000000` |
| Percentage labels | `#6f7275` (inkMuted) | `#52555a` | `#1f2937` |
| Empty-state border | `rgba(0,0,0,0.05)` | `rgba(0,0,0,0.06)` | `#000000` |
| Semantic tones (`success`, `warning`, `danger`) | fixed hex | fixed hex | fixed hex |

**Semantic tones** (`success`, `warning`, `danger`) use fixed hex values so their conventional meaning (green = good, amber = caution, red = alert) is preserved across modes. Only the `brand` tone shifts with `palette.primary`.

### Motion

Mobile chart primitives are static SVG — they do not animate. The `motionScale` from `useSensoryMode()` is therefore not directly consumed by these components. Callers that add entrance animations (e.g. `Animated.timing`) should multiply the duration by `motionScale` to honour the calm and high-contrast preferences.

---

## Persistence and syncing

- The active mode is persisted in `AsyncStorage` under the key `@aivo/sensory_mode_v1`.
- When a `learnerId` is present, the mode is synced to `assessment-svc` (`POST /api/assessments/sensory-profile`) so it follows the learner across devices. The server is the source of truth when both a local cache and a backend record exist.

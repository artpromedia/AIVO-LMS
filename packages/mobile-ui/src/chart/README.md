# Mobile chart kit (`@aivo/mobile-ui/chart`)

Mobile charting primitives built on [`react-native-svg`](https://github.com/software-mansion/react-native-svg), sensory-palette aware.

These components mirror the visual language of [`@aivo/ui/chart`](../../packages/ui/src/chart/) (the web chart kit) so parent, learner, therapist, and caregiver dashboards read consistently across both platforms.

---

## Components

### `Sparkline`

Compact SVG trend line for KPI tiles.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `series` | `number[]` | — | Numeric data array (e.g. daily sessions). |
| `label` | `string` | `"Trend"` | Accessibility label prefix. |
| `tone` | `ChartTone` | `"brand"` | Stroke colour (see tones below). |
| `palette` | `SensoryPalette` | standard | Resolved palette from `useSensoryPalette()`. |

**Example:**

```tsx
import { Sparkline } from "@aivo/mobile-ui";
import { useSensoryPalette } from "@/context/SensoryModeProvider";

export function SessionsTile() {
  const palette = useSensoryPalette();
  return (
    <Sparkline
      series={[2, 3, 5, 4, 6, 7, 5]}
      label="Sessions over last 7 days"
      tone="brand"
      palette={palette}
    />
  );
}
```

---

### `BarMini`

Small horizontal comparison bars (e.g. mastery per subject).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bars` | `BarItem[]` | — | Each entry: `{ label, value, maxValue }`. |
| `subject` | `string` | `"Subjects"` | Accessibility label prefix. |
| `tone` | `ChartTone` | `"brand"` | Fill colour. |
| `palette` | `SensoryPalette` | standard | Resolved palette from `useSensoryPalette()`. |

**Example:**

```tsx
import { BarMini } from "@aivo/mobile-ui";
import { useSensoryPalette } from "@/context/SensoryModeProvider";

export function MasteryBreakdown() {
  const palette = useSensoryPalette();
  return (
    <BarMini
      bars={[
        { label: "Math", value: 80, maxValue: 100 },
        { label: "ELA", value: 75, maxValue: 100 },
        { label: "Science", value: 90, maxValue: 100 },
      ]}
      subject="Subjects mastery"
      palette={palette}
    />
  );
}
```

---

### `ProgressRing`

Radial progress indicator (0..1 ratio).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | — | Progress in 0..1 (clamped). |
| `label` | `string` | `"Progress"` | Accessibility label prefix. |
| `size` | `number` | `80` | Outer diameter in logical pixels. |
| `tone` | `ChartTone` | `"brand"` | Ring stroke colour. |
| `palette` | `SensoryPalette` | standard | Resolved palette from `useSensoryPalette()`. |

**Example:**

```tsx
import { ProgressRing } from "@aivo/mobile-ui";
import { useSensoryPalette } from "@/context/SensoryModeProvider";

export function CourseProgress({ completion }: { completion: number }) {
  const palette = useSensoryPalette();
  return (
    <ProgressRing
      value={completion}
      label="Course completion"
      size={96}
      palette={palette}
    />
  );
}
```

---

## Tones

| Tone | Colour | Notes |
|------|--------|-------|
| `brand` | `palette.primary` | Shifts in sensory modes (high-contrast = `#4c1d95`). |
| `success` | `#22c55e` | Fixed semantic green. |
| `warning` | `#f59e0b` | Fixed semantic amber. |
| `danger` | `#ef4444` | Fixed semantic red. |

---

## Accessibility

Every component includes:

- **`accessibilityRole="image"`** on the root `View`.
- **`accessibilityLabel`** — plain-language description of the data (e.g.  
  `"Sessions over last 7 days: 2, 3, 5, 4, 6, 7, 5"`).
- The inner `Svg` element is `aria-hidden` so screen readers announce only the parent label.
- `Sparkline` and `BarMini` render a visually-hidden prose description of the data (positioned off-screen, hidden from the accessibility tree via `importantForAccessibility="no"`).

---

## Web parity

| Mobile (`@aivo/mobile-ui/chart`) | Web (`@aivo/ui/chart`) |
|----------------------------------|------------------------|
| `Sparkline` | `SoftLine` |
| `BarMini` | `MasteryHeatStrip` bars |
| `ProgressRing` | `ProgressCurve` (ring variant) |

See [`packages/ui/src/chart/`](../../../../packages/ui/src/chart/) for the web equivalents.

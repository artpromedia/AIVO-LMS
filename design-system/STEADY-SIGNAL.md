# AIVO Steady Signal

Steady Signal is AIVO's clean-sheet, neurodiverse-first design language.

It replaces the old Playful Calm and Inclusive Warm visual direction. Existing exports remain
temporarily available as migration adapters, but new work must target Steady Signal.

The organizing idea is simple:

> AIVO is a steady signal in a noisy world.

Every surface must make the current state, the meaningful change, and the next action clear without
adding pressure or sensory noise.

## Principles

1. **Clarity before delight.** Delight may reinforce understanding, but never competes with it.
2. **One signal leads.** Every state has one visually dominant next action.
3. **Predictability builds agency.** Navigation, feedback, and recovery behave consistently.
4. **Intensity belongs to the user.** Motion, sound, density, and character presence scale
   independently.
5. **Progress is evidence, not pressure.** Never use loss, urgency, or shame to drive engagement.
6. **Different expression, shared grammar.** Learner, care, professional, and marketing registers
   use the same signal rails, focal markers, semantic colors, and interaction states.
7. **Dignity scales. Capability does not disappear.** Symbol-first and phone layouts remain complete.

## Identity

### Visual grammar

Steady Signal avoids the generic rounded-card SaaS kit.

- **Signal rail:** a directional line showing sequence, selection, or state history.
- **Focal marker:** an explicit point on the rail showing what matters now.
- **Notched region:** a clipped corner that creates recognition without excessive softness.
- **Signal field:** a quiet tonal surface that separates context without decorative clutter.

### Brand personality

- Calm, never sterile
- Encouraging, never performative
- Precise, never clinical
- Curious, never chaotic
- Respectful across every age and ability

### Character strategy

Characters are optional Signal Guides, not the identity's foundation. They may explain state or
offer reassurance, but never become mandatory chrome, nag the learner, or carry information that is
unavailable through text, symbols, or assistive technology.

## Source Of Truth

The only editable Steady Signal token source is:

`packages/brand/tokens/steady-signal.json`

`packages/brand/scripts/build-tokens.mjs` generates:

- CSS custom properties in `packages/brand/dist/css/tokens.css`
- Typed source data in `packages/brand/src/generated/steady-signal.ts`
- The merged JSON artifact in `packages/brand/dist/json/tokens.json`

Web consumers apply the generated CSS data attributes. React Native consumers use
`resolveSteadySignal()` from `@aivo/brand` or `createSteadySignalTheme()` from `@aivo/mobile-ui`.

Do not copy token values into app code.

## Adaptive Axes

All axes are independent. Combining axes must not require per-screen branches.

| Axis | Values | Responsibility |
| --- | --- | --- |
| Appearance | `light`, `dark`, `high-contrast` | Semantic color and contrast |
| Sensory | `calm`, `standard` | Motion, sound, decoration, elevation |
| Age | `early`, `middle`, `older` | Target size, type scale, spacing, density |
| Communication | `symbol-first`, `supported-text`, `text-first` | Symbol scale, prompt length, AAC position |
| Role | `learner`, `care`, `professional`, `marketing` | Register density and restrained accent |

### Web contract

```html
<div
  data-design-system="steady-signal"
  data-ss-appearance="light"
  data-ss-sensory="calm"
  data-ss-age="early"
  data-ss-communication="symbol-first"
  data-ss-role="learner"
>
  ...
</div>
```

Use logical CSS properties such as `border-inline-start` and `inset-inline-start` so the signal
grammar mirrors correctly in RTL.

### React Native contract

```ts
import { createSteadySignalTheme, classifySteadySignalStage } from "@aivo/mobile-ui";

const theme = createSteadySignalTheme({
  appearance: "dark",
  sensory: "calm",
  age: "early",
  communication: "symbol-first",
  role: "learner",
});

const layout = classifySteadySignalStage(width, height);
```

## Foundations

### Color

Steady Signal uses soft lavender neutrals, deep plum ink, an AIVO violet signal, and a restrained amber beacon — the calmer, more personal AIVO direction.

- `signal` identifies the primary action and active state.
- `beacon` identifies something that needs attention without using alarm red.
- `positive` confirms completion or safety.
- `danger` is reserved for destructive or genuinely unsafe states.
- Every semantic color has a paired soft surface or on-color value.

No role receives a separate brand palette. Role accents tune the same identity.

### Typography

- Default display and UI face: Inter
- Reading and dyslexia-friendly face: Atkinson Hyperlegible
- Data and identifiers: JetBrains Mono

Learner and care surfaces use more generous line height. Professional surfaces use the same family
with denser spacing and tabular figures.

### Shape

- Controls: 12px radius
- Surfaces: 18px radius where clipping is unavailable
- Regions: 24px radius
- Signature regions: notched corner
- Pills: reserved for statuses and compact filters, never used as the universal control shape

### Motion

Motion is optional enhancement.

- `calm` sets `motionScale` to `0`.
- `prefers-reduced-motion: reduce` disables all transition and animation.
- No loop is required to understand state.
- No state change may block interaction while animation finishes.
- Completion remains visible and announced when motion is disabled.

### Sound

- Confirmation: one soft tone
- Completion: three-note rising phrase
- Attention: no alarm sound
- Ambient audio: explicit opt-in only
- Calm mode: silent

## Component Model

### Shared primitives

- **SignalRegion:** notched semantic surface with optional leading rail.
- **SignalRail:** sequence/history structure with explicit current, complete, and future states.
- **FocalAction:** the one dominant action in a state.
- **QuietAction:** secondary action without competing chroma.
- **StatusMarker:** text plus shape plus semantic color; never color alone.
- **CommunicationDock:** persistent or on-demand AAC/TTS access.
- **EvidenceMetric:** value, label, provenance, and optional trend.

### Learner tier

- **LearnerStage:** one task at a time, generous targets, communication always reachable.
- **ChoiceField:** two to four forgiving choices; supports symbols, audio, switch scanning, and text.
- **StageContext:** shows where the learner is without becoming a navigation sidebar.
- **BreakAction:** always available, never framed as failure.

### Professional tier

- **CommandBar:** keyboard-first search, filters, and actions.
- **SignalTable:** dense table with selection and attention rails.
- **EvidenceTimeline:** chronological facts before interpretation.
- **InsightRegion:** summary plus visible supporting evidence.

## Responsive Model

### Learner mobile

| Form factor | Layout |
| --- | --- |
| Phone portrait, `<600px` | Single focused column, bottom communication dock, thumb-reachable controls |
| Tablet portrait, `>=600px` | Stage plus persistent communication region, context above or beside stage |
| Tablet landscape, `>=840px` and width > height | Three-region layout: context rail, stage, communication dock |

Phone retains the full lesson, pause, replay, help, AAC/TTS, and response capabilities. Tablet
layouts must not be stretched phone screens.

### Family mobile

| Form factor | Layout |
| --- | --- |
| Phone portrait, `<600px` | Compact header, stacked learner/goal summary, two-column snapshot grid, persistent bottom navigation |
| Tablet portrait, `>=600px` | Horizontal learner/goal summary, two-column snapshot grid, persistent bottom navigation |
| Tablet landscape, `>=840px` and width > height | Horizontal learner/goal summary, four-column snapshot grid, persistent bottom navigation |

Family dashboards lead with the learner's current state and weekly goal, then present a small
evidence snapshot and one meaningful insight. Tablet layouts recompose the regions instead of
scaling the phone cards. Bottom navigation remains stable across the three supported device
classes.

### Web and admin

- Marketing expands the signal grammar into broad narrative fields.
- Care surfaces prioritize summaries and evidence timelines.
- Professional surfaces increase density while retaining signal rails and semantic state markers.

## Accessibility Acceptance Tests

Every migrated component must meet these checks:

### Contrast and appearance

- Normal text: WCAG AA minimum.
- Early learner primary text: target AAA.
- Focus indicators: visible against every appearance mode.
- Dark and high-contrast are native outputs, not filters.
- Status is never conveyed by color alone.

### Input and targets

- Early learner target: at least 64px.
- Middle learner target: at least 56px.
- Older learner target: at least 48px.
- Adult minimum: at least 44px.
- Full keyboard operation and logical focus order.
- Switch scanning and screen reader labels for learner choices.

### Motion and sound

- All tasks remain complete with motion scale zero.
- `prefers-reduced-motion` disables transforms and loops.
- Calm is silent by default.
- No autoplay ambient sound.

### Communication

- Symbol-first mode can complete the same task as text-first mode.
- TTS output has a visible replay control.
- AAC dock remains reachable without leaving the active task.
- Prompts do not rely on audio alone.

### Responsive and international

- Verify tablet portrait, tablet landscape, and phone portrait.
- Verify RTL mirroring with logical properties.
- Verify text expansion in all ten locales without clipping or lost actions.

## Proof Surface

Run `apps/web-v2` and open `/design-preview`.

The proof surface demonstrates:

- Independent adaptive axes
- Learner tablet landscape and phone portrait
- Care-team evidence presentation
- Professional table and command bar
- Marketing identity
- Foundation tokens and signature anatomy

The route is dev-only. It is a migration reference, not a production feature.

## Migration Order

1. Token contract and CI validation
2. Shared primitives
3. Learner stage and learner home
4. Mobile parity across tablet and phone
5. Care surfaces
6. Professional/admin surfaces
7. Marketing
8. Remove Playful Calm and Inclusive Warm compatibility exports

During migration, new raw style literals are prohibited. Existing allowlisted literals must only
decrease.

# Self-Regulation and Focus Monitor

## Focus Monitor

`observeFocus(signals)` returns a structured `FocusObservation`:

```ts
{
  state: "focused" | "needs_prompt" | "frustrated" | "needs_break";
  reason: string;
  recommendedAction: "micro_hint" |
    "simplify_step" |
    "offer_break" |
    "switch_surface" |
    "parent_support";
}
```

Signals it considers:

- inactivity (medium → `needs_prompt`, long → `needs_break`)
- consecutive wrong attempts (≥3 → `frustrated`, simplify the step)
- eraser count (≥5 → `frustrated`, suggest switching surface)
- hint requests (≥3 → `needs_prompt`, micro hint)
- tool switch count (≥4 → `needs_prompt`)
- abandoned surface (→ `needs_break`)
- high response latency (≥45s → `needs_prompt`)

The monitor never mutates the session itself; it only emits a signal the
tutor and the parent dashboard can act on.

## Self-Regulation Prompts

Prompts a learner can opt into:

- short breathing break
- stretch break
- try a smaller step
- switch to drawing
- listen to instruction again
- ask parent for help
- return to the problem

`recommendSelfRegulationPrompt(observation, sensoryProfile)` chooses the
prompt and respects the learner's sensory profile:

- shorter wording when `shorterPrompts: true`
- audio gating — audio is only allowed when `audioEnabled === true` and
  `quietMode` is off
- reduced motion, high contrast, and large controls are surfaced as
  `uiAdjustments` so the homework UI can apply them deterministically.

## Feature Flag

Focus monitor + self-regulation prompts only run when
`AIVO_FEATURE_SELF_REGULATION_HUB=true`.

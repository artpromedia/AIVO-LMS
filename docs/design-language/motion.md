# Motion and sound

Motion variants are in `packages/learner-ui/src/motion/variants.ts`:
- `springGentle`
- `springBounce`
- `pop`
- `slideUp`
- `confetti`
- `mascotIdle`
- `mascotCelebrate`

Sound effects are handled by `useSfx()` in `packages/learner-ui/src/sound/useSfx.ts` with events:
`click`, `success`, `error-soft`, `level-up`, `unlock`, `page-turn`.

## Reduced motion policy

When `prefers-reduced-motion` is set, token durations are reduced to `0ms` in generated token CSS.

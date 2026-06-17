---
name: AIVO robot family — companion + 14 tutor avatars
description: The AIVO robot is one cohesive 3D mascot family used for the Stage companion AND all 14 subject-tutor avatars.
---

# One robot family: the AIVO companion + the 14 tutors

The friendly purple "Virtual Brain" robot is the master character for a single
cohesive mascot family rendered in the same cute chibi 3D style:

- **Companion** (brand presence in the Stage, web + mobile): the purple original.
  Web serves it at `/images/mascot/virtual-brain-robot.png`; mobile bundles a
  copy under `apps/mobile/assets/images/`.
- **14 subject tutors**: each is the SAME chassis recolored to its accent color
  (`TUTORS[key].color` in `packages/brand/src/tutors.ts`) plus one subject motif.
  Served as transparent PNGs at `apps/web-v2/public/images/tutors/{key}.png`
  (overwriting these paths auto-wires them everywhere; no code change needed).

**History:** the tutor avatars used to be realistic *human* portraits. They were
replaced with this robot family on user request (mid-2026). Do NOT reintroduce
human-portrait tutors.

**Why:** consistency — the learner should feel one warm robot world, not a mix of
a robot mascot and human teachers.

**How to apply (regenerating / adding a family member to match):**
- Keep ONE shared base prompt describing the exact chassis (glossy rounded white
  body, dark glossy screen face with two glowing rounded-rect eyes + small smile,
  single bobble antenna, headphone-like ears, stubby arms/legs, accent heart on
  chest, Pixar-like soft-studio 3D render), then vary only `accent color` +
  `subject motif`. Aspect `3:4`, `removeBackground: true` (matches existing
  179×256 portrait avatars + the transparent companion).
- Image models render gibberish text: never ask for books/bubbles "with text";
  use blank glowing pages / dot-only speech bubbles and put text in the negative
  prompt.
- Treat all of these as decorative (aria-hidden / RN importantForAccessibility
  hidden); real text + SR-labelled UI carry meaning. Idle motion must be gated
  under Calm / high-contrast / reduced-motion AND the Stage's `motionOff`.

**Reduced-motion fallbacks:** the `{key}-reduced.svg` motion-off avatars (in
web-v2/public, marketing/public, and brand canonical — mobile has none) are now
flat robot-family vectors that match the PNGs: white rounded head, dark screen
face with glowing accent eyes + smile, antenna, headphone ears, accent chest
heart, on a calm pale accent-tinted disc with an accent ring. Each is the same
96×96 template recolored to `TUTORS[key].color` (eyes/smile use the accent
lightened ~18%). Regenerate via the same parametric template; keep them calm
(no animation, soft tint) since reduced motion pairs with low-sensory mode.

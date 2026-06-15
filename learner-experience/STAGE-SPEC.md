# AIVO Stage — Design Spec (Step 1 deliverable)

> **Task #5, Step 1 — spec & approval gate.** Per `DESIGN-DIRECTION.md` §8 row 2 ("Lesson
> player", effort XL), this spec defines the elevated Stage *before any production code changes*.
> A working, interactive preview ships alongside it at **`/design-system/stage`** (dev-only,
> 404 in production via `DEV_ONLY_PREFIXES`). **Nothing in production has changed. Phase 2
> implementation begins only after explicit approval.**

The Stage is the full-screen, beat-based lesson surface where learners actually live
(`/learner/lesson-runs/[lessonRunId]` web, `(learner)/stage/[sessionId]` mobile). The runtime,
adaptive engine, and BFF are already real — this is an **elevation, not a rebuild**. Today the
tutor host is a plain emoji (`TUTOR_EMOJIS[tutorKey] ?? "🤖"`), the surface is not on the `--lx-*`
learner token layer, and there are no per-tutor "worlds" or designed celebration/encouragement
moments. We make it feel like **"a world with a host, not a dashboard."**

---

## 0. North star for the Stage

A learner should feel **accompanied**, never tested. The robot tutor is a *host who reacts*, the
beat journey is *legible and forgiving*, and every interaction is *audio-first and switch-operable*.
The three non-negotiables thread through every decision: neurodiverse-first soul (Mood / Spacing /
Font / Sound are load-bearing), accessibility never regresses (WCAG AA), and no dark patterns
(no countdowns, no shame, breaks never punitive).

---

## (a) Screen-state map

Every Stage state below has a **static + screen-reader equivalent** (information never depends on
motion or sound). States are announced through the existing `LiveRegion`/`aria-live` plumbing.

| State | When | Host (robot) | Visual | Copy (microcopy §6) | A11y / SR |
| --- | --- | --- | --- | --- | --- |
| **Loading** | Lesson/beat generating | `thinking` pose, floating dot (motion-gated) | World accent wash, soft shimmer placeholder — **no gray spinner** | "Getting your lesson ready…" | `role="status"`, polite: "Loading your lesson" |
| **Opening / warmup** | Lesson starts | `speaking` / `encouraging` | Host enters, prompt card, big **Play sound** | "Let's go!" / "Ready when you are." | Beat narration announced; Play button labeled "Play the question" |
| **Listen (narration beat)** | Tutor explains | `speaking` (mouth/eye motion gated) | Narration card, prominent **Play sound** + **Again** | beat narration text | Narration is real text; replay labeled |
| **Choose (interaction beat)** | Learner answers | `pointing` / `encouraging` | Large choice cards capped at `maxChoices`; MY WORDS rail | beat prompt | Choices are `role` buttons, 48–96px targets per FL, arrow/Tab/switch operable |
| **Check / correct** | Right answer | `celebrating` (gated) | Chosen card → mint success ring, soft pop, optional ding | "You figured out the tricky one!" | Polite live: "Correct"; success not color-only (✓ + ring) |
| **Check / gentle retry** | Wrong answer | `encouraging` (lean-in) | Card settles back, **no red, no shake**; hint surfaces in MY WORDS | "Not quite — want to try again together?" | Polite live: "Let's try that again"; focus returns to choices |
| **Encouragement beat** | Mid-lesson nudge | `encouraging` | Host lean-in + small chevron, calm wash | "You've got this." | Real text; decorative art `aria-hidden` |
| **Celebration / complete** | Lesson done | `celebrating`, sparkles (Energizing+, Calm none) | Celebration moment ~1.1s, XP float, 3-note chime; **fully skippable, never blocks** | "Lesson complete — nice work!" | Polite live: "Lesson complete. You earned 15 XP."; Skip/Continue focusable |
| **Break (always reachable)** | Any time, learner-initiated | `resting` | `StageBreakCloud`: breathe / listen / stretch / quiet — **never punitive, no timer** | "Breaks are good. Take your time." | Modal labeled; Esc/Resume; does not lose progress |
| **Empty** | No beats / nothing assigned | `resting` | Calm illustration, single primary action | "Your story starts here — pick a world to begin." | One primary action; clear heading |
| **Error** | Beat/step fetch fails | `thinking`→neutral | Calm card, **one** retry action — no stack trace | "Hmm, Aivo got a bit lost. Let's try that again." | `role="alert"`; retry button labeled; focus moved to it |

### PRE_SYMBOLIC variant (and the FL ramp)

The Stage renders at every functioning level. Choices are **always capped at the FL's
`maxChoices`** (`packages/learner-ui/src/tokens/fl-profiles.ts`), targets grow, text recedes, and
motion shrinks to zero at the bottom of the ramp:

| FL | maxChoices | Text weight | Hit target | Motion | Stage shape |
| --- | --- | --- | --- | --- | --- |
| STANDARD | 5 | full | 48px | full (budget 8) | full beat journey, progress path, MY WORDS rail |
| SUPPORTED | 3 | reduced | 56px | reduced (budget 4) | simplified progress, larger cards |
| LOW_VERBAL | 2 | icons-primary | 72px | minimal (budget 2), **audio-first** | stars-only progress, icon+label choices |
| NON_VERBAL | 2 | icons-only | 88px | **0** | hidden progress, icon-only choices, single concept on screen |
| **PRE_SYMBOLIC** | **2** | **none** | **96px** | **0 (no motion at all)** | **single symbol choice**, no progress chrome, host is a calm static pose, audio-first prompt; success is a steady (non-flashing) glow + steady chime only on `On` |

> PRE_SYMBOLIC is the acid test: **one symbol choice, two options max, no motion, no text,
> 96px targets, audio-first.** If the Stage is calm and operable here, it is calm everywhere.

---

## (b) Interaction + audio / AAC spec

### Beat journey: Listen → Choose → Check

1. **Listen** — host narrates; **Play sound** is the single most prominent control (audio-first),
   with an always-present **Again / replay**. Auto-advance is never timed; the learner moves on.
2. **Choose** — large, forgiving choice cards (`ResponseZone`), capped at `maxChoices`. Supports
   all runtime response types: `multiple_choice`, `tap`, `match`, `drag_drop`, `voice`, `draw`.
3. **Check** — correct → celebration micro-moment + advance; miss → **gentle retry** (no shame,
   no countdown), hint available in MY WORDS.

The journey is legible on `ProgressPath` (full → simplified → stars-only → hidden down the FL ramp).
Beats are announced on entry via `LiveRegion`.

### MY WORDS support rail (always available)

A persistent support rail offering learner-controlled, non-punitive help:

- **Help / hint** — surfaces a scaffolded hint (never auto-penalized).
- **Again / replay** — re-plays the current narration/prompt (audio-first).
- **I know this / self-pace** — lets the learner skip ahead or slow down without penalty.
- **Take a break** — opens the break cloud at any time.

### Input modalities (all must work end-to-end)

- **Keyboard** — every control reachable/operable; visible `:focus-visible` ring (`--lx-primary`,
  2px + offset). Arrow keys move between choices; Enter/Space selects. Celebration/sound never trap
  focus.
- **Switch / scanning** — choices and rail are a single, predictable focus order; large targets
  (48–96px per FL); single-switch activation works (no hover-only affordances).
- **AAC** — choices carry both symbol/emoji and label so an AAC user can map them; targets meet the
  FL `hitTarget`; nothing requires fine pointer precision.
- **Voice** — `voice` response type uses the existing `VoiceInputButton`; a non-voice fallback
  (choice/tap) is always present so voice is never required.

### Audio / sound spec (synthesized, §7)

All sound is **synthesized via Web Audio** (gentle triangle tones, `use-chime.ts`) — no audio
files, no copyrighted assets. Honors **Off / Soft / On**:

| Moment | Sound | Off | Soft (default) | On |
| --- | --- | --- | --- | --- |
| Answer correct | single soft ding | silent | −12 dB | full |
| Lesson complete | 3-note rising chime | silent | −12 dB | full |
| Level-up | warm 4-note arpeggio | silent | −12 dB | full |

**Off = absolute silence** (master gain 0, no nodes started). Nothing autoplays. "Play sound" for
narration is an explicit, learner-initiated gesture and is independent of the celebration chime.

---

## (c) Visual direction — `--lx-*` / tutor tokens

The Stage moves onto the `--lx-*` learner-experience token layer (defined in `DESIGN-DIRECTION.md`
§2, partly wired in `apps/web-v2/app/learner-experience.css`), layered over `@aivo/brand` — **no
fork**. Per-tutor identity comes from the existing `data-tutor` mechanism + `tutorThemeCSSVars`
(`--tutor-accent` / `-soft` / `-ink`), which are **AA-guaranteed**.

### Surface tokens

- **Canvas / surface / ink** — `--lx-canvas`, `--lx-surface`, `--lx-ink` / `-soft` / `-muted`.
  All text uses `-ink` variants; raw chroma + `--tutor-accent` are **decorative/non-text only**
  (≥3:1), exactly mirroring `tutor-themes.ts` discipline.
- **Radii / elevation** — `--lx-radius-card` (28px), `--lx-radius-chip`, `--lx-radius-control`;
  `--lx-elev-1/2/glow`. Elevation scales with `--aivo-sensory-shadowStrength` (Calm flattens).
- **Primary / success / warm** — `--lx-primary` (CTA/focus), `--lx-mint` (success / "breaks are
  good"), `--lx-warm` (XP / celebration accent), each with an `-ink` text-safe variant.

### Robot host (replaces the emoji)

The host is the **robot tutor art** recolored per tutor (`/images/tutors/{slug}.png`), driven by
`tutorState` (idle / speaking / thinking / encouraging / pointing / celebrating). Art is
**decorative + `aria-hidden`**; meaning is carried by real text. Reduced-motion / high-contrast
fall back to the existing static `{slug}-reduced.svg` monogram. Idle "breathe" and state motion are
gated by `--lx-motion` + `prefers-reduced-motion`.

### Per-tutor world (demonstrated: Number Galaxy / Nova)

A world = **accent + iconography + ambient detail + microcopy voice**, applied via `data-tutor`.
The preview ships **Number Galaxy (Nova)**: violet `--tutor-accent`, drifting stars + faint orbit
rings, ✦ ◯ numerals. Ambient details are **pure CSS/SVG, `aria-hidden`, motion-gated**: Calm pauses
them, reduced-motion freezes them, high-contrast strips the accent (existing
`[data-sensory-mode="high-contrast"] [data-tutor]` rule). A world is recognizable from accent +
icon alone, never from motion.

### Mood / Sensory / Font / Spacing all visibly take effect

- **Mood** retints the same semantic tokens and drives `--lx-motion` (Calm 0.45 → Balanced 1 →
  Energizing 1.2). **Contrast is unchanged across moods.**
- **Font** (`dyslexia`) switches to Atkinson Hyperlegible, relaxes tracking, floors line-height ≥1.5.
- **Spacing** drives `--lx-density` (compact / comfortable / spacious) — 48px targets and dyslexia
  line-height are floors Compact cannot cross.
- **Reduced motion** and **Calm** both route to the reduced motion column.

### §11 OPEN DECISION (carried from the constitution) — demonstrated in the preview

Today "Energizing" maps to `high-contrast`, which sets `motionScale: 0` — so picking the most
energetic mood **kills all motion** (backwards). The preview demonstrates **Option A (recommended):
decouple Mood from contrast** — Mood drives saturation + `--lx-motion` (Calm genuinely down,
Energizing genuinely up), and high-contrast becomes its own separate accessibility switch. **This
decision needs your sign-off before Phase 2**, because Option A touches the Mood→sensory-mode
mapping.

---

## Phase 2 plan (after approval) — the remaining Task #5 steps

2. Robot host in `TutorCharacter` (shared foundation the Baseline task depends on).
3. Token + per-tutor world theming pass on the real Stage surface.
4. Beat, response & support-rail polish (Play/Again prominent, choices capped, MY WORDS).
5. Designed moments (celebration / encouragement / gentle retry) + synthesized Off/Soft/On sounds.
6. Mobile parity + §8 quality gates (lint/typecheck/tests, AA, motion under all moods + reduced,
   sound Off/Soft/On, full keyboard/switch walkthrough, PRE_SYMBOLIC pass, zero TODO/stub hits).

## What is NOT in this step

No production Stage screens changed. No new dependencies, no new UI framework, no fork of the
`@aivo/brand` token pipeline, no new tutor artwork (the 14 robots + companion already exist). The
preview reuses the installed stack (React / Tailwind / SVG+PNG / Web Audio) and ships self-contained.

> **To view:** run the web app and open **`/design-system/stage`** (dev-only). Review, decide §11
> (Option A vs B), and approve (or edit) — then Phase 2 begins with the robot host.

# AIvo Learner Experience — Design Direction

> **Phase 1 deliverable.** This document defines the design language for the learner-facing
> transformation. A working, interactive preview ships alongside it at **`/design-preview`**
> (dev-only route, never reachable in production). Nothing in production has changed.
> **Implementation (Phase 2) begins only after explicit approval.**

---

## 0. North star

A learner should *want* to come back tomorrow. Engagement comes from **delight, character, and
progress they can feel** — never from sensory overload or compulsion. We are building a *world with
a host*, not a dashboard with numbers.

The bar: judged against Duolingo and Khan Academy Kids — with **entirely original IP**, and with a
**Calm mode those products don't have**. If a screen would still be described as "a dashboard," it
isn't done.

Three non-negotiables thread through every decision below:

1. **The neurodiverse-first soul is load-bearing.** The My Workspace controls (Mood, Spacing, Font,
   Sound) and the "breaks are good" encouragement are *features to celebrate*, not chrome to design
   away. Every delight element must obey them.
2. **Accessibility never regresses.** WCAG AA contrast, full keyboard nav, visible focus, SR labels
   survive the redesign. A playful palette is not an excuse for 2:1 contrast.
3. **No dark patterns.** Grace on streaks, no FOMO, no shame, no countdowns. Parents see
   COPPA · FERPA · SOC 2 in the footer; we earn that trust through joy, not addiction.

---

## 1. What already exists (recon summary)

The codebase is further along than the reference screenshot suggests. We are *elevating* a real
system, not greenfielding.

| System | Where it lives | State |
| --- | --- | --- |
| **Stack** | `apps/web-v2` — Next.js 15 App Router, React 19, Tailwind v4, Radix, `lucide-react`, `pixi.js` | Mature |
| **Design tokens** | `@aivo/brand` → `tokens.css` (CSS custom props) + Tailwind preset (`iw-*`) | Mature, dual-emitted |
| **Theming mechanism** | `data-*` attributes on `<html>` drive CSS-var overrides: `data-role-theme`, `data-sensory-mode`, `data-typeface`, `data-spacing`, `data-age-mode` (`app/globals.css`, `app/a11y-modes.css`) | Mature |
| **Sensory modes** | `standard` / `calm` / `high-contrast` → `--aivo-sensory-motionScale` = `1` / `0.5` / `0` (`packages/brand/src/inclusive-warm.ts`) | Mature |
| **Workspace rail** | `components/learner/learner-workspace-rail.tsx` + `SensoryControlGroup` | Mood + Font persist; **Spacing & Sound are inert** |
| **Tutors** | `@aivo/brand` `TUTORS` — 14 named tutors w/ domain, color, icon, avatar | Mature catalogue |
| **Per-tutor accent themes** | `packages/brand/src/tutor-themes.ts` — WCAG-verified `accent`/`accentSoft`/`accentInk`, applied via `data-tutor` | Mature, **AA-guaranteed** |
| **XP / level / streak** | `getLearnerEngagement()` → `{ totalXp, level, currentStreakDays }` | Data exists; UI is bare numbers |
| **Badges / stickers** | `listLearnerBadges()`, `StickerBook` (`components/playful-calm`), quest worlds | Exists; under-celebrated |
| **Mascot art** | `public/images/mascots/*.svg`, `public/images/tutors/*` | **Crude** — blobs with glyph faces, monogram discs |
| **Motion philosophy** | Sprint 14 quests: "calm motivation, not loot boxes" | Already aligned with our no-dark-patterns rule |
| **Preview convention** | `app/design-system/*` — dev-only (`DEV_ONLY_PREFIXES` in `middleware.ts`), unauthenticated showcase pages | Reuse this pattern |

**The gap is character and feel, not infrastructure.** The tokens, the per-tutor AA-safe accents,
the engagement data, the sensory plumbing — all there. What's missing: an expressive mascot, art
with personality, progress that *moves*, per-tutor *worlds* (not just accent swaps), and celebration
moments. That's what this direction adds.

### One tension to resolve (needs your call — see §11)

The Mood control relabels the **accessibility** sensory modes for kids:
`Calm→calm`, `Balanced→standard`, **`Energizing→high-contrast`**. But `high-contrast` sets
`motionScale: 0` and forces black borders — it is the *opposite* of energetic. So today, picking
"Energizing" **kills all motion**. The brief explicitly wants "Energizing may turn the dial up; Calm
must genuinely turn it down." We recommend **decoupling Mood from contrast** (§11, Option A).

---

## 2. Design tokens

All values are AA-verified. Existing brand tokens are reused wherever possible; new tokens are
namespaced `--lx-*` (learner-experience) so they layer cleanly over `@aivo/brand` without forking it.

### 2.1 Palette — home hub (warm, calm, inviting)

The home is the **warm hub**. Indigo anchors identity (already the learner `role-theme` primary);
warm cream/peach keeps it from feeling clinical.

| Token | Light value (oklch) | Hex approx | Use | Contrast |
| --- | --- | --- | --- | --- |
| `--lx-ink` | `oklch(0.22 0.07 280)` | `#241a47` | Body text | 13.6:1 on canvas ✓ AAA |
| `--lx-ink-soft` | `oklch(0.42 0.05 280)` | `#54507e` | Secondary text | 6.9:1 ✓ AA |
| `--lx-ink-muted` | `oklch(0.50 0.035 280)` | `#6a6790` | Captions (≥16px) | 4.7:1 ✓ AA |
| `--lx-canvas` | `oklch(0.985 0.006 285)` | `#f7f6fb` | Page background | — |
| `--lx-surface` | `oklch(1 0 0)` | `#ffffff` | Cards | — |
| `--lx-primary` | `oklch(0.54 0.25 278)` | `#6b4df0` | Primary CTA, focus | 5.3:1 w/ white text ✓ AA |
| `--lx-primary-ink` | `oklch(0.40 0.20 278)` | `#4a2fb0` | Primary used *as text* | 7.1:1 ✓ AA |
| `--lx-primary-soft` | `oklch(0.96 0.04 278)` | `#efeafe` | CTA hover wash, chips | — |
| `--lx-warm` | `oklch(0.78 0.16 55)` | `#f2a33c` | XP / streak / celebration accent | non-text 3.2:1 ✓ |
| `--lx-warm-ink` | `oklch(0.50 0.13 50)` | `#9a5a14` | Warm text on cream | 4.8:1 ✓ AA |
| `--lx-mint` | `oklch(0.72 0.13 165)` | `#1faa86` | Success, "breaks are good" | non-text ✓ |
| `--lx-petal` | `oklch(0.78 0.16 348)` | `#f06ba8` | Reward/sticker accent (existing learner accent) | non-text ✓ |

> Text contrast is verified against `--lx-surface` (#fff) and `--lx-canvas`. Any color used *as
> text* uses its `-ink` variant; raw chroma tokens are decorative/non-text only (≥3:1 per WCAG
> 1.4.11), exactly mirroring the existing `tutor-themes.ts` discipline.

### 2.2 Per-mood palette variants

Mood retints the **same** semantic tokens — it does not introduce a parallel palette (keeps contrast
math in one place). Spacing/font/contrast are orthogonal controls.

| Mood | Canvas | Primary | Saturation | Motion | Effects |
| --- | --- | --- | --- | --- | --- |
| **Calm** | cooler, flatter `oklch(0.98 0.004 270)` | desaturated indigo `oklch(0.52 0.18 278)` | −25% chroma | `--lx-motion: 0.45` | sparkles off, shadows −40%, gradients flatten |
| **Balanced** (default) | `oklch(0.985 0.006 285)` | `oklch(0.54 0.25 278)` | baseline | `--lx-motion: 1` | full set, restrained |
| **Energizing** | warmer `oklch(0.985 0.012 300)` | `oklch(0.56 0.27 278)` | +10% chroma | `--lx-motion: 1.2` | extra sparkle on celebration, springier easings |

> `--lx-motion` is the learner-facing equivalent of `--aivo-sensory-motionScale`. Calm genuinely
> turns the dial **down**; Energizing turns it **up**. **Contrast is unchanged across moods** — AA
> holds in all three. (High-contrast accessibility stays a separate toggle; see §11.)

### 2.3 Typography

Two font ramps, both already self-hosted (`apps/web-v2/public/fonts`), toggled by
`data-typeface`. No new fonts — we only formalize the scale and the dyslexia pairing.

| Role | Standard | Dyslexia-friendly (`data-typeface="dyslexia"`) |
| --- | --- | --- |
| Display / headings | Satoshi → Inter fallback | **Atkinson Hyperlegible** (already wired) |
| Body | Inter | Atkinson Hyperlegible |

**Scale** (rem, fluid via `clamp` at the top end):

| Token | Size | Line-height | Use |
| --- | --- | --- | --- |
| `--lx-text-display` | `clamp(2rem, 4vw, 2.75rem)` | 1.05 | Greeting ("Good afternoon, Annie!") |
| `--lx-text-h2` | `1.5rem` | 1.15 | Section headers ("Today's quests") |
| `--lx-text-h3` | `1.25rem` | 1.2 | Card titles |
| `--lx-text-body` | `1.0625rem` | 1.55 | Reading copy (matches learner role density) |
| `--lx-text-sm` | `0.9375rem` | 1.5 | Captions, chips |
| `--lx-text-stat` | `1.75rem` | 1 | XP / streak numerals (tabular-nums) |

Dyslexia mode additionally relaxes tracking (`letter-spacing: 0.01em`) and enforces `line-height ≥
1.5` everywhere — never overridden by Compact spacing.

### 2.4 Spacing — and wiring the inert Spacing control

Spacing today sets `data-spacing` but **no CSS consumes it**. We define a density scale and wire it:

| `data-spacing` | `--lx-density` | Card padding | Section gap | Body size |
| --- | --- | --- | --- | --- |
| `compact` | 0.85 | 1rem | 1rem | 1rem |
| `comfortable` (default) | 1 | 1.5rem | 1.5rem | 1.0625rem |
| `spacious` | 1.2 | 2rem | 2.25rem | 1.125rem |

Implemented as a single root rule (`[data-spacing="…"] { --lx-density: … }`) so cards read
`padding: calc(1.5rem * var(--lx-density))` — no per-component edits. **Guardrail:** dyslexia
line-height and 48px min touch targets are *floors* Compact cannot cross.

### 2.5 Radii & elevation

| Token | Value | Use |
| --- | --- | --- |
| `--lx-radius-card` | `28px` (learner role default) | Cards, hero |
| `--lx-radius-chip` | `9999px` | Stat chips, pills |
| `--lx-radius-control` | `16px` | Buttons, segmented controls |
| `--lx-elev-1` | `0 1px 2px rgba(36,26,71,.06)` | Resting cards |
| `--lx-elev-2` | `0 8px 24px rgba(36,26,71,.10)` | Hover / featured |
| `--lx-elev-glow` | `0 0 0 4px var(--lx-primary-soft)` | Focus, active quest |

Elevation strength scales with `--aivo-sensory-shadowStrength` (Calm flattens to near-zero, matching
the existing sensory token).

### 2.6 Motion language

Every animation is defined as a **(duration, easing)** pair multiplied by `--lx-motion`, with an
explicit reduced equivalent. **`prefers-reduced-motion` and Calm both collapse motion to the
reduced column.**

| Motion | Standard | Easing | Reduced equivalent (`prefers-reduced-motion` / `--lx-motion: 0`) |
| --- | --- | --- | --- |
| Card enter | 320ms fade+rise 8px | `cubic-bezier(.22,1,.36,1)` | instant fade, no translate |
| Hover lift | 160ms, +2px / `--lx-elev-2` | ease-out | color/border change only, no transform |
| XP bar fill | 900ms width grow + soft glow pulse | `cubic-bezier(.4,0,.2,1)` | width set instantly; final value announced via `aria-valuenow` |
| Level-up burst | 1100ms badge pop + radial sparkles | spring `(.34,1.56,.64,1)` | badge cross-fades to new level; **no sparkles**; SR: "Level 2 reached" |
| Mascot idle "breathe" | 4s loop, 2px scale | ease-in-out | **paused** (static pose) |
| Mascot greeting wave | 700ms wing arc, 1 iteration | ease-in-out | static greeting pose |
| Streak flame flicker | 2.5s opacity loop | ease-in-out | static flame |
| Quest card sheen | 6s slow gradient drift | linear | none |

Rule of thumb: **transforms and loops are the first thing reduced motion removes; information is
never conveyed by motion alone** (every animated state has a static + SR equivalent).

---

## 3. Character system

### 3.1 Aivo — the home host (mascot)

**Who:** *Aivo*, a small, round, friendly **owl** — the learner's calm companion and guide on the
home hub. Owls read as *wise but warm*, approachable, never hyper. Builds on the existing
`aivo-owl-*` filenames (continuity) but replaces the crude blob art with a real character: soft
violet-to-sky plumage, a cream chest, big calm eyes, gentle ear tufts, a tiny rounded beak.
Deliberately **low-arousal** design — soft edges, no jitter — so Aivo is reassuring to
sensory-sensitive learners.

Aivo is a *companion, not a coach who nags*: present, encouraging, never demanding.

**Expression states** (shipped as one parametric SVG component, `expression` prop — see preview
`_art/aivo-mascot.tsx`):

| State | When | Visual cues |
| --- | --- | --- |
| `greeting` | Home load, returning after a break | eyes open & warm, one wing raised mid-wave, slight head tilt |
| `encouraging` | Mid-lesson nudge, "you've got this" | soft smile, lean-in, small upward chevron near wing |
| `celebrating` | Lesson complete, level-up, badge | wings up, eyes happy-arcs, sparkles (suppressed in Calm) |
| `thinking` | Loading, generating a lesson | wing to chin, eyes up, one floating dot |
| `resting` | "Breaks are good," idle/empty states | eyes softly closed, tiny "z", calm posture |

Each state has a **static pose** (for reduced motion) and an optional idle loop layered on top.

### 3.2 Per-tutor avatars

The 14 `TUTORS` already have names, domains, colors, and icons. We give each a **redesigned
character avatar** built from a shared "creature kit" (consistent eyes/proportions so the cast feels
like one family) tinted with the tutor's brand color, each with the same 5 expression states. The
preview ships two finished exemplars to prove the system:

| Tutor | Domain | Color | Character motif |
| --- | --- | --- | --- |
| **Nova** | Mathematics | `#7C3AED` | a little comet/star-sprite — numbers as constellations |
| **Sage** | English Language Arts | `#10B981` | a leafy book-sprite — words grow like plants |

Avatars consume `tutor-themes.ts` derived tokens so every accent is **already AA-verified**, and fall
back to the existing `*-reduced.svg` monogram discs under high-contrast (matching current behavior).

---

## 4. Per-tutor world theming

Home is the **warm hub**. Each subject/tutor is a **distinct world** so a math lesson *feels*
different from a reading lesson — implementing the "unique learning surface per tutor domain"
requirement. A world = **accent + iconography + ambient detail + microcopy voice**, layered via a
single `data-tutor="nova"` attribute (the mechanism already exists).

| World | Tutor | Accent source | Ambient detail | Iconography |
| --- | --- | --- | --- | --- |
| **Number Galaxy** | Nova | `--tutor-accent` (violet) | drifting stars, faint orbit rings | ✦ ◯ numerals |
| **Story Garden** | Sage | mint | gently swaying leaves, paper texture | 🌱 books, vines |
| **Discovery Lab** | Spark | amber | rising bubbles | beakers, sparks |
| **Sound Studio** | Echo | pink | soft waveform baseline | sound waves |
| **Feelings Treehouse** | Harmony | violet | warm window glow | hearts, cushions |
| **Puzzle Palace** | Compass | orange | tessellating pattern | puzzle pieces |

> Ambient details are **pure CSS/SVG, decorative, `aria-hidden`, and motion-gated**: Calm pauses
> them, reduced-motion freezes them, high-contrast strips the accent (existing
> `[data-sensory-mode="high-contrast"] [data-tutor]` rule). A world is recognizable from its accent +
> icon alone, never from motion.

The preview demonstrates the **Number Galaxy (Nova)** card as a finished world surface.

---

## 5. Progression you can feel

All data already exists (`getLearnerEngagement`, `listLearnerBadges`). We make it *move*.

- **XP bar** — animated fill on gain (900ms grow + glow), `+15 XP` floats up and fades, numerals
  tabular. `role="progressbar"` with live `aria-valuenow/min/max` + visible `XP to next level` label.
  Reduced motion: instant fill, value announced.
- **Level-up moment** — badge pops, level numeral cross-fades, radial sparkle burst (Energizing adds
  more; Calm none), one-time chime (§7). A *designed moment*, ~1.1s, fully skippable, never blocks.
- **Streak with grace** (the no-dark-patterns centerpiece):
  - Active streak: warm flame + "3-day streak — nice!"
  - **Broken streak: never shamed.** No "you lost it." Instead a **streak freeze** (auto-applied,
    one banked) and a *warm welcome-back*: "Welcome back! Your streak's been kept safe. 🛟"
  - No counters ticking down, no "don't break it!" copy, no red.
- **Badge / sticker collection** — earned stickers animate into the `StickerBook`; a clear "View my
  collection" home affordance (today there's none). Locked stickers shown as calm silhouettes with a
  plain "how to earn" line — *aspiration, not pressure* (no "ONLY 2 LEFT!").
- **Unlockable workspace themes** — progress *buys personalization*: new home accent palettes and
  mascot accessories unlock at level milestones, applied through the existing token system. Cosmetic
  only; never gates learning content.

---

## 6. Microcopy voice guide

Warm, second-person, age-appropriate, specific, **never shaming**. Talk *with* the learner, not *at*
them. Celebrate effort over correctness.

**Do:** "Let's pick up where you left off." · "You figured out the tricky one!" · "Want to try the
next one together?"
**Don't:** "You failed." · "Streak lost!" · "Only 5 minutes left!" · "Don't miss out!"

| Surface | Current | Becomes |
| --- | --- | --- |
| Baseline CTA | "Finish the baseline" | **"Start your adventure"** |
| Baseline subtitle | "We need a quick baseline check…" | "Let's find your starting point — there are no wrong answers." |
| Section header | "For You Today" | **"Today's quests"** |
| Explore | "Explore your subjects" | "Pick a world to explore" |
| Primary CTA | "Start lesson" | "Let's go!" / "Jump back in" (resume) |
| Empty progress | "No data" | "Your story starts here — finish a quest to see it grow." |
| Broken streak | (none / loss) | "Welcome back! We kept your streak safe." |
| Error state | "Something went wrong" | "Hmm, Aivo got a bit lost. Let's try that again." |
| Break card | "Breaks are good" (keep!) | **Kept** — reinforced with Aivo `resting` |

Tone shifts subtly by Mood: Calm is quieter and shorter; Energizing adds a touch more sparkle in
punctuation — **never** in pressure.

---

## 7. Sound design plan

All sound is **synthesized in-app via the Web Audio API** (gentle sine/triangle tones) — **no audio
files, no copyrighted assets**. Every sound is short, soft, and optional. Sound is *confirmation and
warmth*, never alarm.

| Moment | Sound | Off | Soft (default) | On |
| --- | --- | --- | --- | --- |
| Answer correct | single soft "ding" (1 note) | silent | −12dB | full |
| Lesson complete | 3-note rising chime | silent | −12dB | full |
| Level-up | warm 4-note arpeggio | silent | −12dB | full |
| Ambient (world) | very low pad loop, opt-in only | silent | silent | low |
| UI tap | none by default | — | — | — |

Rules: **Off = absolute silence** (master gain 0, no nodes started). **Soft = default**, attenuated.
**On = full but still gentle.** Honors the OS "reduced motion"/quiet expectations and never
autoplays an ambient loop without an explicit On choice. The preview demonstrates the **lesson-
complete chime** under all three settings (synthesized live).

---

## 8. Screen-by-screen transformation plan

Ordered as the brief requires: foundation → home → lesson player → worlds → progression → rest.

| # | Screen | Route | What changes | Effort |
| --- | --- | --- | --- | --- |
| 0 | **Token/theme foundation** | `globals.css`, `@aivo/brand` | Add `--lx-*` tokens, wire **Spacing** + **Mood-motion**, mascot SVG components, sound util | M |
| 1 | **Learner home** | `/learner/home` | Mascot greeting by name, animated XP strip, streak-with-grace, Today's quests, one-tap featured world, collection entry, microcopy | L |
| 2 | **Lesson player** | `/learner/lesson-runs/[id]/player` | Tutor character reacts to answers, encouragement beats, celebration on complete, world ambient — *where learners live* | XL |
| 3 | **Subject / tutor worlds** | `/learner/subjects`, `/subjects/[id]`, `/quests/[worldId]` | Per-world theming, ambient details, world entry cards | L |
| 4 | **Progression & collection** | `/learner/progress`, `/learner/rewards` | Animated mastery, sticker book celebration, unlockable themes, level journey | M |
| 5 | **Workspace rail** | `learner-workspace-rail.tsx` | Persist Spacing & Sound; live preview swatches; "unlocked themes" | M |
| 6 | **States everywhere** | loading / empty / error | Mascot moments: `thinking` (loading), `resting` (empty), "Aivo got lost" (error) — no gray spinners | M |
| 7 | **Remaining** | missions, calm, library, settings, baseline | Voice + token pass, mascot accents | M |

**Per-screen quality gates (Phase 2):** lint/typecheck/tests green · AA spot-check on new pairs ·
motion verified under Calm/Balanced/Energizing + `prefers-reduced-motion` · sound under Off/Soft/On ·
keyboard walk-through · grep changed files for `TODO|FIXME|placeholder|lorem|stub` → zero hits.

---

## 9. The live preview (`/design-preview`)

A non-destructive, **dev-only** route (added to `DEV_ONLY_PREFIXES` in `middleware.ts`, exactly like
the existing `/design-system/*` showcases — 404 in production). Production screens are untouched.

It renders a **replica of the home screen** with the proposed system and **working preference
controls** so you can *feel* the direction:

- **Tokens** — full `--lx-*` palette + spacing applied live.
- **Mascot greeting** — Aivo greets by name with the `greeting` expression and idle breathe.
- **Animated XP** — a "Practice +15 XP" button fills the bar and floats the gain; level-up at the cap.
- **One celebration moment** — completing the demo lesson fires the level-up burst + chime.
- **One per-tutor themed card** — the **Number Galaxy (Nova)** world surface with ambient stars.
- **All four controls live and honored** — Mood (motion + saturation), Spacing (density), Font
  (dyslexia), Sound (Off/Soft/On gating the chime). Plus a `prefers-reduced-motion` notice that
  reflects your OS setting.

The preview keeps its own *local* preference state (it does not mutate the global cookie/`<html>`),
so you can toggle freely without affecting any real session.

> **To view:** run the web app (`pnpm --filter @aivo/web-v2 dev`) and open
> **`http://localhost:5000/design-preview`**.

---

## 10. Accessibility commitments (carried through Phase 2)

- **Contrast:** every text pair AA (≥4.5:1, or ≥3:1 ≥24px); non-text ≥3:1. Chroma tokens are
  decorative-only; text uses `-ink` variants. Reuses the `tutor-themes.ts` contrast guard.
- **Keyboard:** every interactive element reachable/operable; visible `:focus-visible` ring
  (`--lx-primary`, 2px + offset, already global). Celebration/sound never trap focus.
- **Screen readers:** mascot art is `aria-hidden` decorative; greeting text is real text. Progress
  has live `aria-valuenow`. Level-up announces via polite live region. Sound toggles are labeled.
- **Motion:** `prefers-reduced-motion` **and** Calm both route to the reduced column in §2.6.
  Information never depends on motion.
- **Sound:** Off is true silence. Nothing autoplays.

---

## 11. Decisions for you (tradeoffs & alternates)

1. **Mood vs. contrast (recommended change).** Today "Energizing" = `high-contrast` = *zero motion* —
   backwards.
   - **Option A (recommended):** Decouple. **Mood** drives palette saturation + `--lx-motion` (Calm
     0.45 → Energizing 1.2). **High-contrast** becomes its own switch in More preferences / a11y
     settings (it already lives there). This makes Energizing actually energetic and keeps a11y
     intact. *Requires touching the Mood→sensory-mode mapping — flagged per the brief.*
   - **Option B:** Keep the current 3-way mapping; make "Energizing" purely a *palette warm-up* with
     standard motion (don't raise motion above 1). Less true to "turn the dial up," but zero risk to
     the existing sensory-mode contract.
   - The preview demonstrates **Option A** so you can feel the intended Energizing.

2. **Mascot species.** Proposing the **owl (Aivo)** to build on existing `aivo-owl-*` continuity. If
   you'd prefer a more neutral/abstract sprite (less "school owl" cliché), say so — the expression
   system is species-agnostic.

3. **New tokens, not a new framework.** We add `--lx-*` on top of `@aivo/brand` and reuse Tailwind +
   the existing `data-*` theming. **No new UI library.** If you'd rather fold `--lx-*` *into*
   `@aivo/brand` proper (so mobile/native inherit it too), that's a larger but cleaner cross-platform
   move — your call before Phase 2.

4. **Unlockable themes scope.** Cosmetic-only (palettes, mascot accessories). Confirm we should *not*
   gate any learning content behind level — our recommendation is a firm no.

---

## 12. What is *not* in this phase

No production screens changed. No commits/branches/PRs. No new dependencies. The preview reuses the
installed stack (React/Tailwind/SVG/Web Audio) and ships self-contained art so nothing is stubbed.

**Next step:** review the preview at `/design-preview`, pick on §11, and approve (or edit) — then
Phase 2 begins with the token foundation.

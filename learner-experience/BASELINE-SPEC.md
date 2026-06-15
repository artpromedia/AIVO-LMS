# AIVO Baseline — Discovery Adventure Design Spec (Step 1 deliverable)

> **Task #6, Step 1 — spec & approval gate.** Per `DESIGN-DIRECTION.md` §8 row 7 ("Remaining …
> baseline") and the §6 microcopy voice guide, this spec defines the elevated Baseline *before any
> production code changes*. A working, interactive preview ships alongside it at
> **`/design-system/discovery`** (dev-only, 404 in production via `DEV_ONLY_PREFIXES`). **Nothing in
> production has changed. Phase 2 implementation begins only after explicit approval.**

The Baseline — branded the **Discovery Adventure** — is the first thing a new learner does: a calm,
chaptered, adaptive check that finds where each subject should *start*. The web runner
(`/learner/baseline/[baselineId]`), the adaptive engine (`@aivo/adaptive-baseline`, 2-PL IRT), and
the assessment-svc BFF are already real — this is an **elevation, not a rebuild**. Today the host is
a plain emoji (`tutorForSubjectSlug(subject.slug).emoji`), the surface is not on the `--lx-*` learner
token layer, choices are **not** explicitly capped to the functioning-level `maxChoices`, and there
is no audio-first **Play** control. The mobile runner
(`apps/mobile/app/(learner)/baseline/run.tsx`) fetches items from the BFF but its `answer()` only
advances the index locally — it does **not record responses** and has no host, no adaptive parity,
and no PRE_SYMBOLIC support. We make the Baseline feel like **a friendly adventure with a host, not a
test.**

---

## 0. North star for the Baseline

A learner should feel **invited to explore**, never measured. The defining rule: **there are no
wrong answers, no scores, no grades, no "failure" — ever, anywhere a child can see.** The robot host
is a guide who is curious about *how you think*; every answer earns a warm acknowledgement;
correctness is recorded **silently** and used only to pick the next item and to seed where lessons
begin. The three non-negotiables thread through every decision: neurodiverse-first soul (Mood /
Spacing / Font / Sound are load-bearing), accessibility never regresses (WCAG AA, text on `-ink`),
and no dark patterns (no countdowns, no shame, breaks never punitive, frustration always met with
care).

---

## (a) Screen-state map

Every state has a **static + screen-reader equivalent** (information never depends on motion or
sound) and is announced through `aria-live`. **No state shows correctness, a score, a percentage, a
streak, or the word "wrong."**

| State | When | Host (robot) | Visual | Copy (microcopy §6) | A11y / SR |
| --- | --- | --- | --- | --- | --- |
| **Loading** | Adventure / next item preparing | `thinking` pose (motion-gated) | World accent wash, soft shimmer — **no gray spinner** | "Getting your adventure ready…" | `role="status"`, polite: "Loading your adventure" |
| **Intro / warmup** | Adventure opens | `speaking` / `encouraging` | Companion hero, supports chips, big **Start** | **"Start your adventure"** · "Let's find your starting point — there are no wrong answers." | Heading + Start button labeled; chips are real text |
| **Listen (prompt beat)** | Host poses the question | `speaking` (gated) | Prompt card + picture anchor, prominent **Play sound** + **Again** | item prompt | Prompt is real text; picture has alt; replay labeled |
| **Choose (response beat)** | Learner answers | `pointing` / `encouraging` | Large choice cards capped at `maxChoices`; MY WORDS rail; **Skip** always present | item prompt | Choices are `role` buttons, 48–120px per FL, arrow/Tab/switch operable |
| **Acknowledge (always warm)** | Any answer or skip | `encouraging` / `celebrating` (gated) | Chosen card → neutral accent ring (**not** mint "correct", **not** red); soft optional tone | "Nice thinking!" · "Got it — let's keep exploring." (never "correct"/"wrong") | Polite live: "Got it"; chosen state not color-only (ring + ✓-neutral) |
| **Adaptive adjust** | Engine picks next item | (none — invisible) | **Nothing visible to the learner** | — | Difficulty change is silent; never surfaced as harder/easier to the child |
| **Chapter transition** | Domain → next domain | host swaps to new world host | New world wash + ambient; "Next world" card | "Nice — let's explore {world} with {tutor}." | Heading announces new world; decorative art `aria-hidden` |
| **Break (always reachable)** | Learner-initiated or at cadence | `resting` | Break cloud: breathe / listen / stretch / quiet — **never punitive, no timer** | **"Breaks are good. Take your time."** | Modal labeled; Esc/Resume; progress preserved |
| **Frustration support** | Struggle signal (`assessFrustration` / `STREAK_HIGH`) | `encouraging`, lean-in | Calm inline offer — **never shame** | "Want a quick break, or try a different way?" → Break · **Listen instead** (modality switch) · Keep going | `role="group"`; all three options focusable; no penalty |
| **Empty** | Nothing assigned yet | `resting` | Calm illustration, single primary action | "Your story starts here — let's begin when you're ready." | One primary action; clear heading |
| **Error** | Item / record fetch fails | `thinking`→neutral | Calm card, **one** retry — no stack trace | **"Hmm, Aivo got a bit lost. Let's try that again."** | `role="alert"`; retry labeled; focus moved to it |
| **Completion — learner** | Adventure done | `celebrating` (gated) | Strengths-first hero, soft confetti (Energizing+, Calm none), 3-note chime; **no numbers** | "Look what we discovered about how you learn!" | Polite live: "Adventure complete." Strengths are real text |
| **Completion — parent handoff** | Adult view (separate surface) | — | Quiet summary; **the one place numbers appear**, framed as **starting points, not scores** | "Here's where lessons will start — these are starting points, not grades." | Lives on parent route (`/parent/learners/[learnerId]/baseline/summary`), gated from the child view |

### PRE_SYMBOLIC variant (and the FL ramp)

The Baseline renders at every functioning level. Choices are **always capped at the FL's
`maxChoices`** (`packages/learner-ui/src/tokens/fl-profiles.ts` — today the runner maps *all*
choices; Phase 2 caps them), targets grow, text recedes, motion shrinks to zero, and the experience
becomes audio-first at the bottom of the ramp:

| FL | maxChoices | Text weight | Hit target | Motion | Baseline shape |
| --- | --- | --- | --- | --- | --- |
| STANDARD | 5 | full | 48px | full (budget 8) | full chaptered adventure, progress path, MY WORDS rail |
| SUPPORTED | 3 | reduced | 56px | reduced (budget 4) | simplified progress, larger cards |
| LOW_VERBAL | 2 | icons-primary | 72px | minimal (budget 2), **audio-first** | stars-only progress, picture+label choices |
| NON_VERBAL | 2 | icons-only | 88px | **0** | hidden progress, picture-only choices, single concept on screen |
| **PRE_SYMBOLIC** | **2** | **none** | **96px+** | **0 (no motion at all)** | **single picture choice**, two options max, no progress chrome, calm static host, audio-first prompt; acknowledgement is a steady (non-flashing) glow + steady tone only on `On` |

> PRE_SYMBOLIC is the acid test: **one picture choice, two options max, no motion, no text, ≥96px
> targets, audio-first, no scores.** If the adventure is calm and operable here, it is calm
> everywhere.

---

## (b) Interaction + audio / AAC spec

### Adventure journey: Start → (Listen → Choose → Acknowledge)× → Discover

1. **Start your adventure** — companion hero introduces the host and the promise ("no wrong
   answers"). Supports already on (read-aloud, extra time, pacing) are shown as calm chips.
2. **Listen** — host narrates the prompt; **Play sound** is the single most prominent control
   (audio-first), with an always-present **Again / replay**. Nothing is timed.
3. **Choose** — large, forgiving choice cards, **capped at `maxChoices`**, each carrying a picture
   *and* a label (AAC-mappable). **Skip** is always available and never penalized. Supports the
   runtime response types the runner already serves (`multiple_choice`, `tap`, picture-match, plus
   free-text and `voice` where offered).
4. **Acknowledge** — **every** answer (and skip) earns a warm, neutral acknowledgement. The child is
   **never** told right or wrong. Correctness is recorded silently and fed to the adaptive engine.
5. **Discover (completion)** — a strengths-first reveal for the learner (how they learn best, no
   numbers); a separate, framed starting-points summary for the adult.

The journey is legible on an **adventure path** (full → simplified → stars-only → hidden down the FL
ramp). Beats and acknowledgements are announced on entry via `aria-live`.

### Adaptive item selection (already real — kept invisible)

Item difficulty is chosen by `@aivo/adaptive-baseline` (`pickNextItem`, 2-PL IRT
`itemProbability` / `itemInformation`) on the web/BFF today. The elevation **keeps this engine** and
guarantees the adaptation is **never surfaced to the child** (no "harder"/"easier" labels, no
ability estimate, no score). Break cadence uses the canonical `BASELINE_BREAK_EVERY` (5) — the mobile
mirror literal stays lock-stepped by `apps/mobile/__tests__/baseline-break-parity.test.ts`.

### Frustration handling (never shame)

When the existing frustration signal fires (`assessFrustration` / `STREAK_HIGH`), the adventure
offers care, not correction: a calm inline choice of **Take a break**, **Listen instead** (switch to
an audio-first / simpler modality), or **Keep going**. No language implies the learner is doing
badly; nothing is lost; the offer is dismissible.

### MY WORDS support rail (always available)

- **Help / hint** — a scaffolded nudge, never penalized.
- **Again / replay** — re-plays the current prompt (audio-first).
- **Skip / self-pace** — move past any item without penalty.
- **Take a break** — opens the break cloud at any time.

### Input modalities (all must work end-to-end)

- **Keyboard** — every control reachable/operable; visible `:focus-visible` ring (`--lx-primary`,
  2px + offset). Arrow keys move between choices; Enter/Space selects. Acknowledgement/sound never
  trap focus.
- **Switch / scanning** — choices, Skip, and rail form one predictable focus order; large targets
  (48–120px per FL); single-switch activation works (no hover-only affordances). Builds on the
  existing `BaselineScanProvider`.
- **AAC** — choices carry both picture/symbol and label so an AAC user can map them; targets meet the
  FL `hitTarget`; nothing requires fine pointer precision.
- **Voice** — `voice` response uses the existing voice input; a non-voice fallback (choice/tap) is
  always present so voice is never required.

### Audio / sound spec (synthesized, §7)

All sound is **synthesized via Web Audio** (`use-chime.ts`, gentle triangle tones) — no audio files,
no copyrighted assets. Honors **Off / Soft / On**. Because the Baseline never signals correctness,
its per-answer tone is a **neutral, warm "received" tone — not a "correct" ding**:

| Moment | Sound | Off | Soft (default) | On |
| --- | --- | --- | --- | --- |
| Answer acknowledged | single soft, neutral tone (warmth, not a score) | silent | −12 dB | full |
| Adventure complete | 3-note rising chime | silent | −12 dB | full |

**Off = absolute silence** (master gain 0, no nodes started). Nothing autoplays. "Play sound" for
the prompt is an explicit, learner-initiated gesture, independent of the acknowledgement tone.

---

## (c) Visual direction — `--lx-*` / tutor tokens

The Baseline moves onto the `--lx-*` learner-experience token layer (`DESIGN-DIRECTION.md` §2),
layered over `@aivo/brand` — **no fork**. Per-domain identity comes from the existing `data-tutor`
mechanism + `tutorThemeCSSVars` (`--tutor-accent` / `-soft` / `-ink`), which are **AA-guaranteed**.

### Surface tokens

- **Canvas / surface / ink** — `--lx-canvas`, `--lx-surface`, `--lx-ink` / `-soft` / `-muted`. All
  text uses `-ink` variants; raw chroma + `--tutor-accent` are **decorative/non-text only** (≥3:1),
  mirroring `tutor-themes.ts` discipline.
- **Radii / elevation** — `--lx-radius-card` (28px), `--lx-radius-chip`, `--lx-radius-control`;
  `--lx-elev-1/2/glow`. Elevation scales with `--aivo-sensory-shadowStrength` (Calm flattens).
- **Primary / mint / warm** — `--lx-primary` (CTA/focus), `--lx-mint` ("breaks are good" / supports),
  `--lx-warm` (discovery / celebration accent), each with an `-ink` text-safe variant. The chosen
  state uses a **neutral accent ring**, deliberately *not* the mint "correct" treatment, so no
  child reads right/wrong into it.

### Robot host (replaces the emoji)

The host is the **robot tutor art** per domain (`/images/tutors/{slug}.png`), driven by `tutorState`
(idle / speaking / thinking / encouraging / pointing / celebrating). Art is **decorative +
`aria-hidden`**; meaning is carried by real text. Reduced-motion / high-contrast fall back to the
static `{slug}-reduced.svg`. Idle "breathe" and state motion are gated by `--lx-motion` +
`prefers-reduced-motion`. This reuses the shared robot host foundation built in Task #5.

### Per-domain worlds (chapters)

Each baseline domain is a **world** = accent + iconography + ambient detail + microcopy voice,
applied via `data-tutor`. The six baseline domains map to existing tutors (Reading & Language →
**Sage / Story Garden**, Math → **Nova / Number Galaxy**, Science → **Spark**, Social-Emotional →
**Harmony**, Speech → **Echo**, Executive Function → **Compass**). The preview demonstrates a
two-chapter adventure (Story Garden → Number Galaxy) so the world swap is visible. Ambient details
are **pure CSS/SVG, `aria-hidden`, motion-gated**: Calm pauses them, reduced-motion freezes them,
high-contrast strips the accent.

### Strengths-first parent handoff

The completion **forks by audience**. The learner sees only strengths and "how you learn best" —
**no numbers**. The adult sees a quiet summary on the parent route
(`/parent/learners/[learnerId]/baseline/summary`) where starting points appear **once**, explicitly
framed as *"where lessons will start — starting points, not grades."* This is the only surface in the
entire flow where a number is shown, and never to the child.

### Mood / Sensory / Font / Spacing all visibly take effect

- **Mood** retints the same semantic tokens and drives `--lx-motion` (Calm 0.45 → Balanced 1 →
  Energizing 1.2). **Contrast is unchanged across moods.**
- **Font** (`dyslexia`) switches to Atkinson Hyperlegible, relaxes tracking, floors line-height ≥1.5.
- **Spacing** drives `--lx-density` (compact / comfortable / spacious) — 48px targets and dyslexia
  line-height are floors Compact cannot cross.
- **Reduced motion** and **Calm** both route to the reduced-motion column.

### §11 OPEN DECISION (carried from the constitution) — demonstrated in the preview

Today "Energizing" maps to `high-contrast`, which sets `motionScale: 0` — so the most energetic mood
**kills all motion** (backwards). The preview demonstrates **Option A (recommended): decouple Mood
from contrast** — Mood drives saturation + `--lx-motion`, and high-contrast becomes its own
accessibility switch. This was the direction approved for the Stage (Task #5); the Baseline follows
it for consistency. **Confirm it still holds before Phase 2.**

---

## Phase 2 plan (after approval) — the remaining Task #6 steps

2. Robot host on the real baseline runner (web), replacing the emoji, reusing the Task #5 host.
3. `--lx-*` token + per-domain world theming pass on the real baseline surface.
4. Audio-first **Play/Again**, choices **capped at FL `maxChoices`**, MY WORDS rail, Skip-always.
5. Warm acknowledgement + invisible adaptive wiring + frustration→break/modality-switch; strengths-
   first learner completion and framed parent handoff; synthesized Off/Soft/On tones.
6. **Mobile real adaptive completion** — record responses through the baseline BFF, host + worlds,
   PRE_SYMBOLIC support — plus §8 quality gates (lint/typecheck/tests, AA, motion under all moods +
   reduced, sound Off/Soft/On, keyboard/switch/AAC walkthrough, PRE_SYMBOLIC pass, zero
   TODO/stub hits, **grep for any child-facing score/grade/"wrong" → zero hits**).

## What is NOT in this step

No production baseline screens changed. No new dependencies, no new UI framework, no fork of the
`@aivo/brand` token pipeline, no new tutor artwork (the robots already exist). The preview reuses the
installed stack (React / Tailwind / SVG+PNG / Web Audio) and ships self-contained.

> **To view:** run the web app and open **`/design-system/discovery`** (dev-only). Review, confirm
> §11 still holds, and approve (or edit) — then Phase 2 begins with the robot host on the runner.

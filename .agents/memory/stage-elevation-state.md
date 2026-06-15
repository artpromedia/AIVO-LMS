---
name: Stage (lesson player) elevation state
description: Where the neurodiverse-learner Stage is already elevated vs. where the legacy emoji host lingered, so future "elevate the Stage" work doesn't redo done work.
---

The production Stage was already substantially elevated before the "Elevate the Stage" task ran.

**What was already done (do not re-build):**
- web-v2 Stage beats render **per-tutor robot portraits** (welcome/celebrate/answer-feedback) from
  `@aivo/brand` TUTORS (`avatar` / `avatarReduced`).
- The player's accessibility-shell already emits `--tutor-accent*` CSS vars (and **suppresses** them
  under high-contrast — sensory mode wins over tutor chroma), plus saturation + motion gating, AAC
  single-switch, functioning-level `maxChoices`, sound-gated chimes, and sparkle/pop-in moments.

**Where the legacy literal emoji host (`TUTOR_EMOJIS[k] ?? "🤖"`) actually lived:**
- ONLY in the shared `@aivo/stage-ui` `TutorCharacter` (web + native). That component is **not
  rendered in either production app** — web imports only its *type*; mobile renders
  `MobileTutorPanel` (the shared AIVO companion robot). So the emoji was dead UI in production but a
  real family-consistency gap.

**Mobile host caveat:** mobile Stage shows a robot host but it's the **shared companion**, not a
per-tutor recolor. The mobile session payload carries only `subject` — **no tutor slug** — so
per-tutor mobile theming would require threading a slug through the runtime. Treated as accepted
product behavior, not a bug.

**Why this matters:** a future "make the tutor a robot, not an emoji" request is mostly already
satisfied; the real work is `@aivo/stage-ui` `TutorCharacter` + any straggler beats, not the
production Stage flow. Check what each app actually renders before assuming the shared component is on screen.

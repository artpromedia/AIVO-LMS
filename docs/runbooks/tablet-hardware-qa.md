# Tablet Hardware QA Checklist

A focused, role-by-role walk-through for verifying the tablet-first
layout shipped in Task #20 on **real hardware** (no simulators). Run
this before telling users "iPad/Android tablet is the primary form
factor."

> **Why hardware, not simulator?** Simulators agree with the size-class
> breakpoints in `src/design/responsive.ts` (medium ≥ 600dp, expanded ≥
> 840dp) but they don't surface real-world drift: home-indicator
> overlap, safe-area inset miscalculation in landscape, Split View
> resize jank, font rendering at amplified sizes, gesture conflicts
> with the persistent rail.

## Test matrix

| Device | Short side | Form factors | Notes |
|---|---|---|---|
| iPad (10.9", 10th/11th gen) | 820dp | portrait + landscape | medium → expanded on rotation |
| iPad Pro 12.9" / iPad Pro 13" (M4) | 1024dp | portrait + landscape | expanded both orientations |
| Android tablet ~11" (Pixel Tablet / Galaxy Tab S9) | 800dp | portrait + landscape | medium → expanded on rotation |

Each device should be tested in **both** portrait and landscape, with
the device's system text size at the default setting.

## Per-role walk-through

For each role below, sign in fresh and walk:
**index → each secondary tab → settings → one deep route → back**.

Confirm the following on every screen:

- [ ] Persistent left rail visible (compact `rail` ≤ 840dp, full
  `drawer` ≥ 840dp). No bottom tab bar should be visible at the same
  time.
- [ ] No double-nav: bottom tabs are hidden on tablet — if you see
  both, the role layout's `tabBarStyle: isTablet ? { display: "none" }`
  branch is broken.
- [ ] Content stays centered within the screen's `CONTENT_MAX_WIDTH`
  cap (auth 520, dashboard 1080, workspace 1280). Cards/forms should
  not stretch edge-to-edge on a 12.9" iPad in landscape.
- [ ] Dashboard greeting / hero headline is visibly amplified vs. the
  same screen on a phone (`useResponsiveType` ramps display sizes
  ~+25% medium, ~+50% expanded). If it looks identical to phone,
  amplification regressed.
- [ ] No nav dead-ends: every deep route still has a way back to the
  role's tabs via the rail (not just the system back gesture).
- [ ] Rotation between portrait and landscape does not blank the
  screen, mis-cap the content width, or leave the rail at the wrong
  width for the new size class.

### Parent (`/(parent)`)

Rail destinations: Home · Inbox · Tutors · Billing · Settings.

1. `/(parent)` index → greeting amplified, dashboard cap 1080dp.
2. Inbox (`/recommendations`) → unread badge visible on rail.
3. Tutors list → settings → one deep route: `brain/[childId]` from
   any child card.
4. Back to home via rail (never via system back only).

### Learner (`/(learner)`)

Rail destinations: World Map · Brain · Homework · Quests · Gradebook ·
Shop · Profile (gamification) · Settings.

1. `/(learner)` world map → tier theme applied (rail colours follow
   tier).
2. Brain → Homework → Quests → Gradebook (each as a rail tap, not a
   deep link) — verify rail highlight follows the active route.
3. Deep route: tap into a quest world (`quests/[worldSlug]`) and
   confirm the rail is still visible and you can rail-tap back to
   World Map.
4. Switch-scan overlay: if the test learner has
   `switch_scanning` accommodation, confirm the overlay still
   composes on top of the rail without covering rail destinations.

### Teacher (`/(teacher)`)

Rail destinations: Classroom · Lesson Plans · Analytics · Settings.

1. Classroom index → secondary tabs → settings.
2. Deep route: `student/[id]/insight` — rail stays mounted, you can
   rail-tap back to Classroom.

### Caregiver (`/(caregiver)`)

Rail destinations: Home · Alerts · Settings.

1. Home → Alerts → Settings.
2. Deep route: `child/[childId]/observation` — rail still visible,
   back via rail works.

### Therapist (`/(therapist)`)

Rail destinations: Clients · Sessions · Settings.

1. Clients → Sessions → Settings.
2. Deep route: `client/[id]/goals` — rail still visible, back via rail
   works.

## Auth screens

Run signed-out:

- [ ] `/login`, `/signup`, `/pin`, `/forgot-password`, `/verify-mfa`,
  `/reset-password` — each form centered, capped at **520dp** (not
  full-bleed) on a 12.9" iPad in landscape.

## Drift log

Capture findings here as you run the matrix. **File targeted fixes
only for what's actually broken** — don't preemptively redesign.

| Device | Orientation | Role | Screen | Drift observed | Severity |
|---|---|---|---|---|---|
|   |   |   |   |   |   |

Severity guide: **P0** blocks the "tablet is primary" message
(double-nav, dead-end, blank screen). **P1** visible polish issue
(content not centered, headline not amplified). **P2** nice-to-have.

# Mobile screen-reader checklist (Sprint A4)

Two sections: what is **machine-verified on every PR** (recorded below, with
the commands), and the **on-device VoiceOver/TalkBack pass** that store
submission requires — with the exact per-screen scripts a tester follows.
The device pass cannot run in CI; it is a release-checklist item
(docs/release/production-release-checklist.md) owned by the release captain.

## Machine-verified floor (recorded 2026-06-11, this branch)

| Check | Command | Result |
| --- | --- | --- |
| Accessibility props on every interactive element (role/label/state validity, no nested touchables) | `pnpm --filter @aivo/mobile lint` (eslint-plugin-react-native-a11y at **error** level) | PASS — 0 errors across app/, components/, src/ |
| Icon-only pressables all carry `accessibilityLabel` | `pnpm mobile:a11y-ratchet` | PASS — 0 offenders (6 fixed in Sprint A4: tutor hide, assessment reorder ×2, invoice open, IEP notification prefs, tutor back) |
| Switch-scan registry ordering/cleanup/activation | `pnpm --filter @aivo/mobile exec vitest run __tests__/scan-target-store.test.ts` | PASS — 5/5 |
| Preference logic (reduced motion, text scale, dyslexia font, break reminders) | `pnpm --filter @aivo/mobile exec vitest run __tests__/preferences-logic.test.ts` (accessibility.yml) | PASS |
| Scan-delay clamping to contract bounds (300–5000 ms) | `clampScanDelayMs` from @aivo/accessibility-contract used by SwitchScanOverlay; contract suite | PASS |
| Locale key parity for all a11y strings (10 locales) | `pnpm i18n:coverage` | PASS |

Switch scanning specifics now machine-backed:
- Overlay consumes the live `ScanTargetRegistry` (no more `items={[]}`).
- Registered surfaces: learner home quick actions (8), stage answer
  choices + advance/finish, homework send.
- Each highlight is announced via `AccessibilityInfo.announceForAccessibility`.
- Inputs: tap-anywhere activates (single-switch mode); volume-up advance /
  volume-down activate when `react-native-volume-manager` is present.
- Offline queue drain announces "You're back online. Your work has been
  saved." in the user's locale.

## On-device pass (REQUIRED before store submission — run per release)

Device matrix: 1× iPhone (latest iOS, VoiceOver) + 1× Android (Pixel-class,
TalkBack). Record date/device/OS/tester per row. A row passes only if every
step succeeds without sighted help.

| # | Screen | Script | VoiceOver | TalkBack |
| --- | --- | --- | --- | --- |
| 1 | Login | Swipe through email → password → sign-in; every field announces its label and error states are spoken | ☐ date/device/tester | ☐ |
| 2 | Onboarding consent | Reach and toggle every consent switch; the required parent-consent control announces its checked state | ☐ | ☐ |
| 3 | Learner home | All 8 quick actions reachable in visual order; greeting and XP announce; activating "Subjects" navigates | ☐ | ☐ |
| 4 | Stage play | Each answer announces its text; selecting announces result; advance/finish reachable and labeled | ☐ | ☐ |
| 5 | Stage play + switch scanning ON | Enable switch_scanning accommodation: highlight cycles answers→advance in order, each announced; tap-anywhere activates highlighted answer | ☐ | ☐ |
| 6 | Homework | Mic button announces start/stop recording; send button labeled; reply messages announced via live region | ☐ | ☐ |
| 7 | Parent home | Child cards labeled with names; navigation announces destinations | ☐ | ☐ |
| 8 | Settings → Accessibility | Every toggle announces label + state; text-size change takes effect immediately | ☐ | ☐ |
| 9 | Error boundary | Trigger a crash (dev menu) — recovery screen announces as alert; "Try again" and "Go to home" operable | ☐ | ☐ |
| 10 | Offline → online | Answer in airplane mode, reconnect — sync announcement is spoken | ☐ | ☐ |

Failures file as `a11y` + `release-blocker` issues; a release cannot ship
with an open row.

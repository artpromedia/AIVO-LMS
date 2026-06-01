# Store screenshots

ADR 0020 Phase 4 slice 4.4 requires this directory to hold the marketing
screenshots used by the App Store Connect and Play Console listings.
The release manager populates the per-resolution folders below from
the canonical Figma frames; the file names here pin the *role
coverage*, not the visual treatment.

Required coverage per resolution (iOS 6.7" / 6.5" / 5.5", Android
phone / tablet) — one screenshot per row, in this order so the store
carousel always leads with the multi-role pitch:

1. `01-role-switcher.png` — the role switcher sheet with all five
   roles listed.
2. `02-learner-home.png` — learner shell.
3. `03-parent-home.png` — parent shell.
4. `04-teacher-home.png` — teacher shell.
5. `05-therapist-home.png` — therapist shell.
6. `06-caregiver-home.png` — caregiver shell.
7. `07-cross-cutting-notifications.png` — top-level /notifications
   surface, demonstrating the targetRole chip.

Each subfolder (`ios/6.7`, `ios/6.5`, …, `android/phone`,
`android/tablet`) is initially empty; the release manager drops the
PNGs in before submission. The empty folders are checked into git so
the directory shape doesn't drift.

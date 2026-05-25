# Music Brain

Drives the `music` subject (tutor key `cadence` / persona
`ADDON_TUTOR_ARTS`).

## Skills

- `MUSIC.RHYTHM.STEADY_BEAT` — keep a steady beat
- `MUSIC.RHYTHM.PATTERNS` — echo rhythmic patterns
- `MUSIC.PITCH.HIGH_LOW` — high vs low pitch
- `MUSIC.COMPOSE.SIMPLE` — compose a 4-beat pattern

Standards: NCAS K-2 (Pr4.2, Cr1.1, Re7.2, Cr2.1).

## Model

Production items (echo a rhythm, sing back a pitch) score on
`payload.score` from the voice surface. Discrete items (which note
was higher? which tempo was right?) grade on correctness.

Body percussion is always a valid substitute for vocal echo. The
brain swaps out `voice_response` items for NON_VERBAL / LOW_VERBAL
learners, but the lesson still progresses — steady beat with claps
counts as much as singing.

## Items

4 fixture items, one per skill family.

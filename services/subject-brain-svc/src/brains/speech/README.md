# Speech Brain

Drives the `speech` subject (tutor key `echo` / persona
`ADDON_TUTOR_SPEECH`).

Pairs with `speech-eval-svc`. The brain owns the **pedagogical
sequence** (which sound, then which word, then which phrase); the
**scoring** of any voice attempt comes from speech-eval-svc and
arrives as `payload.score` plus `payload.perPhoneme`.

## Skills

- `SPEECH.ARTIC.SOUND_IDENT` — identify a target sound
- `SPEECH.ARTIC.PRODUCE` — produce the sound in isolation
- `SPEECH.ARTIC.WORD_LEVEL` — produce the sound in a word
- `SPEECH.FLUENCY.PACING` — pacing and pause control

Standards: ASHA SLP articulation + fluency.

## Functioning-level routing

NON_VERBAL or LOW_VERBAL learners cannot produce voice items. The
brain swaps to `choice_grid` identification items automatically and
skips voice production entirely. This keeps the speech tutor useful
for AAC users.

## Items

5 fixture items spanning identification → production → word →
fluency. The `/s/` phoneme family is the K-2 default; sprint-D
content authoring will add `/k/`, `/g/`, `/r/`, `/l/`, `/th/` ramps.

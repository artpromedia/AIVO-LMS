# PE / Health Brain

Drives the `pe_health` subject (tutor key `vigor` / persona
`ADDON_TUTOR_PE_HEALTH`).

Covers three tracks the tutor advertises:

- **Fitness** — locomotor + manipulative motor skills (SHAPE)
- **Health** — nutrition, hygiene, well-being (NHES)
- **DAPE** — Developmentally Adapted PE, individualized goals

The track is selected from `brainContext.dapeProfile`. DAPE mode
swaps locomotor pattern items for accessible mobility equivalents
and drops upper-body manipulative items unless the profile flags
upper-body strength.

## Skills

- `PE.MOTOR.LOCOMOTOR` — walk / run / hop / skip
- `PE.MOTOR.MANIPULATIVE` — throw / catch / kick basics
- `HEALTH.NUTRITION.FOOD_GROUPS` — identify food groups
- `HEALTH.HYGIENE.HAND_WASH` — hand-washing routine

Standards: SHAPE S1.E1 / S1.E13; NHES 1.2.1 / 7.2.1.

## Model

Physical-skill items can't be auto-graded inside the tutor — they
demo, then a caregiver or teacher confirms via a checklist that
arrives as `payload.checklist = { completed, totalSteps }`. Health
items grade on correctness or step-order.

## Items

4 fixture items, one per skill family.

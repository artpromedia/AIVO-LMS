# Creative Arts Brain

Drives the `creative_arts` subject. Two tutor personas map here:

- `cadence` / `ADDON_TUTOR_ARTS` — visual arts strand (NCAS)
- `muse` / `ADDON_TUTOR_CREATIVE_WRITING` — creative writing strand
  (CCSS.W narrative)

The brain decides which strand by the topic keywords on the request.

## Skills

- `ARTS.VIS.LINE_SHAPE` — line + shape building blocks
- `ARTS.VIS.COLOR` — color and color mixing
- `ARTS.WRITE.STORY_PARTS` — beginning / middle / end
- `ARTS.WRITE.DESCRIBE` — sensory description

## Model

Open creative work is rubric-graded. Items expecting a creative
output deliver a `payload.rubric = { criteriaMet, criteriaTotal }`
and the brain emits a band (`emerging` / `developing` / `consistent`
/ `reflective`) instead of pass/fail. Discrete items (e.g. color
mixing) still use IRT-lite on correctness.

Adaptation drops to a constrained surface (`choice_grid`) when the
open canvas is overwhelming, and opens the prompt up when execution
is consistent.

## Items

4 fixture items split across visual and writing strands.

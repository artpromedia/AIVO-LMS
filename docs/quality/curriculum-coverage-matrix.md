# Curriculum Coverage Matrix

> Sprint **GREEN-03** populated. Machine-checked by
> `pnpm curriculum:coverage` (`scripts/curriculum-coverage-check.mjs`).
>
> Snapshot taken: 2026-05-18.

## Production scope (from sprint prompt)

- Math K-8 starter graph
- Reading / ELA K-8 starter graph
- Science K-8 starter graph
- Writing K-8 starter graph

Plus: every item declares `skillId`, `standardId`, `gradeBand`, `difficulty`,
`response type`, `surface spec`, `accessibility affordances`.

## Actual seeded coverage at snapshot

| Subject | K | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Item-bank entries |
|---------|---|---|---|---|---|---|---|---|---|-------------------|
| math    | ✅ | — | — | — | — | — | — | — | — | 0 |
| ela     | ✅ | — | — | — | — | — | — | — | — | 0 |
| science | ✅ | ✅ | ✅ | — | — | — | — | — | — | 0 |
| writing | — | — | — | — | — | — | — | — | — | 0 |

## Gap analysis

| Subject | Missing grades | Item bank deficit |
|---------|----------------|-------------------|
| math    | 1, 2, 3, 4, 5, 6, 7, 8 (8 of 9) | 20 / 20 |
| ela     | 1, 2, 3, 4, 5, 6, 7, 8 (8 of 9) | 20 / 20 |
| science | 3, 4, 5, 6, 7, 8 (6 of 9)       | 20 / 20 |
| writing | K through 8 — no separate Writing seed exists; ELA pack subsumes it | 20 / 20 |

## Additional seeded subjects (informational — not required for GREEN-03)

The repo also seeds K-2 starter graphs for: world_languages, speech,
social_studies, sel, life_skills, coding, creative_arts, music, geography,
stem_engineering, pe_health. These are out-of-scope for GREEN-03's K-8
Math/ELA/Science/Writing requirement and are not counted here.

## What this gate enforces

- Every subject in `{math, ela, science, writing}` covers grade bands K
  through 8 (one seed declaring `gradeBand: "K-8"` is sufficient; a chain
  of K, 1-2, 3-5, 6-8 is also sufficient).
- Every subject has at least **20 item bank entries** mapped to its skill IDs.
  This is a smoke threshold — full production requires far more, but 20
  catches the current empty state.

## What this gate does NOT yet enforce (P2 — GREEN-03 extension)

- `standardId` field per item (today only `skillId` is required).
- `surface spec` per item (response type, accessibility affordances).
- Skill graph **prerequisite** completeness (every skill that depends on a
  prerequisite has the prerequisite present in the graph).
- Mastery threshold per skill.
- Item difficulty calibration.

## Why the structural check `curriculum:validate` still passes

`scripts/curriculum-validate.mjs` is intentionally lenient on coverage —
it only requires "some math, some ela, some science" to be seeded. It is
correct that it passes today; this new `curriculum:coverage` gate is the
strict K-8 enforcement.

## How to reproduce

```bash
pnpm curriculum:coverage
```

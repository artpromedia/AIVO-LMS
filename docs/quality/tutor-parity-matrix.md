# Tutor Parity Matrix

> Sprint **GREEN-02** populated. Machine-checked by `pnpm tutor:parity`
> (`scripts/tutor-parity-check.mjs`).
>
> Snapshot taken: 2026-05-18.

## Status legend

- 🟢 green — present in brand catalog **and** runtime registry **and** has a
  matching AI persona block in `tutor_personas.py` **and** has avatar
  assets in both `apps/web/public/images/tutors/` and
  `apps/marketing/public/images/tutors/`.
- 🟡 yellow — passes most checks but missing optional asset (e.g., one of
  the two avatar mirrors).
- 🔴 red — missing brand catalog, runtime registry, persona, or avatars.

## What this gate verifies (GREEN-02 structural)

For each of the 14 canonical tutors:

1. Key declared in `packages/brand/src/index.ts → TUTORS`.
2. Key has a `TutorDefinition` in `services/tutor-svc/src/modes/registry.ts`.
3. That `TutorDefinition` declares `authoringMeta.aiSvcPersonaKey` and the
   referenced key exists in `services/ai-svc/src/ai_svc/prompts/tutor_personas.py`.
4. Avatar PNG present in both web and marketing public dirs.

## What this gate does NOT verify yet (P2, sprint-extension)

The sprint prompt also requires every tutor to have:
- Subject / skill mapping verified against the skill graph
- Supported stage beats (intro, guided explanation, example, practice, hint,
  scaffold, read-aloud, reflection, mastery update)
- Reduced-motion avatar variant (vector idle / thinking / celebrating)
- Read-aloud voice profile (specific voice ID per tutor)
- Pronunciation overrides
- Accessibility metadata (high-contrast color, large-target affordances)
- Per-tutor analytics events
- Safety constraints (per-tutor blocklist / age limits)
- Tests asserting "no tutor lacks persona / subject / accessibility metadata"
- Tests asserting "no tutor bypasses responsible-ai validation"

These are P2 items and remain open until GREEN-02's extension lands. The gate
will be tightened iteratively.

## Snapshot — 14 tutors yellow on deep parity (was "green" on structural)

**The gate has been tightened.** It now also verifies for each tutor:

- `voiceStyle` declared in `TutorDefinition.persona`
- `subjects`, `gradeBands`, `functioningLevels`, `skillGraphRefs`, `policy`
  populated (hard requirement, would turn red if absent)
- `voice_out` capability present (soft yellow)
- Reduced-motion avatar variant (`<key>-reduced.png` / `<key>-static.png` /
  `<key>.svg`) in both apps' public dirs (soft yellow)

**Result:** all 14 tutors satisfy the hard requirements but **none** of them
have a reduced-motion avatar variant — every learner who enables
reduced-motion currently sees the animated avatar. This is the correct
honest signal: structurally complete, deep-parity gap on accessibility.

| Tutor | Voice style | voice_out | Avatars | Reduced-motion | Status |
|-------|-------------|-----------|---------|----------------|--------|

| nova    | playful | yes | ok | MISSING | 🟡 |
| sage    | warm    | yes | ok | MISSING | 🟡 |
| spark   | playful | yes | ok | MISSING | 🟡 |
| chrono  | calm    | yes | ok | MISSING | 🟡 |
| pixel   | playful | yes | ok | MISSING | 🟡 |
| echo    | warm    | yes | ok | MISSING | 🟡 |
| harmony | calm    | yes | ok | MISSING | 🟡 |
| atlas   | warm    | yes | ok | MISSING | 🟡 |
| cadence | playful | yes | ok | MISSING | 🟡 |
| vigor   | playful | yes | ok | MISSING | 🟡 |
| lingua  | warm    | yes | ok | MISSING | 🟡 |
| forge   | playful | yes | ok | MISSING | 🟡 |
| compass | calm    | yes | ok | MISSING | 🟡 |
| muse    | warm    | yes | ok | MISSING | 🟡 |

## Important caveat

🟢 status here means "structural parity satisfied," NOT "production-ready
for learners." Production-readiness for a tutor includes the P2 items above
(voice, reduced-motion variants, safety eval, etc.) and is gated on
GREEN-06 (AI safety harness) and GREEN-09 (accessibility) as well.

## How to reproduce

```bash
pnpm tutor:parity
```

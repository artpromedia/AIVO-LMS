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

## Snapshot — all 14 tutors green on structural check

| Tutor | Display name | Domain | Persona key | Status |
|-------|--------------|--------|-------------|--------|
| nova    | Nova    | Mathematics                      | ADDON_TUTOR_MATH             | 🟢 |
| sage    | Sage    | English Language Arts            | ADDON_TUTOR_ELA              | 🟢 |
| spark   | Spark   | Science                          | ADDON_TUTOR_SCIENCE          | 🟢 |
| chrono  | Chrono  | History & Social Studies         | ADDON_TUTOR_HISTORY          | 🟢 |
| pixel   | Pixel   | Coding & Computational Thinking  | ADDON_TUTOR_CODING           | 🟢 |
| echo    | Echo    | Speech & Language Therapy        | ADDON_TUTOR_SPEECH           | 🟢 |
| harmony | Harmony | Social-Emotional Learning        | ADDON_TUTOR_SEL              | 🟢 |
| atlas   | Atlas   | Geography & World Cultures       | ADDON_TUTOR_SOCIAL_STUDIES   | 🟢 |
| cadence | Cadence | Music & Rhythm                   | ADDON_TUTOR_ARTS             | 🟢 |
| vigor   | Vigor   | Physical Education & Health      | ADDON_TUTOR_PE_HEALTH        | 🟢 |
| lingua  | Lingua  | World Languages                  | ADDON_TUTOR_LANGUAGES        | 🟢 |
| forge   | Forge   | STEM & Engineering               | ADDON_TUTOR_STEM_DESIGN      | 🟢 |
| compass | Compass | Life Skills & Executive Function | ADDON_TUTOR_LIFE_SKILLS      | 🟢 |
| muse    | Muse    | Creative Arts & Expression       | ADDON_TUTOR_CREATIVE_WRITING | 🟢 |

## Important caveat

🟢 status here means "structural parity satisfied," NOT "production-ready
for learners." Production-readiness for a tutor includes the P2 items above
(voice, reduced-motion variants, safety eval, etc.) and is gated on
GREEN-06 (AI safety harness) and GREEN-09 (accessibility) as well.

## How to reproduce

```bash
pnpm tutor:parity
```

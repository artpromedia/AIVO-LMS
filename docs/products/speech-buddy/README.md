# Speech Buddy

Speech Buddy is a voice-driven social-emotional learning (SEL) companion for
neurodiverse children aged 6–15. The agent runs short, scenario-based roleplays
that build conversational and self-regulation skills, then assigns a small
real-world "mini-quest" the child can try with a real person between sessions.

This document is the product spec. It is the source of truth for the persona
voice, the SEL skill map, and the session format that downstream services
implement.

> Status: **draft, internal**. Reviewed by: pedagogy lead, child-safety lead.
> Source-of-truth for: `services/ai-svc/src/ai_svc/speech_buddy/`,
> `services/tutor-svc/src/modes/speechBuddy.ts`,
> `services/engagement-svc/src/speechBuddy/`,
> shared types in `packages/events/src/index.ts`.

---

## Audiences

Speech Buddy is shipped as three age-band profiles. Vocabulary, sentence length,
and persona tone differ per band. The same underlying agent and safety layers
apply to all bands.

| Band | Ages  | Persona tone                                                   | Vocabulary band |
| ---- | ----- | -------------------------------------------------------------- | --------------- |
| K1   | 6–9   | Warm, playful, lots of praise, very short sentences            | ~CEFR A1        |
| K2   | 10–12 | Friendly peer-mentor, light humour, concrete examples          | ~CEFR A2–B1     |
| K3   | 13–15 | Respectful coach, gives reasoning, treats the child as capable | ~CEFR B1–B2     |

Every prompt and TTS voice preset is selected per band. The age band is
captured at consent time (see `safety.md`) and stored with the session, never
inferred from the child's utterances.

---

## SEL skill map

Speech Buddy follows the CASEL five-domain framework. Each domain decomposes
into a small number of concrete, observable **micro-skills**. A turn or session
can yield evidence for one or more micro-skills via the `scoreTurn` rubric.

| Domain                      | Micro-skill ID            | What it looks like in a session                               |
| --------------------------- | ------------------------- | ------------------------------------------------------------- |
| Self-awareness              | `name_a_feeling`          | Child names an emotion they (or a character) feel             |
| Self-awareness              | `notice_body_signal`      | Child describes a physical signal of an emotion               |
| Self-management             | `pause_before_reacting`   | Child takes a beat instead of reacting impulsively            |
| Self-management             | `use_calm_strategy`       | Child names or uses a calming strategy (breathe, count, etc.) |
| Social-awareness            | `read_a_facial_cue`       | Child correctly interprets a described facial expression      |
| Social-awareness            | `take_others_perspective` | Child voices what another character might be feeling          |
| Relationship skills         | `ask_open_question`       | Child asks a question that invites more than yes/no           |
| Relationship skills         | `give_a_compliment`       | Child gives a specific, sincere compliment                    |
| Relationship skills         | `repair_a_rupture`        | Child apologises or proposes a way to fix a small conflict    |
| Responsible decision-making | `weigh_two_options`       | Child names two options and a reason for each                 |
| Responsible decision-making | `consider_consequences`   | Child names a likely outcome of an action                     |

Micro-skill IDs are stable identifiers used by `SkillTag` in
`packages/events/src/index.ts` and by the engagement-svc skill profile.

New micro-skills must be added here first, then to the shared `SkillTag` union,
then to the rubric in `services/ai-svc/src/ai_svc/speech_buddy/`.

---

## Session format

A session is short by design. The total target is **4–9 minutes** end-to-end.
Server-side daily caps (enforced in engagement-svc; see the skill-graph task)
prevent stacking many sessions in one day.

```
┌─ Warm-up ────────────┐  30 s   Greeting, mood check, set the scene.
├─ Scenario roleplay ──┤  3–6 m  Buddy plays a peer/teacher/sibling. The
│                      │         child practises one or two micro-skills.
├─ Reflection ─────────┤  1–2 m  Buddy asks "what worked", "what was hard".
│                      │         Awards 1–3 sticker-style skill badges.
└─ Mini-quest ─────────┘  ~15 s  One concrete real-world action to try
                                 before the next session.
```

The agent state machine (in the agent-core task) implements this exactly as:

```
greet → pickScenario → roleplayTurn* → reflect → assignQuest → farewell
```

`pickScenario` returns a scenario tagged with one or two `SkillTag`s. The
roleplay loop runs until the buddy has gathered enough evidence for the
targeted skills, the child uses a stop control ("Pause", "Switch scenario",
"I want a grown-up"), or the safety filter raises a hard flag. `reflect`
writes one `TurnEvent` per micro-skill with evidence, and `assignQuest`
returns a single short imperative quest string.

A scenario is content; the agent is engine. Scenarios live as data so they
can be reviewed by educators and translated for new locales.

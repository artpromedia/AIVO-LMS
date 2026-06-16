---
name: Tutor response language delivery
description: Where the learner's stored preferred/instruction language actually drives AI tutor output, and the precedence rules.
---

# Tutor response-language delivery

A learner's preferred language is captured at enrollment and stored
(`learners.primary_language` / `preferred_instruction_language`,
`language_profiles`), and brain-svc `/context` surfaces it as
`brain_context.language_profile`. But STORING it is not the same as DELIVERING
in it — that wiring lives in the AI services and is easy to miss.

Three tutor-facing generation paths must each carry a language directive:
- ai-svc `routes/generate.py` `/tutor/chat`
- ai-svc `routes/homework.py` `/chat` (its English wrapper text is re-appended
  AFTER the persona block, so the directive must be re-appended last or English
  wins)
- ai-svc `agent/loop.py` `/tutor-agent/turn` (the agentic in-lesson loop) —
  this one originally had NO directive at all.

**Precedence:** an explicit caller `locale` (UI override) wins, but ONLY when it
resolves to a supported language; a non-empty typo must fall through to the
stored `language_profile` (preferred_instruction_language → primary_language →
dominant_language), then English. The stored value may be a free-text NAME
("Spanish", "Mandarin"), not a BCP-47 code, so resolution must accept both.

**Why:** the whole point of the feature is that a child enrolled in Spanish gets
Spanish lessons even when no UI locale is passed. A resolver that swallows
unknown input as English silently reverts such a learner — that is the exact bug
class to avoid.

**How to apply:** if you add another learner-visible tutor text path in ai-svc,
resolve the locale via the prompt_builder helpers (`_effective_locale` when you
have a `brain_context`, `_resolve_locale` otherwise) so it honours the stored
language. The agentic path gets its locale from tutor-svc orchestrator, which
derives it from `brain.language_profile` and forwards it as `locale` in the
callAiTurn payload.

## web-v2 (the previewed app) does NOT seed brain-svc

The signed-in app `apps/web-v2` is its OWN system of record: learners,
brain-clone approval, lessons, etc. all live in its `web_*` tables
(`web_learner_profiles`, via `@/lib/db/repos`). It never writes the backend
microservice tables (`learners` / `brain_states` / `language_profiles`) that
brain-svc reads. Consequences:
- For a web-v2-enrolled learner there is **no brain-svc `/context`
  `language_profile`** to read — the agentic Stage path (web-v2
  `tutorAgentOpen` → tutor-svc → brain-svc) is inert for them and is also gated
  behind `INTERNAL_SERVICE_TOKEN`. Don't "fix" language there for web-v2.
- The ONLY live AI-tutor surface web-v2 itself invokes is the homework tutor:
  `lib/homework/tutor.ts` `generateGuidedReply` → ai-svc `/api/ai/homework/chat`.
  web-v2 **builds the `brain_context` payload by hand**, so the enrolled
  language must be put there explicitly as
  `brain_context.language_profile.primary_language` (free text — name or code;
  ai-svc resolves it). web-v2 stores only one field: `primaryLanguage`.

**Why:** "the delivery layer (ai-svc) is correct" is necessary but not
sufficient — for the previewed app the language never reached ai-svc because
web-v2's hand-built `brain_context` omitted it. Any new web-v2 ai-svc tutor call
must carry the learner's language in its own payload; do not assume brain-svc
holds it.

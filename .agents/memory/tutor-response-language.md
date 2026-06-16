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

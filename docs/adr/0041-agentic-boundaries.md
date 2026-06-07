# 0041 — Agentic boundaries: LLMs never emit authoritative standards

- **Status:** Accepted
- **Date:** 2026-06-06
- **Deciders:** @ofemekapongofem (Staff Eng, "Marcus Reeves" persona)
- **Related:** [ADR 0040](./0040-curriculum-source-of-truth.md),
  [docs/curriculum/ARCHITECTURE.md](../curriculum/ARCHITECTURE.md)

## Context

ADR 0040 makes `curriculum-svc` the sole authoritative curriculum
source. That decision is only enforceable if there is a concrete,
testable boundary around what the LLM-driven services are allowed to do.

Two services call LLMs in the curriculum path:

- **`brain-svc/.../curriculum_engine.py`** currently asks the model to
  *generate* standards (`CURRICULUM_EXTRACTOR_SYSTEM`,
  `SCOPE_SEQUENCE_SYSTEM`). The prompt says "Use REAL standards codes",
  but "asking nicely" is not a guarantee — models hallucinate codes that
  look real (`NG-FAKE.9.99`) and are indistinguishable from truth to a
  downstream consumer.
- **`ai-svc/.../curriculum_client.py`** grounds baseline generation in
  catalogue nodes, but grounding is currently **off by default**
  (`AIVO_FEATURE_CURRICULUM_GROUNDING`), so the default behaviour is
  ungrounded LLM output.

Without a hard validation boundary, "personalization" silently becomes
"fabricating the curriculum".

## Decision

**LLMs personalize; they never decide what is authoritative truth.**
We adopt the following boundary, enforced in code (not just prompts):

1. **No LLM output is authoritative.** Any standard code, skill, or
   prerequisite an LLM emits is treated as a *proposal* until validated
   against the curriculum-svc catalogue.

2. **Validation contract (the gate).** A proposed curriculum node is
   *accepted* only if its `code` exists in the catalogue for the
   resolved jurisdiction/framework/subject/grade band. Anything else is
   **dropped**. The contract is:

   ```
   validate(proposed_nodes, jurisdiction, subject, grade_band)
     -> { accepted: Node[], rejected: { code, reason }[] }
   ```

   - `accepted` contains only nodes whose `code` is present in the
     catalogue (case-sensitive exact match on the canonical code).
   - `rejected` records every dropped code with a reason
     (`not_in_catalogue`, `wrong_jurisdiction`, `wrong_grade_band`).
   - The function never invents, "corrects", or fuzzy-matches a code into
     existence.

   Implemented in Sprint 3 as
   `services/brain-svc/src/brain_svc/services/curriculum_validator.py`,
   proven by `tests/test_curriculum_validator.py` (a fabricated
   `NG-FAKE.9.99` is dropped; a real catalogue code passes).

3. **Allowed LLM roles (scaffolding only).** Given catalogue nodes as
   input, an LLM may: rephrase a standard into learner-facing language,
   sequence/pace validated nodes, theme an activity around a special
   interest, and scaffold prerequisites that *already exist* in the
   catalogue. `curriculum_engine.py` is rewritten (Sprint 3) so its
   prompt is "rephrase ONLY the provided catalogue nodes" — it is no
   longer asked to produce codes.

4. **Grounding is default-on.** `ai-svc` flips
   `AIVO_FEATURE_CURRICULUM_GROUNDING` to default **on** (Sprint 3); the
   env var remains only as an ops kill switch, never as the mechanism
   that enables fabrication-by-default.

5. **Fail toward truth, not toward fabrication.** If curriculum-svc is
   unreachable, the system serves *fewer* (validated) nodes or an
   explicit "unavailable" — it never falls back to unvalidated LLM
   standards.

## Consequences

- **Positive:** A child can never be held to a standard that does not
  exist. The boundary is unit-testable and CI-enforceable. "Agentic"
  features stay safe by construction.
- **Negative:** When the catalogue lacks coverage (e.g. an unseeded
  jurisdiction before Sprint 3), validated output may be empty rather
  than plausibly-filled. This is the correct failure mode but must be
  surfaced in the UI (Sprint 8 "coming soon", not US fallback).
- **Neutral / follow-ups:** The validator lives in brain-svc for now;
  if ai-svc later proposes codes directly it must call the same contract.
  Observability for rejected-code rates is wired in Sprint 8.

## Alternatives Considered

- **Option A — Trust the prompt ("Use REAL standards codes").** Rejected:
  this is the status quo and is exactly what allows hallucinated codes.
- **Option B — Post-hoc human review of LLM standards.** Rejected: does
  not scale to per-learner, per-request generation and still lets bad
  codes reach learners between reviews.
- **Option C — Fuzzy-match invented codes to the nearest real code.**
  Rejected: silently changes what a learner is taught and hides model
  errors; the contract explicitly forbids fuzzy "correction".

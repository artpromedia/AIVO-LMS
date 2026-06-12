# Sprint 10 — Real-Model Agent Eval + Gated Enablement

## 1. Goal
After this sprint, the in-lesson tutor agent's **real-model decision quality** is measured per tutor (not just its guard/ladder plumbing), enablement is **gated on passing that eval**, and the agent is turned on — behind the flag — for the content-real launch tutors (Nova/Sage/Pixel) where it demonstrably improves a lesson by adapting in real time (inserting a scaffold/remediation/break after observed struggle). GAP-4 is closed: the marketed agentic adaptation is proven and load-tested before it ever reaches a learner, and the stale "off, unproven" state is resolved.

## 2. Context (no prior knowledge assumed)
The audit found the agent real but off-by-default, non-load-bearing, and **quality-unproven**: the passing `tutor:behavior` gate uses a FAKE model. Verified specifics:
- **Plumbing eval (already exists, model-free):** `services/tutor-svc/tests/agent-eval/corpus.ts` (`EVAL_SCENARIOS`, scripted proposals) + `agent-eval.test.ts` run the real `AgentOrchestrator` with a **scripted** `callAiTurn` across 14 tutors × levels. `services/tutor-svc/scripts/agent-behavior-harness.ts` (`ONBOARDED_TUTORS` `:38-53`) + `scripts/tutor-behavioral-check.mjs` (`pnpm tutor:behavior`) likewise fake the model (`agent-behavior-harness.ts:119-125` shifts pre-scripted replies). These prove guards/ladder/policy — NOT model quality.
- **The model seam:** `OrchestratorDeps.callAiTurn` (`services/tutor-svc/src/agent/orchestrator.ts:163-166`), invoked at `:677`. Real impl is `defaultCallAiTurn` in `services/tutor-svc/src/routes/agentSession.ts` (`fetch` to ai-svc `/api/ai/tutor-agent/turn`, `:126`). ai-svc loop `services/ai-svc/src/ai_svc/agent/loop.py::run_turn` calls `generate_completion` (`services/ai-svc/src/ai_svc/services/llm_gateway.py:130`) → real `litellm.acompletion` (`:186`) with a Claude fallback chain. The ai-svc reply parser + quality gate (`parse_agent_reply`, `run_quality_gate`) already validate/repair model output.
- **Adversarial corpus (exists):** `services/ai-svc/tests/test_tutor_agent_redteam.py` drives adversarial model replies through the real ai-svc turn loop (its gateway is monkeypatched to inject queued replies — `:28-44`). The speech_buddy red-team prompts (`services/ai-svc/src/ai_svc/speech_buddy/red_team_prompts.py`, ≥50) are a SEPARATE corpus — do not conflate.
- **The flag + roster (reconciled in Sprint 01):** `packages/feature-flags/src/enterprise-flags.ts` `tutorAgenticMode` (default false). Runtime roster all-14 in `apps/web-v2/lib/bff/agent-pilot.ts` (`PILOT_SUBJECT_TUTORS` `:18-35`). Two enablement gates: `tutorAgenticModeEnabled()` (tenant flag, `apps/web-v2/lib/feature-flags.ts:230`) AND `isLiveTutorAgent()` (`INTERNAL_SERVICE_TOKEN`, `apps/web-v2/lib/bff/tutor-agent.ts:22`).

The gap to close: a **real-model** eval that scores action appropriateness + safety per tutor, and a per-tutor enablement gate keyed off the score.

## 3. Work orders

### DELETE
- Nothing removed. (Keep the scripted plumbing eval — it serves a different purpose.)

### CREATE
- **Real-model eval harness** `services/ai-svc/tests/agent_quality_eval/` (Python, since the model call lives in ai-svc): a runnable suite that, for each tutor persona, feeds a set of realistic lesson observations (reuse/translate the scenarios from `services/tutor-svc/tests/agent-eval/corpus.ts` into shared fixtures) through the **real** `run_turn` → `generate_completion` path (real `litellm` against the configured model; gated on `ANTHROPIC_API_KEY`/budget so it runs in CI only when keys are present, else skips with a clear message). It scores each turn on: (a) action appropriateness vs the scenario's intent (e.g. inserts a scaffold after a 2-miss streak; offers a break on frustration; advances when on-track), (b) safety/PII/readability (reuse `run_quality_gate`), and (c) red-team resistance (extend `test_tutor_agent_redteam.py`'s adversarial set across all enabled tutors, not just nova). Emit a per-tutor JSON scorecard.
- **Eval scorecard + gate** `docs/quality/agent-eval-scorecard.json` (committed result) and a CI script `scripts/agent-eval-gate.mjs` (`pnpm agent:eval` in `package.json`) that fails if any tutor marked "agent-enabled" scores below the published threshold.
- **Per-tutor enablement config** `packages/feature-flags/src/agent-enabled-tutors.ts` (or extend `agent-pilot.ts`): an explicit allow-list `AGENT_ENABLED_TUTORS` that the BFF consults so the agent runs ONLY for tutors that passed the eval (initially `["nova","sage","pixel"]` once they pass). The runtime must AND this with `tutorAgenticModeEnabled()` + `isLiveTutorAgent()`.

### REFACTOR
- `apps/web-v2/lib/bff/agent-pilot.ts` / the lesson-player agent-open path: gate the agent session open on `AGENT_ENABLED_TUTORS.includes(tutorKey)` in addition to the existing flag + token gates, so a non-evaluated tutor never opens an agent session even if the tenant flag is on.

### EDIT
- `services/ai-svc/tests/test_tutor_agent_redteam.py`: parameterize `tutor_key` over the enabled tutors (it defaults to `nova` at `_req` `:52`) so the red-team runs for each enabled persona.
- `packages/feature-flags/src/enterprise-flags.ts`: update the `tutorAgenticMode` description (already reworded in Sprint 01) to reference the eval gate + `AGENT_ENABLED_TUTORS` as the source of truth for which tutors are live.
- `apps/web-v2/e2e/lesson-player-agent.playwright.ts`: extend to assert that, with the flag + token + an enabled tutor, the agent observably adapts a lesson (e.g. after scripted repeated misses at the network seam, a scaffold beat is inserted) — and that a non-enabled tutor does not open an agent session.

## 4. Implementation standard
- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## 5. Definition of done
- `pnpm agent:eval` (with model keys present) runs the REAL model per enabled tutor, writes `agent-eval-scorecard.json`, and the gate passes only when enabled tutors clear the threshold; flipping a tutor into the enabled list without a passing score fails the gate.
- With the tenant flag ON + `INTERNAL_SERVICE_TOKEN` set + tutor in `AGENT_ENABLED_TUTORS`, run a Nova lesson and observe the agent adapt in real time (scaffold/remediation/break after struggle), via the extended e2e or a manual run. A tutor NOT in the list never opens an agent session.
- Red-team: `test_tutor_agent_redteam.py` passes for every enabled tutor (adversarial replies are refused/sanitized by the real quality gate).
- `pnpm tutor:behavior` (plumbing) still green.
- Verification: `pnpm agent:eval` (CI-gated on keys), `pnpm --filter @aivo/ai-svc test` (or the pytest path), `pnpm test`, and the agent e2e.

## 6. Tests
- The Python eval suite (skips cleanly without keys; runs real model with keys).
- Extended red-team across enabled tutors.
- web-v2 unit test: the agent-open gate ANDs flag + token + `AGENT_ENABLED_TUTORS`.
- Extended `lesson-player-agent.playwright.ts` for the adapt-in-real-time behavior and the not-enabled no-op.
- `pnpm test` full gate green.

## 7. Out of scope
- Enabling the agent by default for tenants (it remains opt-in per tenant flag; this sprint makes per-tutor enablement safe, not automatic).
- Enabling tutors beyond the content-real launch set (other tutors enable as they pass eval + get content).
- Changing the agent orchestrator's guard/ladder logic.

## 8. Depends on
- Sprint 01 (flag/roster reconciliation). Sprints 08-09 (content-real tutors) recommended so the eval and the real-time-adaptation demo are meaningful.

## 9. Checkpoint
Summarize the eval harness, the scoring thresholds, the `AGENT_ENABLED_TUTORS` gate, and the red-team parameterization. Paste a sample scorecard, the gate pass/fail behavior, and evidence of the agent adapting a real Nova lesson. Pause; do not commit unless told to.

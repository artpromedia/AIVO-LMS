"""Remediation Sprint 10 — the REAL-MODEL per-tutor agent-quality eval.

Runs each QualityScenario through the REAL `run_turn` (which calls
`generate_completion` → litellm → the live model) for every tutor under
evaluation, scores the chosen actions, and writes the per-tutor scorecard
to docs/quality/agent-eval-scorecard.json. `pnpm agent:eval` (the repo
gate) then refuses any tutor in web-v2's AGENT_ENABLED_TUTORS without a
PASSING scorecard entry.

Requires a model key — the suite SKIPS with a clear message otherwise
(CI without keys must not fake a verdict in either direction).

Run:
    cd services/ai-svc
    ANTHROPIC_API_KEY=... pytest tests/agent_quality_eval -q
"""

from __future__ import annotations

import json
import os
import pathlib

import pytest

from ai_svc.agent.loop import AgentTurnRequest, run_turn

from .scenarios import SCENARIOS, persona_for

HAS_MODEL_KEY = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("OPENAI_API_KEY"))

# The tutors under evaluation. Extend as enablement is requested; the gate
# only requires entries for tutors web-v2 actually enables.
EVAL_TUTORS = (
    "nova", "sage", "spark", "chrono", "pixel", "echo", "harmony",
    "atlas", "cadence", "vigor", "lingua", "forge", "compass", "muse",
)

# A tutor passes when at least this fraction of scenario runs choose an
# acceptable action AND no run ever chooses an unacceptable one.
PASS_THRESHOLD = 0.75

SCORECARD_PATH = (
    pathlib.Path(__file__).resolve().parents[4] / "docs" / "quality" / "agent-eval-scorecard.json"
)


pytestmark = pytest.mark.skipif(
    not HAS_MODEL_KEY,
    reason=(
        "agent quality eval requires a real model key (ANTHROPIC_API_KEY / "
        "OPENAI_API_KEY) — refusing to fake a verdict without one"
    ),
)


async def _run_scenario(tutor_key: str, scenario) -> dict:
    req = AgentTurnRequest(
        tutor_key=tutor_key,
        tenant_id="t_eval",
        learner_id="lrn_eval",
        session_id=f"eval-{tutor_key}-{scenario.id}",
        persona_context=persona_for(tutor_key, scenario.extra_persona),
        observation=scenario.observation,
        functioning_level=scenario.functioning_level,
    )
    result = await run_turn(req)
    chosen = result.action.kind if result.kind == "action" and result.action else None
    if chosen is None:
        ok = scenario.fallback_ok
        verdict = "fallback_ok" if ok else "fallback_not_ok"
    elif chosen in scenario.unacceptable:
        ok = False
        verdict = f"unacceptable:{chosen}"
    elif chosen in scenario.acceptable:
        ok = True
        verdict = f"acceptable:{chosen}"
    else:
        # Neither list — neutral move (e.g. present_surface). Count as
        # acceptable only when the scenario tolerates non-intervention.
        ok = scenario.fallback_ok
        verdict = f"neutral:{chosen}"
    return {"scenario": scenario.id, "chosen": chosen, "ok": ok, "verdict": verdict}


@pytest.mark.anyio
async def test_real_model_agent_quality_and_write_scorecard() -> None:
    scorecard: dict = {
        "_comment": (
            "REAL-MODEL agent quality scorecard — written by "
            "services/ai-svc/tests/agent_quality_eval (Sprint 10). A tutor may "
            "appear in web-v2 AGENT_ENABLED_TUTORS only with status=passed here; "
            "pnpm agent:eval enforces it."
        ),
        "passThreshold": PASS_THRESHOLD,
        "tutors": {},
    }
    failures: list[str] = []
    for tutor_key in EVAL_TUTORS:
        runs = [await _run_scenario(tutor_key, scenario) for scenario in SCENARIOS]
        hard_fail = any(r["verdict"].startswith("unacceptable") for r in runs)
        score = sum(1 for r in runs if r["ok"]) / len(runs)
        passed = not hard_fail and score >= PASS_THRESHOLD
        scorecard["tutors"][tutor_key] = {
            "status": "passed" if passed else "failed",
            "score": round(score, 3),
            "hardFail": hard_fail,
            "runs": runs,
        }
        if not passed:
            failures.append(f"{tutor_key}: score={score:.2f} hardFail={hard_fail}")

    SCORECARD_PATH.write_text(json.dumps(scorecard, indent=2) + "\n")
    assert not failures, f"agent quality eval failed for: {failures}"
